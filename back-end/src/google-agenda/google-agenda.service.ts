import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import type { AppConfig } from '../config/configuration';
import { StatusProfissional } from '../profissionais/profissionais.enums';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import {
  EstadoOauthGoogle,
  EventoGoogleAgenda,
  IntegracaoGoogleAgenda,
  StatusIntegracaoGoogle,
  StatusTarefaGoogle,
  TarefaGoogleAgenda,
} from './google-agenda.schemas';
import { GoogleAgendaSincronizacaoService } from './google-agenda-sincronizacao.service';
import { ESCOPO_GOOGLE_EVENTOS, GoogleCalendarClient } from './google-calendar.client';
import { cifrarSegredo, decifrarSegredo } from './token-cipher';

const VALIDADE_STATE_MS = 10 * 60_000;

export type EstadoIntegracao = 'nao_conectada' | 'conectada' | 'desativada' | 'reconexao_necessaria';
export type MotivoRetornoConexao = 'conectada' | 'negada' | 'permissao_insuficiente' | 'estado_invalido' | 'falha';

const hashDoState = (state: string) => createHash('sha256').update(state).digest('hex');

/** Conexão OAuth, estado e desativação. Cada operação é escopada pelo `profissionalId` do JWT. */
@Injectable()
export class GoogleAgendaService {
  private readonly logger = new Logger(GoogleAgendaService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly google: GoogleCalendarClient,
    private readonly sincronizacao: GoogleAgendaSincronizacaoService,
    @InjectModel(IntegracaoGoogleAgenda.name) private readonly integracoes: Model<IntegracaoGoogleAgenda>,
    @InjectModel(EventoGoogleAgenda.name) private readonly eventos: Model<EventoGoogleAgenda>,
    @InjectModel(TarefaGoogleAgenda.name) private readonly tarefas: Model<TarefaGoogleAgenda>,
    @InjectModel(EstadoOauthGoogle.name) private readonly estados: Model<EstadoOauthGoogle>,
    @InjectModel(Profissional.name) private readonly profissionais: Model<Profissional>,
  ) {}

  private get cfg() {
    return this.config.get('googleAgenda', { infer: true });
  }

  async estado(profissionalId: string) {
    const pid = this.idProfissional(profissionalId);
    const [integracao, pendentes] = await Promise.all([
      this.integracoes.findOne({ profissionalId: pid }).lean().exec(),
      this.tarefas.countDocuments({ profissionalId: pid, status: { $in: [StatusTarefaGoogle.PENDENTE, StatusTarefaGoogle.PROCESSANDO] } }).exec(),
    ]);
    const estado: EstadoIntegracao = integracao?.status ?? 'nao_conectada';
    const resultado = integracao?.ultimoResultado ?? null;
    return {
      configurada: this.cfg.configurada,
      estado,
      ultimaSincronizacaoEm: integracao?.ultimaSincronizacaoEm ?? null,
      pendentes,
      // Nunca devolve tokens; apenas o resumo da última execução.
      ultimoResultado: resultado
        ? {
            resultado: resultado.resultado,
            mensagem: resultado.mensagem,
            em: resultado.em,
            criados: resultado.criados,
            atualizados: resultado.atualizados,
            removidos: resultado.removidos,
            falhas: resultado.falhas,
          }
        : null,
      reconexaoNecessaria: estado === 'reconexao_necessaria',
    };
  }

  /** Gera a URL de consentimento do Google com um `state` de uso único vinculado ao profissional. */
  async iniciarConexao(profissionalId: string): Promise<{ url: string }> {
    if (!this.cfg.configurada) {
      throw new ServiceUnavailableException('A integração com o Google Agenda não está configurada neste ambiente.');
    }
    const pid = this.idProfissional(profissionalId);
    const profissional = await this.profissionais.findById(pid, { status: 1 }).lean().exec();
    if (!profissional) throw new NotFoundException('Profissional autenticado não encontrado.');
    if (profissional.status === StatusProfissional.DESATIVADO) {
      throw new ConflictException('Profissionais desativados não podem conectar o Google Agenda.');
    }
    const state = randomBytes(32).toString('base64url');
    await this.estados.create({ stateHash: hashDoState(state), profissionalId: pid, expiraEm: new Date(Date.now() + VALIDADE_STATE_MS), usadoEm: null });
    return { url: this.google.urlAutorizacao(state) };
  }

  /**
   * Conclui o OAuth (callback público chamado pelo navegador, sem JWT). A identidade vem exclusivamente do `state`,
   * consumido de forma atômica. Devolve para onde o navegador deve voltar no frontend.
   */
  async concluirConexao(entrada: { code?: string; state?: string; error?: string }): Promise<string> {
    const retorno = (motivo: MotivoRetornoConexao) => `${this.cfg.frontendUrl}/?google_agenda=${motivo}`;
    if (!this.cfg.configurada || !entrada.state) return retorno('estado_invalido');

    const estado = await this.estados
      .findOneAndUpdate(
        { stateHash: hashDoState(entrada.state), usadoEm: null, expiraEm: { $gt: new Date() } },
        { $set: { usadoEm: new Date() } },
      )
      .lean()
      .exec();
    if (!estado) return retorno('estado_invalido');
    if (entrada.error || !entrada.code) return retorno(entrada.error === 'access_denied' ? 'negada' : 'falha');

    try {
      const troca = await this.google.trocarCodigo(entrada.code);
      if (!troca.escopo.split(' ').includes(ESCOPO_GOOGLE_EVENTOS)) return retorno('permissao_insuficiente');
      if (!troca.refreshToken) return retorno('falha');
      const chave = this.cfg.chaveCriptografia;
      if (!chave) return retorno('falha');

      const agora = new Date();
      await this.integracoes.updateOne(
        { profissionalId: estado.profissionalId },
        {
          $set: {
            status: StatusIntegracaoGoogle.CONECTADA,
            refreshTokenCifrado: cifrarSegredo(troca.refreshToken, chave),
            escopo: troca.escopo,
            calendarId: 'primary',
            conectadaEm: agora,
            desativadaEm: null,
            ultimoResultado: null,
            lockToken: null,
            lockExpiraEm: null,
          },
          $setOnInsert: { ultimaSincronizacaoEm: null },
        },
        { upsert: true },
      );
      await this.profissionais.updateOne({ _id: estado.profissionalId }, { $set: { sincronizaAgenda: true } });
      // A conta pode ser outra: força o reenvio por id fixo (sem duplicar se for a mesma agenda).
      await this.eventos.updateMany({ profissionalId: estado.profissionalId }, { $set: { hashConteudo: '' } });
      await this.sincronizacao.enfileirar([estado.profissionalId], 'conexao');
      this.sincronizacao.acionarProcessamento();
      return retorno('conectada');
    } catch (erro) {
      this.logger.error(`Falha ao concluir a conexão com o Google Agenda: ${erro instanceof Error ? erro.name : 'erro'}`);
      return retorno('falha');
    }
  }

  /** Sincronização manual (DA27): só responde quando o processamento termina. */
  async sincronizarAgora(profissionalId: string) {
    const resultado = await this.sincronizacao.sincronizar(this.idProfissional(profissionalId).toString());
    return { ...resultado, estado: await this.estado(profissionalId) };
  }

  /** Interrompe novos envios e preserva os eventos já exportados. Idempotente. */
  async desativar(profissionalId: string) {
    const pid = this.idProfissional(profissionalId);
    const integracao = await this.integracoes.findOne({ profissionalId: pid }).lean().exec();
    if (integracao && integracao.status !== StatusIntegracaoGoogle.DESATIVADA) {
      await this.integracoes.updateOne(
        { _id: integracao._id },
        { $set: { status: StatusIntegracaoGoogle.DESATIVADA, refreshTokenCifrado: null, desativadaEm: new Date(), lockToken: null, lockExpiraEm: null } },
      );
      await this.tarefas.updateMany(
        { profissionalId: pid, status: { $in: [StatusTarefaGoogle.PENDENTE, StatusTarefaGoogle.PROCESSANDO] } },
        { $set: { status: StatusTarefaGoogle.CANCELADA, bloqueadaAte: null } },
      );
      await this.revogarMelhorEsforco(integracao.refreshTokenCifrado);
    }
    await this.profissionais.updateOne({ _id: pid }, { $set: { sincronizaAgenda: false } });
    return this.estado(profissionalId);
  }

  private async revogarMelhorEsforco(cifrado: string | null): Promise<void> {
    const chave = this.cfg.chaveCriptografia;
    if (!cifrado || !chave) return;
    try {
      await this.google.revogar(decifrarSegredo(cifrado, chave));
    } catch {
      // A desativação local já ocorreu; o token cifrado foi descartado.
    }
  }

  private idProfissional(profissionalId: string): Types.ObjectId {
    if (!profissionalId || !Types.ObjectId.isValid(profissionalId)) {
      throw new BadRequestException('Profissional autenticado inválido.');
    }
    return new Types.ObjectId(profissionalId);
  }
}
