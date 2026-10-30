import { ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { type ClientSession, type Connection, Model, Types } from 'mongoose';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { executarTransacao } from '../common/utils/mongo-transaction';
import { utcDate } from '../common/utils/date';
import type { AppConfig } from '../config/configuration';
import { chaveCarga } from '../configuracoes/configuracao.schema';
import { ConfiguracoesService } from '../configuracoes/configuracoes.service';
import { StatusProfissional } from '../profissionais/profissionais.enums';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { Restricao } from '../restricoes/restricao.schema';
import { Setor } from '../setores/schemas/setor.schema';
import { Administrador } from '../usuarios/schemas/administrador.schema';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import type { LotePlantoesDto, PlantaoAlteracaoDto, PlantaoDto } from './dto/plantao.dto';
import type { GerarEscalaDto } from './dto/gerar-escala.dto';
import type { PeriodoEscalaDto, PublicarEscalaDto } from './dto/escala.dto';
import {
  type ConfiguracaoVigente,
  diasDoMes,
  type Mensagem,
  montarProblema,
  type PlantaoAnterior,
  type ProfissionalEntrada,
  validarEntrada,
} from './montar-problema';
import { OtimizadorEscala, type OpcaoPlantao } from './otimizador/otimizador';
import { isVisualizacaoEscalaPdf, type DadosEscalaPdf } from './escala-pdf.types';
import {
  calcularPendenciasCobertura,
  type AlocacaoPlantaoValidacao,
  type ResumoCobertura,
  resumirCobertura,
  validarAlocacoesPlantao,
} from './regras-plantao';
import {
  AuditoriaEscala,
  Escala,
  NotificacaoEscala,
  OrigemCobertura,
  Plantao,
  PlantaoProfissional,
  StatusEscala,
  TipoPlantao,
  VersaoEscala,
} from './schemas';

const MS_DIA = 86_400_000;

const HORARIOS: Record<OpcaoPlantao, { inicio: string; fim: string; horas: number }> = {
  '24h': { inicio: '07:00', fim: '07:00', horas: 24 },
  '12d': { inicio: '07:00', fim: '19:00', horas: 12 },
  '12n': { inicio: '19:00', fim: '07:00', horas: 12 },
};

const rotuloPeriodo = (ano: number, mes: number) => `${String(mes).padStart(2, '0')}/${String(ano).padStart(4, '0')}`;
const isoDia = (d: Date) => d.toISOString().slice(0, 10);

interface SnapshotEscala {
  escala?: { geracao?: Record<string, unknown> };
  geracao?: Record<string, unknown>;
  plantoes: (Partial<Plantao> & { _id: Types.ObjectId; escalaId?: Types.ObjectId })[];
  profissionaisRelacionados: (Partial<PlantaoProfissional> & { _id: Types.ObjectId; plantaoId: Types.ObjectId })[];
  pendencias?: unknown[];
  conflitos?: Mensagem[];
  avisos?: Mensagem[];
  cargas?: unknown[];
}

interface GeracaoEmAndamento {
  controller: AbortController;
  estado: 'otimizando' | 'cancelando' | 'salvando';
}

interface AlteracaoPlantaoPreparada {
  dto: PlantaoAlteracaoDto;
  plantaoId: Types.ObjectId;
  novo: boolean;
  setorId: Types.ObjectId;
  data: Date;
  horarioInicio: string;
  horarioFim: string;
  duracaoHoras: number;
}

function isSnapshotEscala(snapshot: Record<string, unknown>): snapshot is Record<string, unknown> & SnapshotEscala {
  return Array.isArray(snapshot.plantoes) && Array.isArray(snapshot.profissionaisRelacionados);
}

@Injectable()
export class EscalasService {
  private readonly logger = new Logger(EscalasService.name);
  /** Impede duas gerações simultâneas do mesmo período nesta instância (o índice único cobre o resto). */
  private readonly emAndamento = new Set<string>();
  private readonly geracoes = new Map<string, GeracaoEmAndamento>();

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(AuditoriaEscala.name) private readonly auditoria: Model<AuditoriaEscala>,
    @InjectModel(Escala.name) private readonly escalas: Model<Escala>,
    @InjectModel(NotificacaoEscala.name) private readonly notificacoes: Model<NotificacaoEscala>,
    @InjectModel(VersaoEscala.name) private readonly versoes: Model<VersaoEscala>,
    @InjectModel(Plantao.name) private readonly plantoes: Model<Plantao>,
    @InjectModel(PlantaoProfissional.name) private readonly relacionados: Model<PlantaoProfissional>,
    @InjectModel(Profissional.name) private readonly profissionais: Model<Profissional>,
    @InjectModel(Usuario.name) private readonly usuarios: Model<Usuario>,
    @InjectModel(Administrador.name) private readonly administradores: Model<Administrador>,
    @InjectModel(Setor.name) private readonly setores: Model<Setor>,
    @InjectModel(Restricao.name) private readonly restricoes: Model<Restricao>,
    private readonly configuracoes: ConfiguracoesService,
    private readonly otimizador: OtimizadorEscala,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** RF005/US07: gera a escala do mês como RASCUNHO. */
  async gerar(dto: GerarEscalaDto, usuario: UsuarioAutenticado) {
    const periodo = `${dto.ano}-${dto.mes}`;
    if (this.emAndamento.has(periodo)) {
      throw new ConflictException(`Já existe uma geração em andamento para ${rotuloPeriodo(dto.ano, dto.mes)}.`);
    }
    const operacaoId = dto.operacaoId ?? randomUUID();
    if (this.geracoes.has(operacaoId)) {
      throw new ConflictException('Já existe uma geração em andamento com esse identificador.');
    }
    const geracao: GeracaoEmAndamento = { controller: new AbortController(), estado: 'otimizando' };
    this.emAndamento.add(periodo);
    this.geracoes.set(operacaoId, geracao);
    try {
      return await this.gerarPeriodo({ ...dto, operacaoId }, usuario, geracao);
    } catch (erro) {
      if (geracao.estado === 'cancelando' || geracao.controller.signal.aborted) {
        throw new ConflictException('Geração cancelada. Nenhuma escala foi salva.');
      }
      throw erro;
    } finally {
      this.emAndamento.delete(periodo);
      this.geracoes.delete(operacaoId);
    }
  }

  async cancelarGeracao(operacaoId: string) {
    const geracao = this.geracoes.get(operacaoId);
    if (!geracao) throw new NotFoundException('Não há geração em andamento com esse identificador.');
    if (geracao.estado !== 'otimizando') {
      throw new ConflictException('A geração já está finalizando e não pode mais ser cancelada.');
    }

    geracao.estado = 'cancelando';
    try {
      await this.otimizador.cancelar(operacaoId);
    } finally {
      geracao.controller.abort();
    }
    return { operacaoId, cancelamentoSolicitado: true };
  }

  async obter(id: string) {
    const escala = await this.escalas.findById(id).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    return this.montarResposta(escala);
  }

  async listarPorPeriodo(ano: number, mes: number) {
    const escala = await this.escalas.findOne({ ano, mes }).lean().exec();
    return escala ? [await this.montarResposta(escala)] : [];
  }

  async criarRascunho(periodo: PeriodoEscalaDto, usuario: UsuarioAutenticado) {
    const administradorId = await this.administradorDe(usuario.id);
    const configuracao = await this.configuracoes.consultar(periodo.ano, periodo.mes);
    const setoresAtivos = await this.setores.find({ ativo: true }).lean().exec();
    const turnos: ('diurno' | 'noturno')[] = ['diurno', 'noturno'];
    const pendencias = calcularPendenciasCobertura({
      ...periodo,
      setores: setoresAtivos.map((setor) => ({ id: String(setor._id), nome: setor.nome, turnos: setor.turnos })),
      alocacoes: [],
      turnos,
    });
    const cobertura = resumirCobertura({ ...periodo, setores: setoresAtivos, turnos, pendencias });
    try {
      const escala = await this.escalas.create({
        ...periodo,
        administradorId,
        status: StatusEscala.RASCUNHO,
        geracao: {
          origem: 'manual',
          configuracao,
          escopo: { setorIds: setoresAtivos.map((setor) => String(setor._id)), turnos },
          resumo: { alocacoes: 0, vagasDescobertas: pendencias.length, extras: 0, cobertura },
          pendencias,
        },
      });
      return this.obter(String(escala._id));
    } catch (erro) {
      if ((erro as { code?: number }).code === 11000) {
        throw new ConflictException(`Já existe uma escala para ${rotuloPeriodo(periodo.ano, periodo.mes)}.`);
      }
      throw erro;
    }
  }

  async removerRascunho(id: string, confirmado: boolean, revisaoEsperada: number): Promise<void> {
    if (!confirmado) throw new ConflictException('A remoção exige confirmação explícita.');
    await executarTransacao(this.connection, async (session) => {
      const escala = await this.escalas.findById(id).session(session).lean().exec();
      if (!escala) throw new NotFoundException('Escala não encontrada.');
      this.conferirRevisao(escala.revisao, revisaoEsperada);
      if (escala.status !== StatusEscala.RASCUNHO) {
        throw new ConflictException('Somente escalas em rascunho podem ser removidas.');
      }

      await this.removerConteudo(escala._id, session);
      const removida = await this.escalas.deleteOne(
        { _id: escala._id, status: StatusEscala.RASCUNHO, revisao: revisaoEsperada },
        { session },
      );
      if (removida.deletedCount !== 1) {
        throw new ConflictException('A escala deixou de ser um rascunho e não pode ser removida.');
      }
    });
  }

  async iniciarRevisao(id: string, revisaoEsperada: number, usuario: UsuarioAutenticado) {
    await executarTransacao(this.connection, async (session) => {
      const escala = await this.escalas.findById(id).session(session).lean().exec();
      if (!escala) throw new NotFoundException('Escala não encontrada.');
      this.conferirRevisao(escala.revisao, revisaoEsperada);
      if (escala.status !== StatusEscala.RASCUNHO && escala.status !== StatusEscala.PUBLICADA) {
        throw new ConflictException('Somente um rascunho ou uma escala publicada pode iniciar a revisão.');
      }

      let versaoBase: number | undefined;
      let geracaoBase: Record<string, unknown> | undefined;
      if (escala.status === StatusEscala.PUBLICADA) {
        const versao = await this.versoes
          .findOne({ escalaId: escala._id })
          .sort({ numero: -1 })
          .session(session)
          .lean()
          .exec();
        if (!versao) throw new NotFoundException('A escala publicada não possui uma versão oficial disponível.');
        const snapshot = versao.snapshot;
        if (!isSnapshotEscala(snapshot)) {
          throw new ConflictException('O snapshot publicado não possui os dados necessários para iniciar uma revisão.');
        }
        geracaoBase = snapshot.escala?.geracao ?? snapshot.geracao;

        await this.removerConteudo(escala._id, session);
        if (snapshot.plantoes.length > 0) {
          await this.plantoes.insertMany(
            snapshot.plantoes.map((plantao) => ({ ...plantao, escalaId: escala._id })),
            { session },
          );
        }
        if (snapshot.profissionaisRelacionados.length > 0) {
          await this.relacionados.insertMany(snapshot.profissionaisRelacionados, { session });
        }
        versaoBase = versao.numero;
      }

      const revisao = escala.revisao + 1;
      const atualizada = await this.escalas.updateOne(
        { _id: escala._id, status: escala.status, revisao: revisaoEsperada },
        {
          $set: {
            status: StatusEscala.EM_REVISAO,
            ...(geracaoBase === undefined ? {} : { geracao: geracaoBase }),
          },
          $unset: { validacao: 1 },
          $inc: { revisao: 1 },
        },
        { session },
      );
      if (atualizada.matchedCount !== 1) throw new ConflictException('A escala foi atualizada por outra operação.');
      await this.auditoria.create(
        [{
          escalaId: escala._id,
          revisao,
          acao: 'revisao_iniciada',
          usuarioId: new Types.ObjectId(usuario.id),
          ...(versaoBase === undefined ? {} : { detalhes: { versaoBase } }),
        }],
        { session },
      );
    });
    return this.obter(id);
  }

  async obterVersaoOficial(id: string) {
    const escala = await this.escalas.findById(id).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    const versao = await this.versoes.findOne({ escalaId: escala._id }).sort({ numero: -1 }).lean().exec();
    if (!versao) throw new NotFoundException('A escala ainda não possui uma versão oficial publicada.');
    return {
      versao: {
        numero: versao.numero,
        ano: versao.ano,
        mes: versao.mes,
        publicadoPor: String(versao.publicadoPor),
        publicadoEm: versao.publicadoEm,
        pendenciasConfirmadas: versao.pendenciasConfirmadas,
      },
      snapshot: await this.snapshotComVisualizacao(escala, versao.snapshot),
    };
  }

  async obterDadosPdf(id: string): Promise<DadosEscalaPdf> {
    const oficial = await this.obterVersaoOficial(id);
    const visualizacao = oficial.snapshot.visualizacao;
    if (!isVisualizacaoEscalaPdf(visualizacao)) {
      throw new ConflictException('A versão oficial não contém dados suficientes para exportação.');
    }
    return {
      ...visualizacao,
      numero: oficial.versao.numero,
      publicadoEm: new Date(oficial.versao.publicadoEm),
    };
  }

  async listarAuditoria(id: string) {
    const escala = await this.escalas.findById(id, { _id: 1 }).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    const eventos = await this.auditoria.find({ escalaId: escala._id }).sort({ ocorridoEm: -1 }).lean().exec();
    return {
      escalaId: id,
      auditoria: eventos.map((evento) => ({
        id: String(evento._id),
        revisao: evento.revisao,
        acao: evento.acao,
        usuarioId: String(evento.usuarioId),
        ocorridoEm: evento.ocorridoEm,
        detalhes: evento.detalhes ?? null,
      })),
    };
  }

  async validarEscala(id: string, revisaoEsperada: number, usuario: UsuarioAutenticado) {
    await executarTransacao(this.connection, async (session) => {
      const escala = await this.escalas.findById(id).session(session).lean().exec();
      if (!escala) throw new NotFoundException('Escala não encontrada.');
      this.conferirRevisao(escala.revisao, revisaoEsperada);
      if (escala.status !== StatusEscala.EM_REVISAO) {
        throw new ConflictException('A escala precisa estar em revisão antes de ser validada.');
      }

      const cobertura = await this.validarEscalaAtual(escala, session);
      const revisao = escala.revisao + 1;
      const validacao = {
        revisao,
        validadoPor: new Types.ObjectId(usuario.id),
        validadoEm: new Date(),
        cobertura,
      };
      const atualizada = await this.escalas.updateOne(
        { _id: escala._id, status: StatusEscala.EM_REVISAO, revisao: revisaoEsperada },
        { $set: { status: StatusEscala.VALIDADA, validacao }, $inc: { revisao: 1 } },
        { session },
      );
      if (atualizada.matchedCount !== 1) throw new ConflictException('A escala foi atualizada por outra operação.');
      await this.auditoria.create(
        [{ escalaId: escala._id, revisao, acao: 'escala_validada', usuarioId: new Types.ObjectId(usuario.id), detalhes: { cobertura } }],
        { session },
      );
    });
    return this.obter(id);
  }

  async publicarEscala(id: string, dto: PublicarEscalaDto, usuario: UsuarioAutenticado) {
    await executarTransacao(this.connection, async (session) => {
      const escala = await this.escalas.findById(id).session(session).lean().exec();
      if (!escala) throw new NotFoundException('Escala não encontrada.');

      if (escala.status === StatusEscala.PUBLICADA && escala.revisao === dto.revisaoEsperada + 1) return;

      this.conferirRevisao(escala.revisao, dto.revisaoEsperada);
      if (escala.status !== StatusEscala.VALIDADA) {
        throw new ConflictException('A escala precisa estar validada antes de ser publicada.');
      }

      await this.validarEscalaAtual(escala, session);
      const escalaValidada = await this.escalas.findById(escala._id).session(session).lean().exec();
      if (!escalaValidada) throw new NotFoundException('Escala não encontrada.');

      const geracao = (escalaValidada.geracao ?? {}) as {
        pendencias?: unknown[];
        conflitos?: Mensagem[];
        avisos?: Mensagem[];
        cargas?: unknown[];
      };
      const pendencias = geracao.pendencias ?? [];
      const conflitos = geracao.conflitos ?? [];
      const avisos = geracao.avisos ?? [];
      const conflitosBloqueantes = conflitos.filter((item) => item.tipo !== 'CARGA_ABAIXO_DO_ESPERADO');
      if (conflitosBloqueantes.length > 0) {
        throw new UnprocessableEntityException({
          message: 'A escala contém conflitos bloqueantes.',
          erros: conflitosBloqueantes.map((item) => item.motivo),
        });
      }

      const requerConfirmacao = pendencias.length > 0 || conflitos.length > 0 || avisos.length > 0;
      if (requerConfirmacao && !dto.confirmarPendencias) {
        throw new ConflictException({
          message: 'Confirme explicitamente a publicação com as pendências e alertas apresentados.',
          pendencias,
          conflitos,
          avisos,
        });
      }

      const numero = (escalaValidada.versaoPublicada ?? 0) + 1;
      const revisao = escalaValidada.revisao + 1;
      const atualizada = await this.escalas.updateOne(
        { _id: escala._id, status: StatusEscala.VALIDADA, revisao: dto.revisaoEsperada },
        { $set: { status: StatusEscala.PUBLICADA, versaoPublicada: numero }, $inc: { revisao: 1 } },
        { session },
      );
      if (atualizada.matchedCount !== 1) throw new ConflictException('A escala foi atualizada por outra operação.');

      const escalaPublicada = await this.escalas.findById(escala._id).session(session).lean().exec();
      if (!escalaPublicada) throw new NotFoundException('Escala não encontrada.');
      const plantoes = await this.plantoes
        .find({ escalaId: escala._id })
        .sort({ data: 1, horarioInicio: 1 })
        .session(session)
        .lean()
        .exec();
      const idsPlantoes = plantoes.map((plantao) => plantao._id);
      const profissionaisRelacionados = idsPlantoes.length
        ? await this.relacionados.find({ plantaoId: { $in: idsPlantoes } }).session(session).lean().exec()
        : [];
      const snapshot = {
        escala: escalaPublicada,
        plantoes,
        profissionaisRelacionados,
        pendencias,
        conflitos,
        avisos,
        cargas: geracao['cargas'] ?? [],
        visualizacao: await this.montarResposta(escalaPublicada, session),
      };
      const versaoAnterior = await this.versoes
        .findOne({ escalaId: escala._id })
        .sort({ numero: -1 })
        .session(session)
        .lean()
        .exec();
      const publicadoEm = new Date();
      const administradorId = await this.administradorDe(usuario.id, session);
      await this.versoes.create(
        [{
          escalaId: escala._id,
          numero,
          mes: escala.mes,
          ano: escala.ano,
          publicadoPor: administradorId,
          publicadoEm,
          snapshot,
          pendenciasConfirmadas: requerConfirmacao && Boolean(dto.confirmarPendencias),
        }],
        { session },
      );
      await this.registrarNotificacoesPublicacao(
        escala._id,
        numero,
        escala.ano,
        escala.mes,
        snapshot,
        versaoAnterior?.snapshot,
        session,
      );
      await this.auditoria.create(
        [{
          escalaId: escala._id,
          revisao,
          acao: 'escala_publicada',
          usuarioId: new Types.ObjectId(usuario.id),
          ocorridoEm: publicadoEm,
          detalhes: { numero, pendenciasConfirmadas: requerConfirmacao && Boolean(dto.confirmarPendencias) },
        }],
        { session },
      );
    });
    return this.obter(id);
  }

  async listarNotificacoes(usuarioId: string) {
    const destinatarioId = new Types.ObjectId(usuarioId);
    const [notificacoes, naoLidas] = await Promise.all([
      this.notificacoes
        .find({ destinatarioId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .exec(),
      this.notificacoes.countDocuments({ destinatarioId, lidaEm: null }).exec(),
    ]);
    return {
      notificacoes: notificacoes.map((item) => ({
        id: String(item._id),
        escalaId: String(item.escalaId),
        versao: item.versao,
        eventKey: item.eventKey,
        titulo: item.titulo,
        mensagem: item.mensagem,
        criadoEm: item.createdAt,
        lidaEm: item.lidaEm ?? null,
      })),
      naoLidas,
    };
  }

  async marcarNotificacaoLida(id: string, usuarioId: string) {
    const filtro = { _id: new Types.ObjectId(id), destinatarioId: new Types.ObjectId(usuarioId) };
    const atualizada = await this.notificacoes
      .findOneAndUpdate({ ...filtro, lidaEm: null }, { $set: { lidaEm: new Date() } }, { returnDocument: 'after' })
      .lean()
      .exec();
    const notificacao = atualizada ?? (await this.notificacoes.findOne(filtro).lean().exec());
    if (!notificacao) throw new NotFoundException('Notificação não encontrada.');
    return {
      id: String(notificacao._id),
      lidaEm: notificacao.lidaEm ?? null,
    };
  }

  async obterVersaoNotificada(escalaId: string, numero: number, usuarioId: string) {
    const escala = await this.escalas.findById(escalaId).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    const escalaObjectId = new Types.ObjectId(escalaId);
    const destinatarioId = new Types.ObjectId(usuarioId);
    const notificacao = await this.notificacoes
      .findOne({ escalaId: escalaObjectId, versao: numero, destinatarioId })
      .lean()
      .exec();
    if (!notificacao) throw new NotFoundException('Versão de escala não encontrada para o usuário autenticado.');

    const versao = await this.versoes.findOne({ escalaId: escalaObjectId, numero }).lean().exec();
    if (!versao) throw new NotFoundException('Versão oficial não encontrada.');
    return {
      versao: {
        numero: versao.numero,
        ano: versao.ano,
        mes: versao.mes,
        publicadoPor: String(versao.publicadoPor),
        publicadoEm: versao.publicadoEm,
        pendenciasConfirmadas: versao.pendenciasConfirmadas,
      },
      snapshot: await this.snapshotComVisualizacao(escala, versao.snapshot),
    };
  }

  private async registrarNotificacoesPublicacao(
    escalaId: Types.ObjectId,
    numero: number,
    ano: number,
    mes: number,
    snapshotAtual: SnapshotEscala,
    snapshotAnterior: Record<string, unknown> | undefined,
    session: ClientSession,
  ) {
    const atuais = this.alocacoesPorProfissional(snapshotAtual);
    const anteriores = snapshotAnterior && isSnapshotEscala(snapshotAnterior)
      ? this.alocacoesPorProfissional(snapshotAnterior)
      : new Map<string, string[]>();
    const profissionaisAfetados = snapshotAnterior
      ? [...new Set([...atuais.keys(), ...anteriores.keys()])].filter(
          (id) => JSON.stringify(atuais.get(id) ?? []) !== JSON.stringify(anteriores.get(id) ?? []),
        )
      : [...atuais.keys()];
    if (profissionaisAfetados.length === 0) return;

    const profissionais = await this.profissionais
      .find({ _id: { $in: profissionaisAfetados.map((id) => new Types.ObjectId(id)) } }, { usuarioId: 1 })
      .session(session)
      .lean()
      .exec();
    const destinatarios = [...new Set(profissionais.map((item) => String(item.usuarioId)))];
    if (destinatarios.length === 0) return;

    const eventKey = `escala:${String(escalaId)}:versao:${numero}`;
    await this.notificacoes.insertMany(
      destinatarios.map((destinatarioId) => ({
        escalaId,
        versao: numero,
        destinatarioId: new Types.ObjectId(destinatarioId),
        eventKey,
        titulo: `Escala ${String(mes).padStart(2, '0')}/${ano} publicada`,
        mensagem: `A escala de ${String(mes).padStart(2, '0')}/${ano} foi publicada na versão ${numero}.`,
        lidaEm: null,
      })),
      { session },
    );
  }

  private alocacoesPorProfissional(snapshot: SnapshotEscala): Map<string, string[]> {
    const plantoes = new Map(snapshot.plantoes.map((item) => [String(item._id), item]));
    const alocacoes = new Map<string, Set<string>>();
    for (const vinculo of snapshot.profissionaisRelacionados) {
      if (!vinculo.profissionalId) continue;
      const plantao = plantoes.get(String(vinculo.plantaoId));
      if (!plantao?.data) continue;
      const profissionalId = String(vinculo.profissionalId);
      const assinaturas = alocacoes.get(profissionalId) ?? new Set<string>();
      assinaturas.add(
        JSON.stringify([
          new Date(plantao.data).toISOString(),
          String(plantao.setorId),
          plantao.horarioInicio,
          plantao.horarioFim,
          plantao.duracaoHoras,
          plantao.tipo,
          vinculo.funcao,
        ]),
      );
      alocacoes.set(profissionalId, assinaturas);
    }
    return new Map([...alocacoes].map(([id, assinaturas]) => [id, [...assinaturas].sort()]));
  }

  private conferirRevisao(atual: number, esperada: number) {
    if (atual !== esperada) {
      throw new ConflictException('A escala foi atualizada desde a última consulta. Recarregue os dados antes de continuar.');
    }
  }

  private async validarEscalaAtual(escala: Escala & { _id: Types.ObjectId }, session: ClientSession) {
    const plantoes = await this.plantoes.find({ escalaId: escala._id }).session(session).lean().exec();
    const idsPlantoes = plantoes.map((item) => item._id);
    const vinculos = idsPlantoes.length
      ? await this.relacionados.find({ plantaoId: { $in: idsPlantoes } }).session(session).lean().exec()
      : [];
    const idsProfissionais = [...new Map(vinculos.map((item) => [String(item.profissionalId), item.profissionalId])).values()];
    const profissionaisDocs = idsProfissionais.length
      ? await this.profissionais.find({ _id: { $in: idsProfissionais } }).session(session).lean().exec()
      : [];
    if (profissionaisDocs.length !== idsProfissionais.length) {
      throw new UnprocessableEntityException({ message: 'A escala contém profissional inexistente.', erros: ['Corrija as alocações antes da validação.'] });
    }
    const nomes = await this.nomesDosUsuarios(profissionaisDocs.map((item) => item.usuarioId));
    const profissionais = new Map(
      profissionaisDocs.map((item) => [
        String(item._id),
        {
          id: String(item._id),
          nome: nomes.get(String(item.usuarioId)) ?? String(item._id),
          formacao: item.formacao,
          tipoVinculo: item.tipoVinculo,
          status: item.status,
        },
      ]),
    );
    const plantaoPorId = new Map(plantoes.map((item) => [String(item._id), item]));
    const alocacoes: AlocacaoPlantaoValidacao[] = vinculos.flatMap((vinculo) => {
      const plantao = plantaoPorId.get(String(vinculo.plantaoId));
      const profissional = profissionais.get(String(vinculo.profissionalId));
      if (!plantao || !profissional) return [];
      return [{
        profissional,
        funcao: vinculo.funcao as AlocacaoPlantaoValidacao['funcao'],
        data: plantao.data,
        horarioInicio: plantao.horarioInicio,
        duracaoHoras: plantao.duracaoHoras,
        tipo: plantao.tipo,
      }];
    });
    const inicioMes = utcDate(escala.ano, escala.mes - 1, 1);
    const fimMes = utcDate(escala.ano, escala.mes - 1, diasDoMes(escala.ano, escala.mes), 23, 59, 59, 999);
    const restricoes = idsProfissionais.length
      ? await this.restricoes
          .find({ profissionalId: { $in: idsProfissionais }, inicio: { $lte: fimMes }, fim: { $gte: inicioMes } })
          .session(session)
          .lean()
          .exec()
      : [];
    const geracao = (escala.geracao ?? {}) as { configuracao?: ConfiguracaoVigente };
    const configuracao =
      geracao.configuracao ?? ((await this.configuracoes.consultar(escala.ano, escala.mes)) as ConfiguracaoVigente);
    const erros = validarAlocacoesPlantao({
      ano: escala.ano,
      mes: escala.mes,
      configuracao,
      restricoes: restricoes.map((item) => ({
        profissionalId: String(item.profissionalId),
        tipo: item.tipo,
        inicio: item.inicio,
        fim: item.fim,
        diaSemana: item.diaSemana,
      })),
      anteriores: await this.plantoesDoMesAnterior(escala.ano, escala.mes, inicioMes, session),
      existentes: [],
      candidatas: alocacoes,
    });
    if (erros.length > 0) throw new UnprocessableEntityException({ message: 'A escala contém conflitos bloqueantes.', erros });
    return this.atualizarPendenciasCobertura(escala, session);
  }

  async incluirPlantao(escalaId: string, dto: PlantaoDto, usuario: UsuarioAutenticado) {
    await executarTransacao(this.connection, async (session) => {
      const escala = await this.escalaEditavel(escalaId, dto.revisaoEsperada, session);
      await this.validarPlantao(escala, dto, session);

      const horario = HORARIOS[dto.opcao];
      const plantaoId = new Types.ObjectId();
      await this.plantoes.create(
        [
          {
            _id: plantaoId,
            escalaId: escala._id,
            setorId: new Types.ObjectId(dto.setorId),
            data: new Date(`${dto.data}T00:00:00.000Z`),
            horarioInicio: horario.inicio,
            horarioFim: horario.fim,
            duracaoHoras: horario.horas,
            tipo: dto.tipo,
          },
        ],
        { session },
      );
      await this.relacionados.insertMany(
        dto.equipe.map((item) => ({
          plantaoId,
          profissionalId: new Types.ObjectId(item.profissionalId),
          funcao: item.funcao,
          lideranca: item.lideranca ?? false,
          origemCobertura: item.origemCobertura ?? OrigemCobertura.REGULAR,
        })),
        { session },
      );
      await this.registrarEdicao(escala, usuario, 'plantao_adicionado', plantaoId, session);
      await this.atualizarPendenciasCobertura(escala, session);
    });
    return this.obter(escalaId);
  }

  async validarLotePlantoes(escalaId: string, dto: LotePlantoesDto) {
    return executarTransacao(this.connection, async (session) => {
      const escala = await this.escalaEditavel(escalaId, dto.revisaoEsperada, session);
      const erros = await this.errosDoLote(escala, dto.alteracoes, session);
      return { revisao: escala.revisao, valida: erros.length === 0, erros };
    });
  }

  async salvarLotePlantoes(escalaId: string, dto: LotePlantoesDto, usuario: UsuarioAutenticado) {
    await executarTransacao(this.connection, async (session) => {
      const escala = await this.escalaEditavel(escalaId, dto.revisaoEsperada, session);
      const preparadas = await this.prepararLote(escala, dto.alteracoes, session);
      const erros = await this.errosDoLote(escala, dto.alteracoes, session, preparadas);
      if (erros.length > 0) {
        throw new UnprocessableEntityException({ message: 'O lote de plantões viola regras da escala.', erros });
      }

      for (const item of preparadas) {
        if (item.novo) {
          await this.plantoes.create(
            [{
              _id: item.plantaoId,
              escalaId: escala._id,
              setorId: item.setorId,
              data: item.data,
              horarioInicio: item.horarioInicio,
              horarioFim: item.horarioFim,
              duracaoHoras: item.duracaoHoras,
              tipo: item.dto.tipo,
            }],
            { session },
          );
        } else {
          const atualizada = await this.plantoes.updateOne(
            { _id: item.plantaoId, escalaId: escala._id },
            {
              $set: {
                setorId: item.setorId,
                data: item.data,
                horarioInicio: item.horarioInicio,
                horarioFim: item.horarioFim,
                duracaoHoras: item.duracaoHoras,
                tipo: item.dto.tipo,
              },
            },
            { session },
          );
          if (atualizada.matchedCount !== 1) throw new ConflictException('Um plantão do lote foi alterado por outra operação.');
          await this.relacionados.deleteMany({ plantaoId: item.plantaoId }, { session });
        }

        await this.relacionados.insertMany(
          item.dto.equipe.map((profissional) => ({
            plantaoId: item.plantaoId,
            profissionalId: new Types.ObjectId(profissional.profissionalId),
            funcao: profissional.funcao,
            lideranca: profissional.lideranca ?? false,
            origemCobertura: profissional.origemCobertura ?? OrigemCobertura.REGULAR,
          })),
          { session },
        );
      }

      await this.registrarEdicaoLote(escala, usuario, preparadas, session);
      await this.atualizarPendenciasCobertura(
        {
          ...escala,
          status: escala.status === StatusEscala.VALIDADA ? StatusEscala.EM_REVISAO : escala.status,
          revisao: escala.revisao + 1,
        },
        session,
      );
    });
    return this.obter(escalaId);
  }

  async editarPlantao(escalaId: string, plantaoId: string, dto: PlantaoDto, usuario: UsuarioAutenticado) {
    await executarTransacao(this.connection, async (session) => {
      const escala = await this.escalaEditavel(escalaId, dto.revisaoEsperada, session);
      const plantao = await this.plantoes.findOne({ _id: plantaoId, escalaId: escala._id }).session(session).lean().exec();
      if (!plantao) throw new NotFoundException('Plantão não encontrado nesta escala.');
      await this.validarPlantao(escala, dto, session, plantao._id);

      const horario = HORARIOS[dto.opcao];
      await this.plantoes.updateOne(
        { _id: plantao._id, escalaId: escala._id },
        {
          $set: {
            setorId: new Types.ObjectId(dto.setorId),
            data: new Date(`${dto.data}T00:00:00.000Z`),
            horarioInicio: horario.inicio,
            horarioFim: horario.fim,
            duracaoHoras: horario.horas,
            tipo: dto.tipo,
          },
        },
        { session },
      );
      await this.relacionados.deleteMany({ plantaoId: plantao._id }, { session });
      await this.relacionados.insertMany(
        dto.equipe.map((item) => ({
          plantaoId: plantao._id,
          profissionalId: new Types.ObjectId(item.profissionalId),
          funcao: item.funcao,
          lideranca: item.lideranca ?? false,
          origemCobertura: item.origemCobertura ?? OrigemCobertura.REGULAR,
        })),
        { session },
      );
      await this.registrarEdicao(escala, usuario, 'plantao_editado', plantao._id, session);
      await this.atualizarPendenciasCobertura(escala, session);
    });
    return this.obter(escalaId);
  }

  private async escalaEditavel(id: string, revisaoEsperada: number, session: ClientSession) {
    const escala = await this.escalas.findById(id).session(session).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    this.conferirRevisao(escala.revisao, revisaoEsperada);
    if (escala.status === StatusEscala.PUBLICADA || escala.status === StatusEscala.FINALIZADA) {
      throw new ConflictException('Escalas publicadas ou finalizadas não podem ser alteradas diretamente.');
    }
    return escala;
  }

  private async validarPlantao(
    escala: Escala & { _id: Types.ObjectId },
    dto: PlantaoDto,
    session: ClientSession,
    ignorarPlantaoId?: Types.ObjectId,
  ): Promise<void> {
    const lideres = dto.equipe.filter((item) => item.lideranca);
    if (lideres.length > 1 || lideres.some((item) => item.funcao !== 'enfermeiro')) {
      throw new UnprocessableEntityException({
        message: 'O plantão pode ter somente um enfermeiro chefe, que deve fazer parte da equipe.',
      });
    }
    if (!dto.data.startsWith(`${escala.ano}-${String(escala.mes).padStart(2, '0')}-`)) {
      throw new UnprocessableEntityException({ message: 'A data do plantão deve pertencer ao período da escala.' });
    }
    const data = new Date(`${dto.data}T00:00:00.000Z`);
    const fimMes = utcDate(escala.ano, escala.mes - 1, diasDoMes(escala.ano, escala.mes), 23, 59, 59, 999);
    const inicioMes = utcDate(escala.ano, escala.mes - 1, 1);
    const setor = await this.setores.findOne({ _id: dto.setorId, ativo: true }).session(session).lean().exec();
    if (!setor) throw new NotFoundException('Setor ativo não encontrado.');

    const idsProfissionais = dto.equipe.map((item) => new Types.ObjectId(item.profissionalId));
    const profissionaisDocs = await this.profissionais.find({ _id: { $in: idsProfissionais } }).session(session).lean().exec();
    if (profissionaisDocs.length !== idsProfissionais.length) throw new NotFoundException('Um ou mais profissionais não foram encontrados.');
    const nomes = await this.nomesDosUsuarios(profissionaisDocs.map((p) => p.usuarioId));
    const profissionais = new Map<string, ProfissionalEntrada>(
      profissionaisDocs.map((p) => [
        String(p._id),
        {
          id: String(p._id),
          nome: nomes.get(String(p.usuarioId)) ?? String(p._id),
          formacao: p.formacao,
          tipoVinculo: p.tipoVinculo,
          status: p.status,
        },
      ]),
    );

    const idsPlantoes = await this.plantoes
      .find({ escalaId: escala._id, ...(ignorarPlantaoId ? { _id: { $ne: ignorarPlantaoId } } : {}) }, { _id: 1 })
      .session(session)
      .lean()
      .exec();
    const idsAtuais = idsPlantoes.map((item) => item._id);
    const [plantoesAtuais, vinculosAtuais] = await Promise.all([
      this.plantoes.find({ _id: { $in: idsAtuais } }).session(session).lean().exec(),
      idsAtuais.length
        ? this.relacionados.find({ plantaoId: { $in: idsAtuais }, profissionalId: { $in: idsProfissionais } }).session(session).lean().exec()
        : Promise.resolve([]),
    ]);
    const plantaoPorId = new Map(plantoesAtuais.map((item) => [String(item._id), item]));
    const existentes: AlocacaoPlantaoValidacao[] = vinculosAtuais.flatMap((vinculo) => {
      const plantaoAtual = plantaoPorId.get(String(vinculo.plantaoId));
      const perfil = profissionais.get(String(vinculo.profissionalId));
      if (!plantaoAtual || !perfil) return [];
      return [{
        profissional: perfil,
        funcao: vinculo.funcao as AlocacaoPlantaoValidacao['funcao'],
        data: plantaoAtual.data,
        horarioInicio: plantaoAtual.horarioInicio,
        duracaoHoras: plantaoAtual.duracaoHoras,
        tipo: plantaoAtual.tipo,
      }];
    });

    const restricoes = await this.restricoes
      .find({ profissionalId: { $in: idsProfissionais }, inicio: { $lte: fimMes }, fim: { $gte: inicioMes } })
      .session(session)
      .lean()
      .exec();
    const geracao = (escala.geracao ?? {}) as { configuracao?: ConfiguracaoVigente };
    const configuracao =
      geracao.configuracao ?? ((await this.configuracoes.consultar(escala.ano, escala.mes)) as ConfiguracaoVigente);
    const horario = HORARIOS[dto.opcao];
    const candidatas: AlocacaoPlantaoValidacao[] = dto.equipe.map((item) => ({
      profissional: profissionais.get(item.profissionalId)!,
      funcao: item.funcao,
      data,
      horarioInicio: horario.inicio,
      duracaoHoras: horario.horas,
      tipo: dto.tipo,
    }));
    const anteriores = await this.plantoesDoMesAnterior(escala.ano, escala.mes, inicioMes, session);
    const erros = validarAlocacoesPlantao({
      ano: escala.ano,
      mes: escala.mes,
      configuracao,
      restricoes: restricoes.map((item) => ({
        profissionalId: String(item.profissionalId),
        tipo: item.tipo,
        inicio: item.inicio,
        fim: item.fim,
        diaSemana: item.diaSemana,
      })),
      anteriores,
      existentes,
      candidatas,
    });
    if (erros.length > 0) throw new UnprocessableEntityException({ message: 'O plantão viola regras da escala.', erros });
  }

  private async errosDoLote(
    escala: Escala & { _id: Types.ObjectId },
    alteracoes: PlantaoAlteracaoDto[],
    session: ClientSession,
    lotePreparado?: AlteracaoPlantaoPreparada[],
  ): Promise<string[]> {
    const preparadas = lotePreparado ?? (await this.prepararLote(escala, alteracoes, session));
    const idsPlantoes = await this.plantoes.find({ escalaId: escala._id }, { _id: 1 }).session(session).lean().exec();
    const idsExistentes = idsPlantoes.map((item) => item._id);
    const plantoes = idsExistentes.length
      ? await this.plantoes.find({ _id: { $in: idsExistentes } }).session(session).lean().exec()
      : [];
    const vinculos = idsExistentes.length
      ? await this.relacionados.find({ plantaoId: { $in: idsExistentes } }).session(session).lean().exec()
      : [];
    const preparadasPorId = new Map(preparadas.map((item) => [String(item.plantaoId), item]));
    const vinculosPorPlantao = new Map<string, typeof vinculos>();
    for (const vinculo of vinculos) {
      const idPlantao = String(vinculo.plantaoId);
      vinculosPorPlantao.set(idPlantao, [...(vinculosPorPlantao.get(idPlantao) ?? []), vinculo]);
    }

    const alocacoesOrigem: {
      profissionalId: string;
      funcao: AlocacaoPlantaoValidacao['funcao'];
      data: Date;
      horarioInicio: string;
      duracaoHoras: number;
      tipo: TipoPlantao;
    }[] = [];
    for (const plantao of plantoes) {
      const idPlantao = String(plantao._id);
      const alteracao = preparadasPorId.get(idPlantao);
      if (alteracao) {
        for (const profissional of alteracao.dto.equipe) {
          alocacoesOrigem.push({
            profissionalId: profissional.profissionalId,
            funcao: profissional.funcao as AlocacaoPlantaoValidacao['funcao'],
            data: alteracao.data,
            horarioInicio: alteracao.horarioInicio,
            duracaoHoras: alteracao.duracaoHoras,
            tipo: alteracao.dto.tipo,
          });
        }
        continue;
      }
      for (const vinculo of vinculosPorPlantao.get(idPlantao) ?? []) {
        alocacoesOrigem.push({
          profissionalId: String(vinculo.profissionalId),
          funcao: vinculo.funcao as AlocacaoPlantaoValidacao['funcao'],
          data: plantao.data,
          horarioInicio: plantao.horarioInicio,
          duracaoHoras: plantao.duracaoHoras,
          tipo: plantao.tipo,
        });
      }
    }
    for (const item of preparadas.filter((alteracao) => alteracao.novo)) {
      for (const profissional of item.dto.equipe) {
        alocacoesOrigem.push({
          profissionalId: profissional.profissionalId,
          funcao: profissional.funcao as AlocacaoPlantaoValidacao['funcao'],
          data: item.data,
          horarioInicio: item.horarioInicio,
          duracaoHoras: item.duracaoHoras,
          tipo: item.dto.tipo,
        });
      }
    }

    const idsProfissionais = [...new Set(alocacoesOrigem.map((item) => item.profissionalId))];
    const profissionaisDocs = idsProfissionais.length
      ? await this.profissionais.find({ _id: { $in: idsProfissionais.map((id) => new Types.ObjectId(id)) } }).session(session).lean().exec()
      : [];
    if (profissionaisDocs.length !== idsProfissionais.length) {
      throw new NotFoundException('Um ou mais profissionais do lote não foram encontrados.');
    }
    const nomes = await this.nomesDosUsuarios(profissionaisDocs.map((item) => item.usuarioId), session);
    const profissionalPorId = new Map(
      profissionaisDocs.map((item) => [
        String(item._id),
        {
          id: String(item._id),
          nome: nomes.get(String(item.usuarioId)) ?? String(item._id),
          formacao: item.formacao,
          tipoVinculo: item.tipoVinculo,
          status: item.status,
        },
      ]),
    );
    const inicioMes = utcDate(escala.ano, escala.mes - 1, 1);
    const fimMes = utcDate(escala.ano, escala.mes - 1, diasDoMes(escala.ano, escala.mes), 23, 59, 59, 999);
    const restricoes = idsProfissionais.length
      ? await this.restricoes
          .find({
            profissionalId: { $in: idsProfissionais.map((id) => new Types.ObjectId(id)) },
            inicio: { $lte: fimMes },
            fim: { $gte: inicioMes },
          })
          .session(session)
          .lean()
          .exec()
      : [];
    const geracao = (escala.geracao ?? {}) as { configuracao?: ConfiguracaoVigente };
    const configuracao =
      geracao.configuracao ?? ((await this.configuracoes.consultar(escala.ano, escala.mes)) as ConfiguracaoVigente);
    const candidatas: AlocacaoPlantaoValidacao[] = alocacoesOrigem.map((item) => ({
      ...item,
      profissional: profissionalPorId.get(item.profissionalId)!,
    }));
    return validarAlocacoesPlantao({
      ano: escala.ano,
      mes: escala.mes,
      configuracao,
      restricoes: restricoes.map((item) => ({
        profissionalId: String(item.profissionalId),
        tipo: item.tipo,
        inicio: item.inicio,
        fim: item.fim,
        diaSemana: item.diaSemana,
      })),
      anteriores: await this.plantoesDoMesAnterior(escala.ano, escala.mes, inicioMes, session),
      existentes: [],
      candidatas,
    });
  }

  private async prepararLote(
    escala: Escala & { _id: Types.ObjectId },
    alteracoes: PlantaoAlteracaoDto[],
    session: ClientSession,
  ): Promise<AlteracaoPlantaoPreparada[]> {
    const plantoesAtuais = await this.plantoes.find({ escalaId: escala._id }).session(session).lean().exec();
    const plantaoPorId = new Map(plantoesAtuais.map((item) => [String(item._id), item]));
    const idsAlterados = new Set<string>();
    const preparadas = alteracoes.map((dto): AlteracaoPlantaoPreparada => {
      const lideres = dto.equipe.filter((item) => item.lideranca);
      if (lideres.length > 1 || lideres.some((item) => item.funcao !== 'enfermeiro')) {
        throw new UnprocessableEntityException({
          message: 'O plantão pode ter somente um enfermeiro chefe, que deve fazer parte da equipe.',
        });
      }
      if (!dto.data.startsWith(`${escala.ano}-${String(escala.mes).padStart(2, '0')}-`)) {
        throw new UnprocessableEntityException({ message: 'A data do plantão deve pertencer ao período da escala.' });
      }
      const plantaoAtual = dto.plantaoId ? plantaoPorId.get(dto.plantaoId) : undefined;
      if (dto.plantaoId && !plantaoAtual) throw new NotFoundException('Plantão não encontrado nesta escala.');
      if (dto.plantaoId && idsAlterados.has(dto.plantaoId)) {
        throw new UnprocessableEntityException({ message: 'O lote não pode alterar o mesmo plantão mais de uma vez.' });
      }
      if (dto.plantaoId) idsAlterados.add(dto.plantaoId);
      const horario = HORARIOS[dto.opcao];
      return {
        dto,
        plantaoId: dto.plantaoId ? new Types.ObjectId(dto.plantaoId) : new Types.ObjectId(),
        novo: !dto.plantaoId,
        setorId: new Types.ObjectId(dto.setorId),
        data: new Date(`${dto.data}T00:00:00.000Z`),
        horarioInicio: horario.inicio,
        horarioFim: horario.fim,
        duracaoHoras: horario.horas,
      };
    });
    const idsSetores = [...new Set(preparadas.map((item) => String(item.setorId)))];
    if (idsSetores.length > 0) {
      const setores = await this.setores
        .find({ _id: { $in: idsSetores.map((id) => new Types.ObjectId(id)) }, ativo: true })
        .session(session)
        .lean()
        .exec();
      if (setores.length !== idsSetores.length) throw new NotFoundException('Um ou mais setores ativos não foram encontrados.');
    }
    return preparadas;
  }

  private async registrarEdicao(
    escala: Escala & { _id: Types.ObjectId },
    usuario: UsuarioAutenticado,
    acao: string,
    plantaoId: Types.ObjectId,
    session: ClientSession,
  ) {
    const status = escala.status === StatusEscala.VALIDADA ? StatusEscala.EM_REVISAO : escala.status;
    const atualizada = await this.escalas.updateOne(
      { _id: escala._id, status: escala.status, revisao: escala.revisao },
      { $set: { status }, $unset: { validacao: 1 }, $inc: { revisao: 1 } },
      { session },
    );
    if (atualizada.matchedCount !== 1) throw new ConflictException('A escala foi alterada por outra operação; atualize os dados e tente novamente.');
    await this.auditoria.create(
      [
        {
          escalaId: escala._id,
          revisao: escala.revisao + 1,
          acao,
          usuarioId: new Types.ObjectId(usuario.id),
          detalhes: { plantaoId: String(plantaoId) },
        },
      ],
      { session },
    );
  }

  private async registrarEdicaoLote(
    escala: Escala & { _id: Types.ObjectId },
    usuario: UsuarioAutenticado,
    preparadas: AlteracaoPlantaoPreparada[],
    session: ClientSession,
  ) {
    const status = escala.status === StatusEscala.VALIDADA ? StatusEscala.EM_REVISAO : escala.status;
    const atualizada = await this.escalas.updateOne(
      { _id: escala._id, status: escala.status, revisao: escala.revisao },
      { $set: { status }, $unset: { validacao: 1 }, $inc: { revisao: 1 } },
      { session },
    );
    if (atualizada.matchedCount !== 1) {
      throw new ConflictException('A escala foi alterada por outra operação; atualize os dados e tente novamente.');
    }
    await this.auditoria.create(
      [
        {
          escalaId: escala._id,
          revisao: escala.revisao + 1,
          acao: 'plantoes_lote_atualizados',
          usuarioId: new Types.ObjectId(usuario.id),
          detalhes: {
            plantaoIds: preparadas.map((item) => String(item.plantaoId)),
            novos: preparadas.filter((item) => item.novo).length,
            editados: preparadas.filter((item) => !item.novo).length,
          },
        },
      ],
      { session },
    );
  }

  private async atualizarPendenciasCobertura(
    escala: Escala & { _id: Types.ObjectId },
    session: ClientSession,
  ): Promise<ResumoCobertura> {
    const plantoes = await this.plantoes.find({ escalaId: escala._id }).session(session).lean().exec();
    const idsPlantoes = plantoes.map((item) => item._id);
    const vinculos = idsPlantoes.length
      ? await this.relacionados.find({ plantaoId: { $in: idsPlantoes } }).session(session).lean().exec()
      : [];
    const geracao = (escala.geracao ?? {}) as {
      configuracao?: ConfiguracaoVigente;
      conflitos?: Mensagem[];
      avisos?: Mensagem[];
      escopo?: { setorIds?: string[]; turnos?: ('diurno' | 'noturno')[] };
    };
    const idsSetores = plantoes.map((item) => item.setorId);
    const setores = await this.setores
      .find({
        $or: [
          { ativo: true },
          { _id: { $in: idsSetores } },
          { _id: { $in: (geracao.escopo?.setorIds ?? []).map((id) => new Types.ObjectId(id)) } },
        ],
      })
      .session(session)
      .lean()
      .exec();
    const plantaoPorId = new Map(plantoes.map((item) => [String(item._id), item]));
    const profissionaisDocs = await this.profissionais
      .find({ status: StatusProfissional.ATIVO })
      .session(session)
      .lean()
      .exec();
    const profissionais = new Map(profissionaisDocs.map((item) => [String(item._id), item]));
    const alocacoes = vinculos.flatMap((vinculo) => {
      const plantao = plantaoPorId.get(String(vinculo.plantaoId));
      const profissional = profissionais.get(String(vinculo.profissionalId));
      if (!plantao || !profissional) return [];
      return [{
        profissional: {
          id: String(profissional._id),
          nome: String(profissional._id),
          formacao: profissional.formacao,
          tipoVinculo: profissional.tipoVinculo,
          status: profissional.status,
        },
        funcao: vinculo.funcao as AlocacaoPlantaoValidacao['funcao'],
        data: plantao.data,
        horarioInicio: plantao.horarioInicio,
        duracaoHoras: plantao.duracaoHoras,
        tipo: plantao.tipo,
        setorId: String(plantao.setorId),
      }];
    });
    const setorIdsDoEscopo = new Set(geracao.escopo?.setorIds ?? setores.filter((item) => item.ativo).map((item) => String(item._id)));
    for (const plantao of plantoes) setorIdsDoEscopo.add(String(plantao.setorId));
    const turnosDoEscopo = new Set<'diurno' | 'noturno'>(geracao.escopo?.turnos ?? ['diurno', 'noturno']);
    for (const plantao of plantoes) {
      if (plantao.duracaoHoras >= 24) {
        turnosDoEscopo.add('diurno');
        turnosDoEscopo.add('noturno');
      } else {
        turnosDoEscopo.add(plantao.horarioInicio === '07:00' ? 'diurno' : 'noturno');
      }
    }
    const escopoAtualizado = { setorIds: [...setorIdsDoEscopo], turnos: [...turnosDoEscopo] };
    const setoresDoEscopo = setores.filter((item) => setorIdsDoEscopo.has(String(item._id)));
    const pendencias = calcularPendenciasCobertura({
      ano: escala.ano,
      mes: escala.mes,
      setores: setoresDoEscopo.map((item) => ({
        id: String(item._id),
        nome: item.nome,
        turnos: item.turnos,
      })),
      alocacoes,
      turnos: escopoAtualizado.turnos,
    });
    const cobertura = resumirCobertura({
      ano: escala.ano,
      mes: escala.mes,
      setores: setoresDoEscopo,
      turnos: escopoAtualizado.turnos,
      pendencias,
    });
    const configuracao =
      geracao.configuracao ?? ((await this.configuracoes.consultar(escala.ano, escala.mes)) as ConfiguracaoVigente);
    const nomes = await this.usuarios
      .find({ _id: { $in: profissionaisDocs.map((item) => item.usuarioId) } }, { nome: 1 })
      .session(session)
      .lean()
      .exec();
    const nomePorUsuario = new Map(nomes.map((item) => [String(item._id), item.nome]));
    const alocacoesPorProfissional = new Map<string, typeof alocacoes>();
    for (const alocacao of alocacoes) {
      const idProfissional = alocacao.profissional.id;
      alocacoesPorProfissional.set(idProfissional, [...(alocacoesPorProfissional.get(idProfissional) ?? []), alocacao]);
    }
    const cargas = profissionaisDocs.map((profissional) => {
      const id = String(profissional._id);
      const atribuidas = alocacoesPorProfissional.get(id) ?? [];
      const carga = configuracao.cargas[chaveCarga(profissional.tipoVinculo, diasDoMes(escala.ano, escala.mes))];
      const esperada = { plantoes24h: carga?.plantoes24h ?? 0, plantoes12h: carga?.plantoes12h ?? 0 };
      const plantoes24h = atribuidas.filter((item) => item.tipo === TipoPlantao.REGULAR && item.duracaoHoras === 24).length;
      const plantoes12h = atribuidas.filter((item) => item.tipo === TipoPlantao.REGULAR && item.duracaoHoras === 12).length;
      const extras = atribuidas.filter((item) => item.tipo === TipoPlantao.EXTRA).length;
      return {
        profissionalId: id,
        profissional: nomePorUsuario.get(String(profissional.usuarioId)) ?? id,
        vinculo: profissional.tipoVinculo,
        esperada,
        atribuida: { plantoes24h, plantoes12h },
        extras,
      };
    });
    const conflitos = [
      ...(geracao.conflitos ?? []).filter((item) => item.tipo !== 'CARGA_ABAIXO_DO_ESPERADO'),
      ...cargas
        .filter((item) => item.atribuida.plantoes24h < item.esperada.plantoes24h || item.atribuida.plantoes12h < item.esperada.plantoes12h)
        .map((item) => ({
          tipo: 'CARGA_ABAIXO_DO_ESPERADO',
          profissionalId: item.profissionalId,
          profissional: item.profissional,
          motivo: `Faltam ${item.esperada.plantoes24h - item.atribuida.plantoes24h} plantão(ões) de 24h e ${item.esperada.plantoes12h - item.atribuida.plantoes12h} de 12h para a carga esperada do vínculo ${item.vinculo}.`,
        })),
    ];
    const avisos = [
      ...(geracao.avisos ?? []).filter((item) => item.tipo !== 'EXTRAS_ALOCADOS'),
      ...cargas
        .filter((item) => item.extras > 0)
        .map((item) => ({
          tipo: 'EXTRAS_ALOCADOS',
          profissionalId: item.profissionalId,
          profissional: item.profissional,
          motivo: `${item.extras} plantão(ões) extra(s) além da carga regular.`,
        })),
    ];
    await this.escalas.updateOne(
      { _id: escala._id },
      {
        $set: {
          'geracao.pendencias': pendencias,
          'geracao.conflitos': conflitos,
          'geracao.avisos': avisos,
          'geracao.cargas': cargas,
          'geracao.escopo': escopoAtualizado,
          'geracao.resumo.alocacoes': vinculos.length,
          'geracao.resumo.vagasDescobertas': pendencias.length,
          'geracao.resumo.extras': cargas.reduce((total, item) => total + item.extras, 0),
          'geracao.resumo.cobertura': cobertura,
        },
      },
      { session },
    );
    return cobertura;
  }

  private async gerarPeriodo(
    dto: GerarEscalaDto & { operacaoId: string },
    usuario: UsuarioAutenticado,
    operacao: GeracaoEmAndamento,
  ) {
    const { ano, mes } = dto;
    const rotulo = rotuloPeriodo(ano, mes);

    const existente = await this.escalas.findOne({ ano, mes }).lean().exec();
    const substituivel = existente?.status === StatusEscala.RASCUNHO || existente?.status === StatusEscala.EM_REVISAO;
    if (existente && !substituivel) {
      throw new ConflictException(`Já existe uma escala ${existente.status} para ${rotulo} (id ${existente._id}). Ela não pode ser substituída.`);
    }
    if (existente && !dto.substituirRascunho) {
      throw new ConflictException(
        `Já existe uma escala em ${existente.status} para ${rotulo} (id ${existente._id}). Envie "substituirRascunho": true para gerar novamente.`,
      );
    }

    // Configuração vigente NO MOMENTO da geração (nunca valores fixos nem reaproveitados de escalas antigas).
    const configuracao = (await this.configuracoes.consultar(ano, mes)) as ConfiguracaoVigente;
    const inicioMes = utcDate(ano, mes - 1, 1);
    const fimMes = utcDate(ano, mes - 1, diasDoMes(ano, mes), 23, 59, 59, 999);

    const profissionaisDocs = await this.profissionais.find().lean().exec();
    const nomes = await this.nomesDosUsuarios(profissionaisDocs.map((p) => p.usuarioId));
    const profissionais: ProfissionalEntrada[] = profissionaisDocs.map((p) => ({
      id: String(p._id),
      nome: nomes.get(String(p.usuarioId)) ?? String(p._id),
      formacao: p.formacao,
      tipoVinculo: p.tipoVinculo,
      status: p.status,
    }));

    const setoresAtivos = await this.setores.find({ ativo: true }).sort({ nome: 1 }).lean().exec();
    const idsSetoresSolicitados = dto.setorIds ? new Set(dto.setorIds) : undefined;
    const setoresDocs = idsSetoresSolicitados
      ? setoresAtivos.filter((setor) => idsSetoresSolicitados.has(String(setor._id)))
      : setoresAtivos;
    if (dto.setorIds && setoresDocs.length !== dto.setorIds.length) {
      throw new UnprocessableEntityException({
        message: 'Um ou mais setores selecionados não estão ativos.',
        erros: ['Selecione somente setores ativos cadastrados.'],
      });
    }
    const turnosSelecionados = dto.turnos ?? ['diurno', 'noturno'];
    const setores = setoresDocs.map((s) => ({
      id: String(s._id),
      nome: s.nome,
      turnos: {
        diurno: { enfermeiros: s.turnos.diurno.enfermeiros, tecnicos: s.turnos.diurno.tecnicos },
        noturno: { enfermeiros: s.turnos.noturno.enfermeiros, tecnicos: s.turnos.noturno.tecnicos },
      },
    }));

    const erros = validarEntrada({ ano, mes, profissionais, setores, configuracao, turnosSelecionados });
    if (erros.length > 0) {
      throw new UnprocessableEntityException({ message: 'Dados insuficientes para gerar a escala.', erros });
    }

    const restricoes = (
      await this.restricoes
        .find({ profissionalId: { $in: profissionaisDocs.map((p) => p._id) }, inicio: { $lte: fimMes }, fim: { $gte: inicioMes } })
        .lean()
        .exec()
    ).map((r) => ({
      profissionalId: String(r.profissionalId),
      tipo: r.tipo,
      inicio: r.inicio,
      fim: r.fim,
      diaSemana: r.diaSemana,
    }));

    const { problema, conflitos, avisos } = montarProblema({
      ano,
      mes,
      profissionais,
      setores,
      restricoes,
      configuracao,
      plantoesAnteriores: await this.plantoesDoMesAnterior(ano, mes, inicioMes),
      tempoLimiteSegundos: this.config.get('otimizador', { infer: true }).tempoLimiteSegundos,
      turnosSelecionados,
    });

    problema.operacao_id = dto.operacaoId;
    this.exigirGeracaoAtiva(operacao);
    const solucao = await this.otimizador.resolver(problema, operacao.controller.signal);
    this.exigirGeracaoAtiva(operacao);

    const porId = new Map(profissionais.map((p) => [p.id, p]));
    const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));

    const pendencias = solucao.descobertos.map((d) => ({
      setorId: d.setor_id,
      setor: nomeSetor.get(d.setor_id) ?? d.setor_id,
      data: isoDia(utcDate(ano, mes - 1, d.dia)),
      turno: d.turno,
      funcao: d.funcao,
      necessario: d.necessario,
      alocado: d.alocado,
      faltam: d.faltam,
      motivo: 'Quantitativo mínimo não atingido sem violar as restrições obrigatórias.',
    }));
    const cobertura = resumirCobertura({ ano, mes, setores, turnos: turnosSelecionados, pendencias });

    const cargas = solucao.estatisticas.cargas.map((c) => {
      const p = porId.get(c.profissional_id)!;
      const esperada = problema.profissionais.find((x) => x.id === c.profissional_id)!;
      if (c.faltam_24h + c.faltam_12h > 0) {
        conflitos.push({
          tipo: 'CARGA_ABAIXO_DO_ESPERADO',
          profissionalId: p.id,
          profissional: p.nome,
          motivo: `Faltam ${c.faltam_24h} plantão(ões) de 24h e ${c.faltam_12h} de 12h para a carga esperada do vínculo ${p.tipoVinculo}.`,
        });
      }
      if (c.extras > 0) {
        avisos.push({
          tipo: 'EXTRAS_ALOCADOS',
          profissionalId: p.id,
          profissional: p.nome,
          motivo: `${c.extras} plantão(ões) extra(s) além da carga regular.`,
        });
      }
      return {
        profissionalId: p.id,
        profissional: p.nome,
        vinculo: p.tipoVinculo,
        esperada: { plantoes24h: esperada.carga_24h, plantoes12h: esperada.carga_12h },
        atribuida: { plantoes24h: c.plantoes_24h, plantoes12h: c.plantoes_12h },
        extras: c.extras,
      };
    });

    const geracao = {
      geradaEm: new Date(),
      geradaPor: usuario.id,
      // Retrato da configuração usada: mudanças posteriores não alteram esta escala.
      configuracao,
      escopo: { setorIds: setores.map((setor) => setor.id), turnos: turnosSelecionados },
      resumo: {
        alocacoes: solucao.estatisticas.total_alocacoes,
        vagasDescobertas: solucao.estatisticas.total_descobertos,
        extras: cargas.reduce((total, c) => total + c.extras, 0),
        cobertura,
        solver: {
          status: solucao.estatisticas.status,
          otimo: solucao.estatisticas.otimo,
          objetivo: solucao.estatisticas.objetivo,
          melhorLimite: solucao.estatisticas.melhor_limite,
          tempoSegundos: solucao.estatisticas.tempo_segundos,
        },
      },
      pendencias,
      conflitos,
      avisos,
      cargas,
    };

    const administradorId = await this.administradorDe(usuario.id);
    this.exigirGeracaoAtiva(operacao);
    operacao.estado = 'salvando';
    const escalaId = await this.gravar(
      existente?._id,
      existente?.revisao,
      { ano, mes, administradorId, geracao },
      solucao.alocacoes,
      porId,
    );
    return this.obter(String(escalaId));
  }

  private exigirGeracaoAtiva(operacao: GeracaoEmAndamento) {
    if (operacao.estado !== 'otimizando' || operacao.controller.signal.aborted) {
      throw new ConflictException('Geração cancelada. Nenhuma escala foi salva.');
    }
  }

  /** Grava (ou regrava o rascunho/em revisão) escala, plantões e vínculos profissional-plantão. */
  private async gravar(
    existenteId: Types.ObjectId | undefined,
    revisaoExistente: number | undefined,
    base: { ano: number; mes: number; administradorId: Types.ObjectId; geracao: Record<string, unknown> },
    alocacoes: { profissional_id: string; setor_id: string; dia: number; opcao: OpcaoPlantao; extra: boolean }[],
    porId: Map<string, ProfissionalEntrada>,
  ): Promise<Types.ObjectId> {
    try {
      return await executarTransacao(this.connection, async (session) => {
        const escalaId = existenteId ?? new Types.ObjectId();
        if (existenteId) {
          await this.removerConteudo(escalaId, session);
          const atualizada = await this.escalas.updateOne(
            { _id: escalaId, status: { $in: [StatusEscala.RASCUNHO, StatusEscala.EM_REVISAO] }, revisao: revisaoExistente },
            {
              $set: {
                administradorId: base.administradorId,
                dataCriacao: new Date(),
                geracao: base.geracao,
                status: StatusEscala.RASCUNHO,
              },
              $unset: { validacao: 1 },
              $inc: { revisao: 1 },
            },
            { session },
          );
          if (atualizada.matchedCount !== 1) {
            throw new ConflictException('A escala deixou de ser um rascunho ou uma escala em revisão e não pode ser substituída.');
          }
        } else {
          await this.escalas.create([{ _id: escalaId, ...base, status: StatusEscala.RASCUNHO }], { session });
        }

        const agrupados = new Map<string, { doc: Partial<Plantao> & { _id: Types.ObjectId }; profissionais: string[] }>();
        for (const a of alocacoes) {
          const chave = `${a.setor_id}|${a.dia}|${a.opcao}|${a.extra}`;
          let grupo = agrupados.get(chave);
          if (!grupo) {
            const h = HORARIOS[a.opcao];
            grupo = {
              doc: {
                _id: new Types.ObjectId(),
                escalaId,
                setorId: new Types.ObjectId(a.setor_id),
                data: utcDate(base.ano, base.mes - 1, a.dia),
                horarioInicio: h.inicio,
                horarioFim: h.fim,
                duracaoHoras: h.horas,
                tipo: a.extra ? TipoPlantao.EXTRA : TipoPlantao.REGULAR,
              },
              profissionais: [],
            };
            agrupados.set(chave, grupo);
          }
          grupo.profissionais.push(a.profissional_id);
        }
        const docs = [...agrupados.values()];
        if (docs.length > 0) {
          await this.plantoes.insertMany(docs.map((g) => g.doc), { session });
          await this.relacionados.insertMany(
            docs.flatMap((g) =>
              g.profissionais.map((pid) => ({
                plantaoId: g.doc._id,
                profissionalId: new Types.ObjectId(pid),
                funcao: porId.get(pid)!.formacao,
              })),
            ),
            { session },
          );
        }
        return escalaId;
      });
    } catch (erro) {
      this.logger.error(`Falha ao gravar a escala ${rotuloPeriodo(base.ano, base.mes)}: ${(erro as Error).message}`);
      if ((erro as { code?: number }).code === 11000 && !existenteId) {
        throw new ConflictException(`Já existe uma escala para ${rotuloPeriodo(base.ano, base.mes)}.`);
      }
      throw erro;
    }
  }

  private async removerConteudo(escalaId: Types.ObjectId, session: ClientSession) {
    const ids = (await this.plantoes.find({ escalaId }, { _id: 1 }).session(session).lean().exec()).map((p) => p._id);
    if (ids.length > 0) await this.relacionados.deleteMany({ plantaoId: { $in: ids } }, { session });
    await this.plantoes.deleteMany({ escalaId }, { session });
  }

  private async administradorDe(usuarioId: string, session?: ClientSession): Promise<Types.ObjectId> {
    const consulta = this.administradores.findOne({ usuarioId });
    if (session) consulta.session(session);
    const admin = await consulta.lean().exec();
    return admin?._id ?? new Types.ObjectId(usuarioId);
  }

  private async nomesDosUsuarios(ids: Types.ObjectId[], session?: ClientSession): Promise<Map<string, string>> {
    const consulta = this.usuarios.find({ _id: { $in: ids } }, { nome: 1 });
    if (session) consulta.session(session);
    const lista = await consulta.lean().exec();
    return new Map(lista.map((u) => [String(u._id), u.nome]));
  }

  /** Plantões dos últimos dias da escala do mês anterior (qualquer status), para herdar o descanso. */
  private async plantoesDoMesAnterior(
    ano: number,
    mes: number,
    inicioMes: Date,
    session?: ClientSession,
  ): Promise<PlantaoAnterior[]> {
    const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
    const consultaEscala = this.escalas.findOne(anterior, { _id: 1 });
    if (session) consultaEscala.session(session);
    const escala = await consultaEscala.lean().exec();
    if (!escala) return [];
    const consultaPlantoes = this.plantoes.find({
      escalaId: escala._id,
      data: { $gte: new Date(inicioMes.getTime() - 5 * MS_DIA), $lt: inicioMes },
    });
    if (session) consultaPlantoes.session(session);
    const plantoes = await consultaPlantoes.lean().exec();
    if (plantoes.length === 0) return [];
    const consultaVinculos = this.relacionados.find({ plantaoId: { $in: plantoes.map((p) => p._id) } });
    if (session) consultaVinculos.session(session);
    const vinculos = await consultaVinculos.lean().exec();
    const porPlantao = new Map(plantoes.map((p) => [String(p._id), p]));
    return vinculos.map((v) => {
      const p = porPlantao.get(String(v.plantaoId))!;
      return { profissionalId: String(v.profissionalId), data: p.data, horarioInicio: p.horarioInicio, duracaoHoras: p.duracaoHoras };
    });
  }

  private async snapshotComVisualizacao(
    escala: Escala & { _id: Types.ObjectId },
    snapshot: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (isVisualizacaoEscalaPdf(snapshot.visualizacao)) return snapshot;
    if (!isSnapshotEscala(snapshot)) return snapshot;
    const dadosEscala =
      typeof snapshot.escala === 'object' && snapshot.escala !== null
        ? (snapshot.escala as Partial<Escala>)
        : {};
    const escalaSnapshot = { ...escala, ...dadosEscala, _id: escala._id } as Escala & { _id: Types.ObjectId };
    const visualizacao = await this.montarResposta(escalaSnapshot, undefined, snapshot);
    if (!isVisualizacaoEscalaPdf(visualizacao)) {
      throw new ConflictException('O snapshot oficial não pôde ser preparado para consulta.');
    }
    return { ...snapshot, visualizacao };
  }

  private async montarResposta(
    escala: Escala & { _id: Types.ObjectId },
    session?: ClientSession,
    snapshot?: SnapshotEscala,
  ) {
    let plantoes: (Plantao & { _id: Types.ObjectId })[];
    let vinculos: (PlantaoProfissional & { _id: Types.ObjectId })[];
    if (snapshot) {
      plantoes = snapshot.plantoes as (Plantao & { _id: Types.ObjectId })[];
      vinculos = snapshot.profissionaisRelacionados as (PlantaoProfissional & { _id: Types.ObjectId })[];
    } else {
      const consultaPlantoes = this.plantoes.find({ escalaId: escala._id }).sort({ data: 1, horarioInicio: 1 });
      if (session) consultaPlantoes.session(session);
      plantoes = await consultaPlantoes.lean().exec();
      const consultaVinculos = this.relacionados.find({ plantaoId: { $in: plantoes.map((p) => p._id) } });
      if (session) consultaVinculos.session(session);
      vinculos = await consultaVinculos.lean().exec();
    }
    const consultaProfissionais = this.profissionais.find({ _id: { $in: vinculos.map((v) => v.profissionalId) } });
    if (session) consultaProfissionais.session(session);
    const profissionaisDocs = await consultaProfissionais.lean().exec();
    const nomes = await this.nomesDosUsuarios(profissionaisDocs.map((p) => p.usuarioId), session);
    const profissionalPorId = new Map(
      profissionaisDocs.map((p) => [String(p._id), { id: String(p._id), nome: nomes.get(String(p.usuarioId)) ?? '', formacao: p.formacao, vinculo: p.tipoVinculo }]),
    );
    const consultaSetores = this.setores.find({ _id: { $in: plantoes.map((p) => p.setorId) } }, { nome: 1 });
    if (session) consultaSetores.session(session);
    const setoresDocs = await consultaSetores.lean().exec();
    const nomeSetor = new Map(setoresDocs.map((s) => [String(s._id), s.nome]));

    const geracao = (escala.geracao ?? {}) as {
      resumo?: unknown;
      configuracao?: unknown;
      pendencias?: unknown[];
      conflitos?: Mensagem[];
      avisos?: Mensagem[];
      cargas?: unknown[];
      escopo?: unknown;
    };

    return {
      escala: {
        id: String(escala._id),
        ano: escala.ano,
        mes: escala.mes,
        status: escala.status,
        revisao: escala.revisao,
        versaoPublicada: escala.versaoPublicada,
        validacao: escala.validacao ?? null,
        administradorId: String(escala.administradorId),
        dataCriacao: escala.dataCriacao,
      },
      resumo: { plantoes: plantoes.length, ...(geracao.resumo as object) },
      cobertura: (geracao.resumo as { cobertura?: ResumoCobertura } | undefined)?.cobertura ?? null,
      configuracaoUtilizada: geracao.configuracao ?? null,
      escopo: geracao.escopo ?? null,
      plantoes: plantoes.map((p) => ({
        id: String(p._id),
        data: isoDia(p.data),
        setor: { id: String(p.setorId), nome: nomeSetor.get(String(p.setorId)) ?? '' },
        horarioInicio: p.horarioInicio,
        horarioFim: p.horarioFim,
        duracaoHoras: p.duracaoHoras,
        tipo: p.tipo,
        profissionais: vinculos
          .filter((v) => String(v.plantaoId) === String(p._id))
          .map((v) => {
            const profissional = profissionalPorId.get(String(v.profissionalId));
            if (!profissional) return undefined;
            return {
              ...profissional,
              lideranca: v.lideranca ?? false,
              origemCobertura: v.origemCobertura ?? OrigemCobertura.REGULAR,
            };
          })
          .filter(Boolean),
      })),
      pendencias: geracao.pendencias ?? [],
      conflitos: geracao.conflitos ?? [],
      avisos: geracao.avisos ?? [],
      cargas: geracao.cargas ?? [],
    };
  }
}
