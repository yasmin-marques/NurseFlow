import { ConflictException, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { type ClientSession, Model, Types } from 'mongoose';
import type { AppConfig } from '../config/configuration';
import { Escala, PlantaoProfissional, Plantao, VersaoEscala } from '../escalas/schemas';
import { Setor } from '../setores/schemas/setor.schema';
import {
  EventoGoogleAgenda,
  IntegracaoGoogleAgenda,
  type OrigemTarefaGoogle,
  type ResultadoSincronizacao,
  StatusIntegracaoGoogle,
  StatusTarefaGoogle,
  TarefaGoogleAgenda,
} from './google-agenda.schemas';
import { GoogleCalendarClient, GoogleReconexaoNecessariaError } from './google-calendar.client';
import { type EventoDesejado, montarEvento } from './plantao-evento';
import { decifrarSegredo } from './token-cipher';

const DIA_MS = 86_400_000;
/** Duração do lease por profissional; é renovado a cada chamada ao Google. */
const LEASE_MS = 2 * 60_000;
const LEASE_TAREFA_MS = 5 * 60_000;
const MAX_TENTATIVAS = 5;
/** Espera (s) antes da 2ª, 3ª, 4ª e 5ª tentativas. */
const BACKOFF_SEGUNDOS = [60, 300, 900, 3600];
const ESPERA_OCUPADO_MS = 300;
const ESPERA_MANUAL_MS = 20_000;

/** Outra execução (manual ou automática) está sincronizando o mesmo profissional. */
export class SincronizacaoEmAndamentoError extends Error {
  constructor() {
    super('Já existe uma sincronização em andamento para este profissional.');
    this.name = 'SincronizacaoEmAndamentoError';
  }
}

type PlantaoSnapshot = Partial<Plantao> & { _id: Types.ObjectId; data: Date };
type VinculoSnapshot = Partial<PlantaoProfissional> & { _id: Types.ObjectId; plantaoId: Types.ObjectId };

@Injectable()
export class GoogleAgendaSincronizacaoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GoogleAgendaSincronizacaoService.name);
  private timer?: NodeJS.Timeout;
  private processando = false;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly google: GoogleCalendarClient,
    @InjectModel(IntegracaoGoogleAgenda.name) private readonly integracoes: Model<IntegracaoGoogleAgenda>,
    @InjectModel(EventoGoogleAgenda.name) private readonly eventos: Model<EventoGoogleAgenda>,
    @InjectModel(TarefaGoogleAgenda.name) private readonly tarefas: Model<TarefaGoogleAgenda>,
    @InjectModel(Escala.name) private readonly escalas: Model<Escala>,
    @InjectModel(VersaoEscala.name) private readonly versoes: Model<VersaoEscala>,
    @InjectModel(Setor.name) private readonly setores: Model<Setor>,
  ) {}

  onModuleInit(): void {
    const { workerAtivo, workerIntervaloMs } = this.config.get('googleAgenda', { infer: true });
    if (!workerAtivo) return;
    this.timer = setInterval(() => void this.processarPendentes().catch((erro: unknown) => this.registrarErro('worker', erro)), workerIntervaloMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------------------------------------------------------------- fila

  /**
   * Registra tarefas de sincronização para os profissionais com integração ativa. Quando recebe a `session`,
   * a tarefa nasce na mesma transação da publicação/troca: ou ambas existem, ou nenhuma (sem perda por falha
   * entre o commit e o enfileiramento). Só consulta o banco local; nunca o Google.
   */
  async enfileirar(profissionalIds: Iterable<string | Types.ObjectId>, origem: OrigemTarefaGoogle, session?: ClientSession): Promise<void> {
    const unicos = [...new Set([...profissionalIds].map(String))];
    if (unicos.length === 0) return;
    const consulta = this.integracoes
      .find({ profissionalId: { $in: unicos.map((id) => new Types.ObjectId(id)) }, status: StatusIntegracaoGoogle.CONECTADA }, { profissionalId: 1 });
    if (session) consulta.session(session);
    const conectados = await consulta.lean().exec();
    if (conectados.length === 0) return;
    const agora = new Date();
    await this.tarefas.insertMany(
      conectados.map((integracao) => ({
        profissionalId: integracao.profissionalId,
        origem,
        status: StatusTarefaGoogle.PENDENTE,
        tentativas: 0,
        proximaTentativaEm: agora,
        bloqueadaAte: null,
        ultimoErro: null,
        criadaEm: agora,
      })),
      session ? { session } : {},
    );
  }

  /** Antecipa o processamento sem bloquear quem chamou (a fila durável continua sendo a garantia). */
  acionarProcessamento(): void {
    if (!this.config.get('googleAgenda', { infer: true }).workerAtivo) return;
    setImmediate(() => void this.processarPendentes().catch((erro: unknown) => this.registrarErro('worker', erro)));
  }

  /** Processa as tarefas vencidas. Exposto para o worker e para os testes. */
  async processarPendentes(limite = 25): Promise<number> {
    if (this.processando) return 0;
    this.processando = true;
    let total = 0;
    try {
      while (total < limite) {
        const tarefa = await this.reivindicarTarefa();
        if (!tarefa) break;
        total += 1;
        await this.processarTarefa(tarefa);
      }
    } finally {
      this.processando = false;
    }
    return total;
  }

  private reivindicarTarefa() {
    const agora = new Date();
    return this.tarefas
      .findOneAndUpdate(
        {
          $or: [
            { status: StatusTarefaGoogle.PENDENTE, proximaTentativaEm: { $lte: agora } },
            { status: StatusTarefaGoogle.PROCESSANDO, bloqueadaAte: { $lte: agora } },
          ],
        },
        { $set: { status: StatusTarefaGoogle.PROCESSANDO, bloqueadaAte: new Date(agora.getTime() + LEASE_TAREFA_MS) } },
        { sort: { proximaTentativaEm: 1 }, returnDocument: 'after' },
      )
      .lean()
      .exec();
  }

  private async processarTarefa(tarefa: TarefaGoogleAgenda & { _id: Types.ObjectId }): Promise<void> {
    try {
      const resultado = await this.sincronizar(String(tarefa.profissionalId), { aguardarMs: 0 });
      if (resultado.resultado === 'sucesso') {
        await this.tarefas.updateOne({ _id: tarefa._id }, { $set: { status: StatusTarefaGoogle.CONCLUIDA, bloqueadaAte: null, ultimoErro: null } });
      } else if (resultado.reconexaoNecessaria) {
        await this.tarefas.updateOne({ _id: tarefa._id }, { $set: { status: StatusTarefaGoogle.CANCELADA, bloqueadaAte: null, ultimoErro: resultado.mensagem } });
      } else {
        await this.reagendarComFalha(tarefa, resultado.mensagem);
      }
    } catch (erro) {
      if (erro instanceof SincronizacaoEmAndamentoError) {
        // Não é uma falha: tenta de novo em instantes, sem consumir tentativas.
        await this.tarefas.updateOne(
          { _id: tarefa._id },
          { $set: { status: StatusTarefaGoogle.PENDENTE, bloqueadaAte: null, proximaTentativaEm: new Date(Date.now() + 5_000) } },
        );
      } else if (erro instanceof ConflictException) {
        // Integração desativada ou removida: não há mais o que enviar.
        await this.tarefas.updateOne({ _id: tarefa._id }, { $set: { status: StatusTarefaGoogle.CANCELADA, bloqueadaAte: null, ultimoErro: erro.message } });
      } else {
        this.registrarErro('tarefa', erro);
        await this.reagendarComFalha(tarefa, 'Erro interno ao sincronizar com o Google Agenda.');
      }
    }
  }

  private async reagendarComFalha(tarefa: TarefaGoogleAgenda & { _id: Types.ObjectId }, mensagem: string): Promise<void> {
    const tentativas = tarefa.tentativas + 1;
    if (tentativas >= MAX_TENTATIVAS) {
      await this.tarefas.updateOne(
        { _id: tarefa._id },
        { $set: { status: StatusTarefaGoogle.FALHA, tentativas, bloqueadaAte: null, ultimoErro: mensagem } },
      );
      return;
    }
    const espera = BACKOFF_SEGUNDOS[Math.min(tentativas - 1, BACKOFF_SEGUNDOS.length - 1)];
    await this.tarefas.updateOne(
      { _id: tarefa._id },
      { $set: { status: StatusTarefaGoogle.PENDENTE, tentativas, bloqueadaAte: null, ultimoErro: mensagem, proximaTentativaEm: new Date(Date.now() + espera * 1000) } },
    );
  }

  // ---------------------------------------------------------- sincronização

  /**
   * Sincroniza os plantões oficiais do profissional com o Google Agenda (unidirecional). Serializada por
   * profissional por um lease no banco; sempre lê o estado oficial mais recente no momento da execução.
   */
  async sincronizar(profissionalId: string, opcoes: { aguardarMs?: number } = {}): Promise<ResultadoSincronizacao> {
    const lock = await this.adquirirLock(profissionalId, opcoes.aguardarMs ?? ESPERA_MANUAL_MS);
    const inicioExecucao = new Date();
    const contagem = { criados: 0, atualizados: 0, removidos: 0, inalterados: 0, falhas: 0 };
    let reconexao = false;
    let interrompida = false;
    let ultimoErro = '';

    try {
      let accessToken: string;
      try {
        accessToken = await this.google.renovarAcesso(this.lerRefreshToken(lock.refreshTokenCifrado));
      } catch (erro) {
        if (erro instanceof GoogleReconexaoNecessariaError) {
          return await this.finalizar(lock, inicioExecucao, contagem, { reconexao: true, interrompida: false, erro: erro.message });
        }
        throw erro;
      }

      const corte = new Date(inicioExecucao.getTime() - DIA_MS);
      const desejados = await this.estadoOficial(profissionalId, corte);
      const pid = new Types.ObjectId(profissionalId);
      const registros = await this.eventos.find({ profissionalId: pid }).lean().exec();
      const registroPorPlantao = new Map(registros.map((registro) => [String(registro.plantaoId), registro]));

      for (const desejado of desejados.values()) {
        const registro = registroPorPlantao.get(desejado.plantaoId);
        if (registro?.status === 'sincronizado' && registro.hashConteudo === desejado.hash) {
          contagem.inalterados += 1;
          continue;
        }
        if (!(await this.renovarLock(lock))) {
          interrompida = true;
          break;
        }
        try {
          const efeito = await this.google.gravarEvento(accessToken, lock.calendarId, desejado.googleEventId, desejado.corpo);
          // Só registramos o evento como sincronizado depois da confirmação do Google.
          await this.eventos.updateOne(
            { profissionalId: pid, plantaoId: new Types.ObjectId(desejado.plantaoId) },
            { $set: { googleEventId: desejado.googleEventId, status: 'sincronizado', hashConteudo: desejado.hash, inicio: desejado.inicio, fim: desejado.fim, sincronizadoEm: new Date() } },
            { upsert: true },
          );
          if (efeito === 'criado') contagem.criados += 1;
          else contagem.atualizados += 1;
        } catch (erro) {
          if (erro instanceof GoogleReconexaoNecessariaError) {
            reconexao = true;
            ultimoErro = erro.message;
            break;
          }
          contagem.falhas += 1;
          ultimoErro = this.mensagemSegura(erro);
        }
      }

      // Plantões que o profissional perdeu (troca/realocação): remove apenas o evento criado pelo NurseFlow.
      if (!reconexao && !interrompida) {
        for (const registro of registros) {
          if (registro.status !== 'sincronizado' || desejados.has(String(registro.plantaoId)) || registro.fim < corte) continue;
          if (!(await this.renovarLock(lock))) {
            interrompida = true;
            break;
          }
          try {
            await this.google.removerEvento(accessToken, lock.calendarId, registro.googleEventId);
            await this.eventos.updateOne(
              { _id: registro._id },
              { $set: { status: 'removido', hashConteudo: '', sincronizadoEm: new Date() } },
            );
            contagem.removidos += 1;
          } catch (erro) {
            if (erro instanceof GoogleReconexaoNecessariaError) {
              reconexao = true;
              ultimoErro = erro.message;
              break;
            }
            contagem.falhas += 1;
            ultimoErro = this.mensagemSegura(erro);
          }
        }
      }
    } catch (erro) {
      // Falhas do Google já voltam no resultado devolvido ao chamador; só o inesperado vai para o log.
      if (!(erro instanceof Error && erro.name.startsWith('Google'))) this.registrarErro('sincronizacao', erro);
      contagem.falhas += 1;
      ultimoErro = this.mensagemSegura(erro);
    }
    return this.finalizar(lock, inicioExecucao, contagem, { reconexao, interrompida, erro: ultimoErro });
  }

  private async finalizar(
    lock: IntegracaoGoogleAgenda & { _id: Types.ObjectId },
    inicio: Date,
    contagem: { criados: number; atualizados: number; removidos: number; inalterados: number; falhas: number },
    estado: { reconexao: boolean; interrompida: boolean; erro: string },
  ): Promise<ResultadoSincronizacao> {
    const sucessos = contagem.criados + contagem.atualizados + contagem.removidos + contagem.inalterados;
    let resultado: ResultadoSincronizacao['resultado'];
    let mensagem: string;
    if (estado.reconexao) {
      resultado = 'falha';
      mensagem = 'A autorização do Google Agenda expirou ou foi revogada. Reconecte sua conta para voltar a sincronizar.';
    } else if (estado.interrompida) {
      resultado = 'falha';
      mensagem = 'A sincronização foi interrompida porque a integração foi desativada ou alterada.';
    } else if (contagem.falhas === 0) {
      resultado = 'sucesso';
      const enviados = contagem.criados + contagem.atualizados + contagem.removidos;
      mensagem = enviados === 0 ? 'Sua agenda já estava atualizada.' : `Agenda sincronizada: ${contagem.criados} criado(s), ${contagem.atualizados} atualizado(s), ${contagem.removidos} removido(s).`;
    } else if (sucessos > 0 && contagem.criados + contagem.atualizados + contagem.removidos > 0) {
      resultado = 'parcial';
      mensagem = `Sincronização parcial: ${contagem.falhas} operação(ões) falharam e serão tentadas novamente. ${estado.erro}`.trim();
    } else {
      resultado = 'falha';
      mensagem = `Não foi possível sincronizar com o Google Agenda. ${estado.erro}`.trim();
    }
    const registro: ResultadoSincronizacao = { resultado, ...contagem, reconexaoNecessaria: estado.reconexao, mensagem, em: new Date() };

    // Condicionado ao lease: uma execução que perdeu o lock (ex.: integração desativada) não escreve nada.
    const atualizacao: Record<string, unknown> = {
      ultimoResultado: registro,
      lockToken: null,
      lockExpiraEm: null,
      ...(resultado === 'sucesso' ? { ultimaSincronizacaoEm: registro.em } : {}),
    };
    if (estado.reconexao) {
      atualizacao.status = StatusIntegracaoGoogle.RECONEXAO_NECESSARIA;
      atualizacao.refreshTokenCifrado = null;
    }
    const salvo = await this.integracoes.updateOne({ _id: lock._id, lockToken: lock.lockToken }, { $set: atualizacao });
    if (salvo.matchedCount === 0 && !estado.interrompida) {
      return { ...registro, resultado: 'falha', mensagem: 'A sincronização foi interrompida porque a integração foi desativada ou alterada.' };
    }
    if (estado.reconexao) {
      await this.tarefas.updateMany(
        { profissionalId: lock.profissionalId, status: { $in: [StatusTarefaGoogle.PENDENTE, StatusTarefaGoogle.PROCESSANDO] } },
        { $set: { status: StatusTarefaGoogle.CANCELADA, bloqueadaAte: null, ultimoErro: mensagem } },
      );
    } else if (resultado === 'sucesso') {
      // Tudo o que foi solicitado até o início desta execução já está refletido no estado lido.
      await this.tarefas.updateMany(
        { profissionalId: lock.profissionalId, status: { $in: [StatusTarefaGoogle.PENDENTE, StatusTarefaGoogle.PROCESSANDO] }, criadaEm: { $lte: inicio } },
        { $set: { status: StatusTarefaGoogle.CONCLUIDA, bloqueadaAte: null, ultimoErro: null } },
      );
    }
    return registro;
  }

  /** Estado oficial do profissional: última versão publicada de cada escala, filtrada para plantões ainda relevantes. */
  private async estadoOficial(profissionalId: string, corte: Date): Promise<Map<string, EventoDesejado>> {
    const indiceCorte = corte.getUTCFullYear() * 12 + corte.getUTCMonth();
    const escalas = (await this.escalas.find({ versaoPublicada: { $gte: 1 } }, { _id: 1, ano: 1, mes: 1 }).lean().exec()).filter(
      (escala) => escala.ano * 12 + (escala.mes - 1) >= indiceCorte,
    );
    const desejados = new Map<string, EventoDesejado>();
    if (escalas.length === 0) return desejados;

    const ultimas = await this.versoes
      .aggregate<{ plantoes: PlantaoSnapshot[]; vinculos: VinculoSnapshot[] }>([
        { $match: { escalaId: { $in: escalas.map((escala) => escala._id) } } },
        { $sort: { numero: -1 } },
        { $group: { _id: '$escalaId', plantoes: { $first: '$snapshot.plantoes' }, vinculos: { $first: '$snapshot.profissionaisRelacionados' } } },
      ])
      .exec();

    const meus: { plantao: PlantaoSnapshot; vinculo: VinculoSnapshot }[] = [];
    for (const versao of ultimas) {
      if (!Array.isArray(versao.plantoes) || !Array.isArray(versao.vinculos)) continue;
      const plantaoPorId = new Map(versao.plantoes.map((plantao) => [String(plantao._id), plantao]));
      for (const vinculo of versao.vinculos) {
        if (String(vinculo.profissionalId) !== profissionalId) continue;
        const plantao = plantaoPorId.get(String(vinculo.plantaoId));
        if (plantao) meus.push({ plantao, vinculo });
      }
    }
    if (meus.length === 0) return desejados;

    const setores = await this.setores
      .find({ _id: { $in: [...new Set(meus.map(({ plantao }) => String(plantao.setorId)))].map((id) => new Types.ObjectId(id)) } }, { nome: 1 })
      .lean()
      .exec();
    const nomeSetor = new Map(setores.map((setor) => [String(setor._id), setor.nome]));
    for (const { plantao, vinculo } of meus) {
      const evento = montarEvento({
        profissionalId,
        plantaoId: String(plantao._id),
        data: new Date(plantao.data),
        horarioInicio: plantao.horarioInicio ?? '00:00',
        duracaoHoras: plantao.duracaoHoras ?? 0,
        setorNome: nomeSetor.get(String(plantao.setorId)) ?? 'Setor não informado',
        funcao: vinculo.funcao ?? 'enfermeiro',
        lideranca: vinculo.lideranca ?? false,
        tipo: plantao.tipo ?? 'regular',
      });
      if (evento.fim >= corte) desejados.set(evento.plantaoId, evento);
    }
    return desejados;
  }

  // ------------------------------------------------------------------ lock

  private async adquirirLock(profissionalId: string, aguardarMs: number) {
    const pid = new Types.ObjectId(profissionalId);
    const limite = Date.now() + aguardarMs;
    for (;;) {
      const agora = new Date();
      const lockToken = randomUUID();
      const integracao = await this.integracoes
        .findOneAndUpdate(
          {
            profissionalId: pid,
            status: StatusIntegracaoGoogle.CONECTADA,
            $or: [{ lockExpiraEm: null }, { lockExpiraEm: { $lte: agora } }],
          },
          { $set: { lockToken, lockExpiraEm: new Date(agora.getTime() + LEASE_MS) } },
          { returnDocument: 'after' },
        )
        .lean()
        .exec();
      if (integracao) return integracao;
      const atual = await this.integracoes.findOne({ profissionalId: pid }, { status: 1 }).lean().exec();
      if (!atual || atual.status !== StatusIntegracaoGoogle.CONECTADA) {
        throw new ConflictException(
          atual?.status === StatusIntegracaoGoogle.RECONEXAO_NECESSARIA
            ? 'A autorização do Google Agenda expirou. Reconecte sua conta.'
            : 'A integração com o Google Agenda não está ativa.',
        );
      }
      if (Date.now() >= limite) throw new SincronizacaoEmAndamentoError();
      await new Promise((resolver) => setTimeout(resolver, ESPERA_OCUPADO_MS));
    }
  }

  /** Renova o lease; falso se a integração foi desativada ou se outra execução assumiu o lock. */
  private async renovarLock(lock: IntegracaoGoogleAgenda & { _id: Types.ObjectId }): Promise<boolean> {
    const renovado = await this.integracoes.updateOne(
      { _id: lock._id, lockToken: lock.lockToken, status: StatusIntegracaoGoogle.CONECTADA },
      { $set: { lockExpiraEm: new Date(Date.now() + LEASE_MS) } },
    );
    return renovado.matchedCount === 1;
  }

  private lerRefreshToken(cifrado: string | null): string {
    const chave = this.config.get('googleAgenda', { infer: true }).chaveCriptografia;
    if (!cifrado || !chave) throw new GoogleReconexaoNecessariaError('Credencial do Google Agenda indisponível.');
    try {
      return decifrarSegredo(cifrado, chave);
    } catch {
      throw new GoogleReconexaoNecessariaError('Credencial do Google Agenda ilegível.');
    }
  }

  private mensagemSegura(erro: unknown): string {
    return erro instanceof Error && erro.name.startsWith('Google') ? erro.message : 'Erro inesperado ao sincronizar com o Google Agenda.';
  }

  private registrarErro(contexto: string, erro: unknown): void {
    // Apenas o tipo e a mensagem: nunca tokens, códigos de autorização ou corpos de requisição.
    this.logger.error(`Falha no Google Agenda (${contexto}): ${erro instanceof Error ? `${erro.name}: ${erro.message}` : 'erro desconhecido'}`);
  }
}
