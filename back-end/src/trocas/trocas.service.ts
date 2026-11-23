import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { type ClientSession, type Connection, Model, Types } from 'mongoose';
import { Configuracao } from '../configuracoes/configuracao.schema';
import { utcDate } from '../common/utils/date';
import { executarTransacao } from '../common/utils/mongo-transaction';
import { validarAlocacoesPlantao, calcularPendenciasCobertura, type AlocacaoPlantaoValidacao } from '../escalas/regras-plantao';
import { calcularBloqueiosDoProfissional, diasDoMes } from '../escalas/montar-problema';
import { AuditoriaTroca, AuditoriaEscala, Escala, NotificacaoTroca, Plantao, PlantaoProfissional, SolicitacaoTroca, StatusEscala, StatusTroca, TipoPlantao, VersaoEscala } from '../escalas/schemas';
import { Formacao, StatusProfissional } from '../profissionais/profissionais.enums';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { Restricao } from '../restricoes/restricao.schema';
import { Administrador } from '../usuarios/schemas/administrador.schema';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import type { AprovarTrocaDto, RecusarTrocaDto } from './dto/decidir-troca.dto';
import { Setor } from '../setores/schemas/setor.schema';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { ListarHistoricoTrocasDto } from './dto/listar-historico-trocas.dto';
import { FiltroTroca, ListarTrocasDto } from './dto/listar-trocas.dto';

type TrocaRead = SolicitacaoTroca & { _id: Types.ObjectId };
export type AlocacaoMemoria = {
  vinculo: PlantaoProfissional & { _id: Types.ObjectId };
  plantao: Plantao & { _id: Types.ObjectId };
};
export type ContextoValidacaoCandidatos = {
  escala: Escala & { _id: Types.ObjectId };
  configuracao: {
    periodo: string;
    limiteTrocas: number;
    maxExtras: number;
    limitePlantoes: number;
    maxExtrasConcursado: number;
    maxExtrasClt: number;
    cargas: Record<string, { plantoes24h: number; plantoes12h: number }>;
  } | null;
  profissionaisPorId: Map<string, Profissional & { _id: Types.ObjectId }>;
  profissionaisPorCategoria: Map<string, (Profissional & { _id: Types.ObjectId })[]>;
  setoresPorId: Map<string, Setor>;
  restricoesPorProfissional: Map<string, Restricao[]>;
  plantoesPorProfissional: Map<string, AlocacaoMemoria[]>;
  plantoesPorDataTurno: Map<string, AlocacaoMemoria[]>;
  vinculosPorId: Map<string, PlantaoProfissional & { _id: Types.ObjectId }>;
  plantaoPorId: Map<string, Plantao & { _id: Types.ObjectId }>;
  cargaMensalPorProfissional: Map<string, { horas: number; regulares24h: number; regulares12h: number; extras: number; total: number }>;
  coberturaPorSetorDataTurnoFuncao: Map<string, number>;
  nomePorProfissionalId: Map<string, string>;
};
const STATUS_POR_FILTRO: Record<FiltroTroca, StatusTroca[]> = {
  pendentes: [StatusTroca.AGUARDANDO_COORDENACAO],
  aprovadas: [StatusTroca.APROVADA],
  recusadas: [StatusTroca.RECUSADA_PELA_COORDENACAO, StatusTroca.RECUSADA_PELO_PROFISSIONAL],
};

@Injectable()
export class TrocasService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(SolicitacaoTroca.name) private readonly trocas: Model<SolicitacaoTroca>,
    @InjectModel(AuditoriaTroca.name) private readonly auditoriasTroca: Model<AuditoriaTroca>,
    @InjectModel(AuditoriaEscala.name) private readonly auditoriasEscala: Model<AuditoriaEscala>,
    @InjectModel(NotificacaoTroca.name) private readonly notificacoes: Model<NotificacaoTroca>,
    @InjectModel(VersaoEscala.name) private readonly versoes: Model<VersaoEscala>,
    @InjectModel(PlantaoProfissional.name) private readonly vinculos: Model<PlantaoProfissional>,
    @InjectModel(Plantao.name) private readonly plantoes: Model<Plantao>,
    @InjectModel(Escala.name) private readonly escalas: Model<Escala>,
    @InjectModel(Profissional.name) private readonly profissionais: Model<Profissional>,
    @InjectModel(Usuario.name) private readonly usuarios: Model<Usuario>,
    @InjectModel(Setor.name) private readonly setores: Model<Setor>,
    @InjectModel(Restricao.name) private readonly restricoes: Model<Restricao>,
    @InjectModel(Administrador.name) private readonly administradores: Model<Administrador>,
    @InjectModel(Configuracao.name) private readonly configuracoes: Model<Configuracao>,
  ) {}

  async contarTrocasRecebidas(profissionalId: string) {
    if (!profissionalId) throw new NotFoundException('Profissional autenticado não encontrado.');
    const recebidas = await this.trocas.countDocuments({
      profissionalSolicitadoId: new Types.ObjectId(profissionalId),
      status: StatusTroca.AGUARDANDO_RESPOSTA,
    }).exec();
    return { recebidas };
  }

  async listar(dto: ListarTrocasDto) {
    const filtro: Record<string, unknown> = { status: { $in: STATUS_POR_FILTRO[dto.status] } };
    if (dto.mes !== undefined || dto.ano !== undefined) {
      if (dto.mes !== undefined) filtro.mes = dto.mes;
      if (dto.ano !== undefined) filtro.ano = dto.ano;
    }
    const contagensPorStatus = await Promise.all((Object.entries(STATUS_POR_FILTRO) as [FiltroTroca, StatusTroca[]][]).map(async ([status, statuses]) => [
      status,
      await this.trocas.countDocuments({ ...filtro, status: { $in: statuses } }).exec(),
    ] as const));
    const [docs, total, aguardandoCoordenacao] = await Promise.all([
      this.trocas.find(filtro).sort({ criadaEm: -1, _id: -1 }).skip((dto.pagina - 1) * dto.limite).limit(dto.limite).lean().exec(),
      this.trocas.countDocuments(filtro).exec(),
      this.trocas.countDocuments({ status: StatusTroca.AGUARDANDO_COORDENACAO }).exec(),
    ]);
    return {
      itens: await Promise.all(docs.map((doc) => this.resumo(doc as TrocaRead))),
      pagina: dto.pagina,
      limite: dto.limite,
      total,
      totalPaginas: Math.ceil(total / dto.limite),
      contadores: { ...Object.fromEntries(contagensPorStatus), aguardandoCoordenacao },
    };
  }

  async listarHistorico(dto: ListarHistoricoTrocasDto) {
    const inicio = new Date(Date.UTC(dto.ano, 0, 1));
    const fim = new Date(Date.UTC(dto.ano + 1, 0, 1));
    const filtro = {
      status: {
        $in: [
          StatusTroca.APROVADA,
          StatusTroca.RECUSADA_PELA_COORDENACAO,
          StatusTroca.RECUSADA_PELO_PROFISSIONAL,
        ],
      },
      updatedAt: { $gte: inicio, $lt: fim },
    };
    const [docs, total] = await Promise.all([
      this.trocas.find(filtro)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((dto.pagina - 1) * dto.limite)
        .limit(dto.limite)
        .lean()
        .exec(),
      this.trocas.countDocuments(filtro).exec(),
    ]);

    const profissionaisIds = [...new Set(docs.flatMap((troca) => [
      String(troca.solicitanteProfissionalId),
      String(troca.profissionalSolicitadoId),
    ]))].map((id) => new Types.ObjectId(id));
    const profissionais = await this.profissionais
      .find({ _id: { $in: profissionaisIds } })
      .select('_id usuarioId')
      .lean()
      .exec();
    const usuariosIds = [...new Set([
      ...profissionais.map((profissional) => String(profissional.usuarioId)),
      ...docs.flatMap((troca) => troca.decisaoCoordenacao ? [String(troca.decisaoCoordenacao.usuarioId)] : []),
    ])].map((id) => new Types.ObjectId(id));
    const usuarios = await this.usuarios
      .find({ _id: { $in: usuariosIds } })
      .select('_id nome')
      .lean()
      .exec();
    const nomeUsuarioPorId = new Map(usuarios.map((usuario) => [String(usuario._id), usuario.nome]));
    const nomeProfissionalPorId = new Map(profissionais.map((profissional) => [
      String(profissional._id),
      nomeUsuarioPorId.get(String(profissional.usuarioId)) ?? 'Profissional indisponível',
    ]));
    const itens = docs.map((troca) => {
      const decisao = troca.decisaoCoordenacao;
      const nomeSolicitado = nomeProfissionalPorId.get(String(troca.profissionalSolicitadoId)) ?? 'Profissional indisponível';
      return {
        id: String(troca._id),
        decididaEm: decisao?.decididaEm ?? troca.updatedAt ?? troca.criadaEm,
        solicitante: { nome: nomeProfissionalPorId.get(String(troca.solicitanteProfissionalId)) ?? 'Profissional indisponível' },
        profissionalSolicitado: { nome: nomeSolicitado },
        resultado: troca.status === StatusTroca.APROVADA ? 'aprovada' as const : 'recusada' as const,
        responsavel: {
          nome: decisao
            ? nomeUsuarioPorId.get(String(decisao.usuarioId)) ?? 'Usuário indisponível'
            : nomeSolicitado,
        },
      };
    });

    return {
      ano: dto.ano,
      itens,
      pagina: dto.pagina,
      limite: dto.limite,
      total,
      totalPaginas: Math.ceil(total / dto.limite),
    };
  }

  async detalhe(id: string) {
    const troca = await this.trocas.findById(id).lean().exec();
    if (!troca) throw new NotFoundException('Solicitação de troca não encontrada.');
    const [solicitado, historico] = await Promise.all([
      this.resumo(troca as TrocaRead),
      this.auditoriasTroca.find({ solicitacaoId: troca._id }).sort({ decididaEm: -1 }).lean().exec(),
    ]);
    const detalhes = { ...solicitado,
      historico: await Promise.all(historico.map(async (item) => ({ resultado: item.resultado, decididaEm: item.decididaEm,
        justificativa: item.justificativa ?? null, excecaoLimite: item.excecaoLimite,
        responsavel: (await this.usuarios.findById(item.usuarioId).select('nome').lean().exec())?.nome ?? 'Coordenação',
        versoesEscala: item.versoesEscala, }))) };
    return detalhes;
  }

  async aprovar(id: string, dto: AprovarTrocaDto, usuario: UsuarioAutenticado) {
    this.exigirTransacoesConfirmadas();
    const existente = await this.trocas.findById(id).lean().exec();
    if (!existente) throw new NotFoundException('Solicitação de troca não encontrada.');
    if (existente.status === StatusTroca.APROVADA && existente.chaveIdempotencia === dto.operacaoId) return this.detalhe(id);
    try { await executarTransacao(this.connection, async (session) => {
      const troca = await this.trocas.findById(id).session(session).lean().exec();
      if (!troca) throw new NotFoundException('Solicitação de troca não encontrada.');
      if (troca.status !== StatusTroca.AGUARDANDO_COORDENACAO) throw new ConflictException('A solicitação já recebeu uma decisão ou aguarda o aceite do profissional.');
      const validacao = await this.validarNoBanco(troca._id, session);
      if (validacao.revisaoEsperada !== dto.revisaoEsperada) throw new ConflictException('A escala foi atualizada desde a consulta. Recarregue os dados e valide novamente.');
      const limiteBloqueia = validacao.avisos.some((item) => item.codigo === 'LIMITE_ATINGIDO');
      if (limiteBloqueia && (!dto.excecaoLimite || !dto.justificativa?.trim())) {
        throw new UnprocessableEntityException({ message: 'O limite mensal de trocas foi atingido.', erros: ['Somente a Coordenação pode autorizar uma exceção com justificativa.'], impedimentos: validacao.avisos });
      }
      if (!limiteBloqueia && dto.excecaoLimite) throw new UnprocessableEntityException('Não é necessária uma exceção de limite para esta troca.');
      const bloqueios = validacao.impedimentos;
      if (bloqueios.length) throw new UnprocessableEntityException({ message: 'A troca não pode ser aprovada.', impedimentos: bloqueios });
      const vinculoA = await this.vinculos.findById(troca.vinculoSolicitanteId).session(session).lean().exec();
      const vinculoB = await this.vinculos.findById(troca.vinculoSolicitadoId).session(session).lean().exec();
      if (!vinculoA || !vinculoB) throw new ConflictException('Um dos plantões mudou na escala. Solicite uma nova troca.');
      const plantaoA = await this.plantoes.findById(vinculoA.plantaoId).session(session).lean().exec();
      const plantaoB = await this.plantoes.findById(vinculoB.plantaoId).session(session).lean().exec();
      if (!plantaoA || !plantaoB || String(plantaoA.escalaId) !== String(plantaoB.escalaId)) throw new ConflictException('Os plantões estão em escalas diferentes. Solicite uma nova troca.');
      const escala = await this.escalas.findById(plantaoA.escalaId).session(session).lean().exec();
      if (!escala || escala.status !== StatusEscala.PUBLICADA || escala.revisao !== dto.revisaoEsperada || escala.versaoPublicada !== validacao.versaoPublicada) throw new ConflictException('A escala mudou desde a consulta. Atualize os dados e valide novamente.');
      const a = await this.vinculos.updateOne({ _id: vinculoA._id, profissionalId: vinculoA.profissionalId }, { $set: { profissionalId: vinculoB.profissionalId } }, { session });
      const b = await this.vinculos.updateOne({ _id: vinculoB._id, profissionalId: vinculoB.profissionalId }, { $set: { profissionalId: vinculoA.profissionalId } }, { session });
      if (a.modifiedCount !== 1 || b.modifiedCount !== 1) throw new ConflictException('Um dos plantões mudou durante a aprovação. Atualize os dados e valide novamente.');
      const numero = escala.versaoPublicada + 1;
      const revisaoNova = escala.revisao + 1;
      const mudou = await this.escalas.updateOne({ _id: escala._id, status: StatusEscala.PUBLICADA, revisao: dto.revisaoEsperada, versaoPublicada: escala.versaoPublicada },
        { $inc: { revisao: 1 }, $set: { versaoPublicada: numero } }, { session });
      if (mudou.modifiedCount !== 1) throw new ConflictException('A escala foi atualizada por outra operação.');
      const escalaNova = await this.escalas.findById(escala._id).session(session).lean().exec();
      const plantoes = await this.plantoes.find({ escalaId: escala._id }).sort({ data: 1, horarioInicio: 1 }).session(session).lean().exec();
      const relacoes = await this.vinculos.find({ plantaoId: { $in: plantoes.map((item) => item._id) } }).session(session).lean().exec();
      if (!escalaNova) throw new NotFoundException('Escala não encontrada.');
      const anterior = await this.versoes.findOne({ escalaId: escala._id }).sort({ numero: -1 }).session(session).lean().exec();
      const geracao = (escala.geracao ?? {}) as { pendencias?: unknown[]; conflitos?: unknown[]; avisos?: unknown[]; cargas?: unknown[] };
      const snapshot = { escala: escalaNova, plantoes, profissionaisRelacionados: relacoes,
        pendencias: geracao.pendencias ?? [], conflitos: geracao.conflitos ?? [], avisos: geracao.avisos ?? [], cargas: geracao.cargas ?? [] };
      const administrador = await this.administradores.findOne({ usuarioId: new Types.ObjectId(usuario.id) }).session(session).lean().exec();
      if (!administrador) throw new ConflictException('Usuário autenticado não possui registro de Coordenação.');
      const agora = new Date();
      await this.versoes.create([{ escalaId: escala._id, numero, mes: escala.mes, ano: escala.ano, publicadoPor: administrador._id, publicadoEm: agora, snapshot, pendenciasConfirmadas: Boolean(anterior?.pendenciasConfirmadas) }], { session });
      const chaveDecisao = `troca:${String(troca._id)}:${dto.operacaoId}`;
      const decisao = await this.trocas.updateOne({ _id: troca._id, status: StatusTroca.AGUARDANDO_COORDENACAO }, { $set: {
        status: StatusTroca.APROVADA, chaveIdempotencia: dto.operacaoId,
        decisaoCoordenacao: { resultado: 'aprovada', usuarioId: new Types.ObjectId(usuario.id), decididaEm: agora,
          justificativa: dto.justificativa?.trim() || undefined, excecaoLimite: Boolean(dto.excecaoLimite),
          versoesEscala: [{ ano: escala.ano, mes: escala.mes, numero }] },
      } }, { session });
      if (decisao.modifiedCount !== 1) throw new ConflictException('A solicitação foi decidida por outra operação.');
      const versoes = [{ ano: escala.ano, mes: escala.mes, numero }];
      await this.auditoriasTroca.create([{ solicitacaoId: troca._id, usuarioId: new Types.ObjectId(usuario.id), resultado: 'aprovada', decididaEm: agora,
        justificativa: dto.justificativa?.trim(), excecaoLimite: Boolean(dto.excecaoLimite), operacaoId: dto.operacaoId,
        vinculos: [{ vinculoId: String(vinculoA._id), plantaoId: String(plantaoA._id), de: String(vinculoA.profissionalId), para: String(vinculoB.profissionalId) },
          { vinculoId: String(vinculoB._id), plantaoId: String(plantaoB._id), de: String(vinculoB.profissionalId), para: String(vinculoA.profissionalId) }], versoesEscala: versoes }], { session });
      await this.auditoriasEscala.create([{ escalaId: escala._id, revisao: revisaoNova, acao: 'troca_aprovada', usuarioId: new Types.ObjectId(usuario.id), ocorridoEm: agora,
        detalhes: { solicitacaoId: String(troca._id), operacaoId: dto.operacaoId, versao: numero } }], { session });
      const profissionais = await this.profissionais.find({ _id: { $in: [troca.solicitanteProfissionalId, troca.profissionalSolicitadoId] } }).select('usuarioId').session(session).lean().exec();
      const userIds = [...new Set(profissionais.map((p) => String(p.usuarioId)))];
      await this.notificacoes.insertMany(userIds.map((destinatarioId) => ({ solicitacaoId: troca._id, destinatarioId: new Types.ObjectId(destinatarioId), eventKey: chaveDecisao,
        titulo: 'Troca de plantão aprovada', mensagem: 'A Coordenação aprovou a troca.' })), { session });
    }); } catch (erro) {
      const resultado = await this.trocas.findById(id).lean().exec();
      if (resultado?.status === StatusTroca.APROVADA && resultado.chaveIdempotencia === dto.operacaoId) return this.detalhe(id);
      throw erro;
    }
    return this.detalhe(id);
  }

  async recusar(id: string, dto: RecusarTrocaDto, usuario: UsuarioAutenticado) {
    this.exigirTransacoesConfirmadas();
    const existente = await this.trocas.findById(id).lean().exec();
    if (!existente) throw new NotFoundException('Solicitação de troca não encontrada.');
    if (existente.status === StatusTroca.RECUSADA_PELA_COORDENACAO && existente.chaveIdempotencia === dto.operacaoId) return this.detalhe(id);
    const justificativa = dto.justificativa?.trim() || undefined;
    try { await executarTransacao(this.connection, async (session) => {
      const troca = await this.trocas.findById(id).session(session).lean().exec();
      if (!troca) throw new NotFoundException('Solicitação de troca não encontrada.');
      if (troca.status !== StatusTroca.AGUARDANDO_COORDENACAO || !troca.aceite || String(troca.aceite.profissionalId) !== String(troca.profissionalSolicitadoId)) throw new ConflictException('A solicitação não está aguardando decisão da Coordenação.');
      const agora = new Date();
      const versaoOriginal = troca.resumoOriginal?.versaoOficial;
      const atualizada = await this.trocas.updateOne({ _id: troca._id, status: StatusTroca.AGUARDANDO_COORDENACAO }, { $set: {
        status: StatusTroca.RECUSADA_PELA_COORDENACAO, chaveIdempotencia: dto.operacaoId,
        decisaoCoordenacao: { resultado: 'recusada', usuarioId: new Types.ObjectId(usuario.id), decididaEm: agora, justificativa, versoesEscala: typeof versaoOriginal === 'number' ? [{ ano: troca.ano, mes: troca.mes, numero: versaoOriginal }] : [] },
      } }, { session });
      if (atualizada.modifiedCount !== 1) throw new ConflictException('A solicitação foi decidida por outra operação.');
      const versoesEscala = typeof versaoOriginal === 'number' ? [{ ano: troca.ano, mes: troca.mes, numero: versaoOriginal }] : [];
      await this.auditoriasTroca.create([{ solicitacaoId: troca._id, usuarioId: new Types.ObjectId(usuario.id), resultado: 'recusada', decididaEm: agora,
        justificativa, excecaoLimite: false, operacaoId: dto.operacaoId,
        vinculos: [], versoesEscala }], { session });
      const profissionais = await this.profissionais.find({ _id: { $in: [troca.solicitanteProfissionalId, troca.profissionalSolicitadoId] } }).select('usuarioId').session(session).lean().exec();
      const userIds = [...new Set(profissionais.map((p) => String(p.usuarioId)))];
      await this.notificacoes.insertMany(userIds.map((destinatarioId) => ({ solicitacaoId: troca._id, destinatarioId: new Types.ObjectId(destinatarioId), eventKey: `troca:${String(troca._id)}:${dto.operacaoId}`,
        titulo: 'Troca de plantão recusada', mensagem: justificativa ? `A Coordenação recusou a troca: ${justificativa}` : 'A Coordenação recusou a troca. Sem motivo informado.' })), { session });
    }); } catch (erro) {
      const resultado = await this.trocas.findById(id).lean().exec();
      if (resultado?.status === StatusTroca.RECUSADA_PELA_COORDENACAO && resultado.chaveIdempotencia === dto.operacaoId) return this.detalhe(id);
      throw erro;
    }
    return this.detalhe(id);
  }

  exigirTransacoesConfirmadas() {
    if (process.env.NODE_ENV === 'production' && process.env.MONGO_TRANSACTIONS_CONFIRMED !== 'true') {
      throw new ServiceUnavailableException('Decisões de troca estão desabilitadas até a confirmação de replica set/transações no MongoDB de produção.');
    }
  }

  async validar(id: string) {
    return this.validarNoBanco(new Types.ObjectId(id));
  }

  async prepararCacheValidacaoPares(vinculoIds: string[], plantaoIds: string[], escalaId: string) {
    const cache = new Map<string, Promise<unknown>>();
    const idsVinculos = [...new Set(vinculoIds)].map((id) => new Types.ObjectId(id));
    const idsPlantoes = [...new Set(plantaoIds)].map((id) => new Types.ObjectId(id));
    const [vinculos, plantoes, escala] = await Promise.all([
      this.vinculos.find({ _id: { $in: idsVinculos } }).lean().exec(),
      this.plantoes.find({ _id: { $in: idsPlantoes } }).lean().exec(),
      this.escalas.findById(escalaId).lean().exec(),
    ]);
    vinculos.forEach((vinculo) => cache.set(`vinculo:${String(vinculo._id)}`, Promise.resolve(vinculo)));
    plantoes.forEach((plantao) => cache.set(`plantao:${String(plantao._id)}`, Promise.resolve(plantao)));
    if (escala) cache.set(`escala:${String(escala._id)}`, Promise.resolve(escala));
    return cache;
  }

  async prepararContextoValidacaoCandidatos(escalaId: string): Promise<ContextoValidacaoCandidatos> {
    // Uma carga para toda a busca: escala, vínculos, plantões, profissionais,
    // setores, restrições e configuração ficam em memória.
    const escala = await this.escalas.findById(escalaId).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');

    const plantoes = await this.plantoes.find({ escalaId: escala._id }).lean().exec();
    const vinculos = await this.vinculos.find({ plantaoId: { $in: plantoes.map((item) => item._id) } }).lean().exec();
    const profissionalIds = [...new Set(vinculos.map((item) => String(item.profissionalId)))].map((id) => new Types.ObjectId(id));
    const setorIds = [...new Set(plantoes.map((item) => String(item.setorId)))].map((id) => new Types.ObjectId(id));
    const chaveConfiguracao = `${String(escala.ano).padStart(4, '0')}-${String(escala.mes).padStart(2, '0')}`;

    const [profissionais, setores, restricoes, configuracaoDoc, adjacentes] = await Promise.all([
      this.profissionais.find({ _id: { $in: profissionalIds } }).lean().exec(),
      this.setores.find({ _id: { $in: setorIds } }).lean().exec(),
      this.restricoes.find({ profissionalId: { $in: profissionalIds }, inicio: { $lte: utcDate(escala.ano, escala.mes - 1, diasDoMes(escala.ano, escala.mes), 23, 59, 59, 999) }, fim: { $gte: utcDate(escala.ano, escala.mes - 1, 1) } }).lean().exec(),
      this.configuracoes.findOne({ chave: chaveConfiguracao }).lean().exec(),
      this.escalas.find({
        $or: [
          { ano: escala.mes === 1 ? escala.ano - 1 : escala.ano, mes: escala.mes === 1 ? 12 : escala.mes - 1 },
          { ano: escala.mes === 12 ? escala.ano + 1 : escala.ano, mes: escala.mes === 12 ? 1 : escala.mes + 1 },
        ],
      }).lean().exec(),
    ]);

    const adjacentesIds = adjacentes.map((item) => item._id);
    const plantoesAdjacentes = adjacentesIds.length ? await this.plantoes.find({ escalaId: { $in: adjacentesIds } }).lean().exec() : [];
    const vinculosAdjacentes = plantoesAdjacentes.length
      ? await this.vinculos.find({ plantaoId: { $in: plantoesAdjacentes.map((item) => item._id) }, profissionalId: { $in: profissionalIds } }).lean().exec()
      : [];
    const usuarios = await this.usuarios.find({
      _id: { $in: profissionais.map((profissional) => profissional.usuarioId) },
    }).lean().exec();
    const nomePorUsuarioId = new Map(usuarios.map((usuario) => [String(usuario._id), usuario.nome]));
    const nomePorProfissionalId = new Map(profissionais.map((profissional) =>
      [String(profissional._id), nomePorUsuarioId.get(String(profissional.usuarioId)) ?? 'Profissional']));

    const configuracao = configuracaoDoc ? {
      periodo: configuracaoDoc.chave,
      limiteTrocas: configuracaoDoc.limiteTrocas,
      maxExtras: configuracaoDoc.maxExtras,
      limitePlantoes: configuracaoDoc.limitePlantoes,
      maxExtrasConcursado: configuracaoDoc.maxExtrasConcursado,
      maxExtrasClt: configuracaoDoc.maxExtrasClt,
      cargas: configuracaoDoc.cargas,
    } : null;

    const profissionaisPorId = new Map(profissionais.map((item) => [String(item._id), item as Profissional & { _id: Types.ObjectId }]));
    const profissionaisPorCategoria = new Map<string, (Profissional & { _id: Types.ObjectId })[]>();
    for (const profissional of profissionais) {
      const lista = profissionaisPorCategoria.get(profissional.formacao) ?? [];
      lista.push(profissional);
      profissionaisPorCategoria.set(profissional.formacao, lista);
    }
    const setoresPorId = new Map(setores.map((item) => [String(item._id), item]));
    const restricoesPorProfissional = new Map<string, Restricao[]>();
    for (const restricao of restricoes) {
      const lista = restricoesPorProfissional.get(String(restricao.profissionalId)) ?? [];
      lista.push(restricao);
      restricoesPorProfissional.set(String(restricao.profissionalId), lista);
    }

    const plantaoPorId = new Map<string, Plantao & { _id: Types.ObjectId }>();
    for (const plantao of [...plantoes, ...plantoesAdjacentes]) plantaoPorId.set(String(plantao._id), plantao as Plantao & { _id: Types.ObjectId });

    const vinculosPorId = new Map<string, PlantaoProfissional & { _id: Types.ObjectId }>();
    for (const vinculo of [...vinculos, ...vinculosAdjacentes]) vinculosPorId.set(String(vinculo._id), vinculo as PlantaoProfissional & { _id: Types.ObjectId });

    const plantoesPorProfissional = new Map<string, AlocacaoMemoria[]>();
    const plantoesPorDataTurno = new Map<string, AlocacaoMemoria[]>();
    for (const vinculo of [...vinculos, ...vinculosAdjacentes]) {
      const plantao = plantaoPorId.get(String(vinculo.plantaoId));
      if (!plantao) continue;
      const alocacao: AlocacaoMemoria = {
        vinculo: vinculo as PlantaoProfissional & { _id: Types.ObjectId },
        plantao: plantao as Plantao & { _id: Types.ObjectId },
      };
      const profissionalId = String(vinculo.profissionalId);
      const lista = plantoesPorProfissional.get(profissionalId) ?? [];
      lista.push(alocacao);
      plantoesPorProfissional.set(profissionalId, lista);
      const data = new Date(plantao.data).toISOString().slice(0, 10);
      const turnos = plantao.duracaoHoras >= 24 ? ['diurno', 'noturno'] : [plantao.horarioInicio === '07:00' ? 'diurno' : 'noturno'];
      for (const turno of turnos) {
        const chave = `${data}|${turno}`;
        const turnoLista = plantoesPorDataTurno.get(chave) ?? [];
        turnoLista.push(alocacao);
        plantoesPorDataTurno.set(chave, turnoLista);
      }
    }
    for (const lista of plantoesPorProfissional.values()) {
      lista.sort((a, b) => this.inicioAlocacao(a).getTime() - this.inicioAlocacao(b).getTime());
    }

    const cargaMensalPorProfissional = new Map<string, { horas: number; regulares24h: number; regulares12h: number; extras: number; total: number }>();
    for (const lista of plantoesPorProfissional.values()) {
      for (const alocacao of lista) {
        if (String(alocacao.plantao.escalaId) !== String(escala._id)) continue;
        const profissionalId = String(alocacao.vinculo.profissionalId);
        const atual = cargaMensalPorProfissional.get(profissionalId) ?? { horas: 0, regulares24h: 0, regulares12h: 0, extras: 0, total: 0 };
        atual.horas += alocacao.plantao.duracaoHoras;
        atual.total++;
        if (alocacao.plantao.tipo === TipoPlantao.REGULAR && alocacao.plantao.duracaoHoras === 24) atual.regulares24h++;
        if (alocacao.plantao.tipo === TipoPlantao.REGULAR && alocacao.plantao.duracaoHoras === 12) atual.regulares12h++;
        if (alocacao.plantao.tipo === TipoPlantao.EXTRA) atual.extras++;
        cargaMensalPorProfissional.set(profissionalId, atual);
      }
    }

    const coberturaPorSetorDataTurnoFuncao = new Map<string, number>();
    for (const vinculo of vinculos) {
      const plantao = plantaoPorId.get(String(vinculo.plantaoId));
      if (!plantao) continue;
      const alocacao: AlocacaoMemoria = { vinculo: vinculo as PlantaoProfissional & { _id: Types.ObjectId }, plantao };
      const data = new Date(alocacao.plantao.data).toISOString().slice(0, 10);
      const turnos = alocacao.plantao.duracaoHoras >= 24
        ? ['diurno', 'noturno']
        : [alocacao.plantao.horarioInicio === '07:00' ? 'diurno' : 'noturno'];
      for (const turno of turnos) {
        const chave = `${String(alocacao.plantao.setorId)}|${data}|${turno}|${alocacao.vinculo.funcao}`;
        coberturaPorSetorDataTurnoFuncao.set(chave, (coberturaPorSetorDataTurnoFuncao.get(chave) ?? 0) + 1);
      }
    }

    return {
      escala: escala as Escala & { _id: Types.ObjectId }, configuracao, profissionaisPorId, profissionaisPorCategoria,
      setoresPorId, restricoesPorProfissional, plantoesPorProfissional,
      plantoesPorDataTurno, vinculosPorId, plantaoPorId,
      cargaMensalPorProfissional, coberturaPorSetorDataTurnoFuncao,
      nomePorProfissionalId,
    };
  }

  async validarParEmMemoria(
    vinculoSolicitanteId: string,
    vinculoSolicitadoId: string,
    contexto: ContextoValidacaoCandidatos,
    cache?: Map<string, Promise<{ impedimentos: { codigo: string; mensagem: string }[] }>>,
  ) {
    const chave = `${vinculoSolicitanteId}:${vinculoSolicitadoId}`;
    if (cache) {
      const existente = cache.get(chave);
      if (existente) return existente;
    }

    const validar = (async () => {
      const impedimentos: { codigo: string; mensagem: string }[] = [];
      const vinculoA = contexto.vinculosPorId.get(vinculoSolicitanteId);
      const vinculoB = contexto.vinculosPorId.get(vinculoSolicitadoId);
      const plantaoA = vinculoA ? contexto.plantaoPorId.get(String(vinculoA.plantaoId)) : undefined;
      const plantaoB = vinculoB ? contexto.plantaoPorId.get(String(vinculoB.plantaoId)) : undefined;
      if (!vinculoA || !vinculoB || !plantaoA || !plantaoB) {
        return { impedimentos: [{ codigo: 'VINCULOS_INVALIDOS', mensagem: 'Um dos plantões mudou na escala. Recuse esta solicitação e peça outra.' }] };
      }
      if (String(plantaoA.escalaId) !== String(plantaoB.escalaId) ||
        contexto.escala._id && String(plantaoA.escalaId) !== String(contexto.escala._id)) {
        impedimentos.push({ codigo: 'ESCALAS_DIFERENTES', mensagem: 'Os plantões estão em escalas diferentes. Recuse esta solicitação e escolha outra.' });
      }
      const profissionalA = contexto.profissionaisPorId.get(String(vinculoA.profissionalId));
      const profissionalB = contexto.profissionaisPorId.get(String(vinculoB.profissionalId));
      if (!profissionalA || !profissionalB) {
        return { impedimentos: [{ codigo: 'PROFISSIONAL_AUSENTE', mensagem: 'Um profissional não está mais cadastrado. Recuse esta solicitação.' }] };
      }

      const afetados = [
        { profissional: profissionalA, vinculo: vinculoA, plantao: plantaoA, destino: vinculoB, destinoPlantao: plantaoB },
        { profissional: profissionalB, vinculo: vinculoB, plantao: plantaoB, destino: vinculoA, destinoPlantao: plantaoA },
      ];

      for (const item of afetados) {
        if (item.profissional.status !== StatusProfissional.ATIVO) {
          impedimentos.push({ codigo: 'PROFISSIONAL_INATIVO', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} não está ativo. Aguarde ou recuse esta solicitação.` });
        }
        if (item.destino.funcao !== item.profissional.formacao) {
          impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} não tem a categoria deste plantão. Escolha um colega compatível.` });
        }
        if (item.profissional.formacao === Formacao.TECNICO && item.destino.lideranca) {
          impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} não pode assumir função de liderança ou Enfermeiro-chefe.` });
        }

        const dataDestino = new Date(item.destinoPlantao.data).toISOString().slice(0, 10);
        const jaEscaladoNoDia = (contexto.plantoesPorProfissional.get(String(item.profissional._id)) ?? [])
          .filter((alocacao) => String(alocacao.vinculo._id) !== String(vinculoA._id)
            && String(alocacao.vinculo._id) !== String(vinculoB._id))
          .some((alocacao) => new Date(alocacao.plantao.data).toISOString().slice(0, 10) === dataDestino);
        if (jaEscaladoNoDia) {
          impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} já está escalado em ${this.formatarData(item.destinoPlantao.data)}. Escolha outra data.` });
        }

        const dataAfetada = new Date(item.destinoPlantao.data);
        const restricoes = contexto.restricoesPorProfissional.get(String(item.profissional._id)) ?? [];
        const bloqueios = calcularBloqueiosDoProfissional(
          restricoes.map((r) => ({
            profissionalId: String(r.profissionalId),
            tipo: r.tipo,
            inicio: r.inicio,
            fim: r.fim,
            diasSemana: r.diasSemana,
            diaSemana: r.diaSemana,
            turno: r.turno,
          })),
          contexto.escala.ano,
          contexto.escala.mes,
        );
        const dia = dataAfetada.getUTCDate();
        if (bloqueios.diasBloqueados.includes(dia)) {
          impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} está indisponível em ${this.formatarData(item.destinoPlantao.data)}. Escolha outra data.` });
        } else {
          const turnos = item.destinoPlantao.duracaoHoras >= 24
            ? ['diurno', 'noturno']
            : [item.destinoPlantao.horarioInicio === '07:00' ? 'diurno' : 'noturno'];
          if (turnos.some((turno) => bloqueios.turnosBloqueados.some((tb) => tb.dia === dia && tb.turno === turno))) {
            impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} não pode fazer este turno em ${this.formatarData(item.destinoPlantao.data)}. Escolha outro.` });
          }
        }

        // Busca binária: considera apenas plantões do profissional em ±4 dias
        // em torno de cada uma das duas datas afetadas pela permuta.
        const vizinhos = this.buscarPlantaoVizinhanca(
          contexto.plantoesPorProfissional.get(String(item.profissional._id)) ?? [],
          [dataAfetada, new Date(item.plantao.data)],
          4,
        );
        if (this.existeConflitoJornada(vizinhos, item.destinoPlantao, String(vinculoA._id), String(vinculoB._id))) {
          impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} terá intervalo insuficiente. Escolha outro plantão.` });
        }

        // Carga mensal pré-calculada no contexto: aplica somente o delta da permuta.
        const cargaAtual = { ...(contexto.cargaMensalPorProfissional.get(String(item.profissional._id)) ?? {
          horas: 0, regulares24h: 0, regulares12h: 0, extras: 0, total: 0,
        }) };
        cargaAtual.horas -= item.plantao.duracaoHoras;
        cargaAtual.total--;
        if (item.plantao.tipo === TipoPlantao.REGULAR && item.plantao.duracaoHoras === 24) cargaAtual.regulares24h--;
        if (item.plantao.tipo === TipoPlantao.REGULAR && item.plantao.duracaoHoras === 12) cargaAtual.regulares12h--;
        if (item.plantao.tipo === TipoPlantao.EXTRA) cargaAtual.extras--;
        cargaAtual.horas += item.destinoPlantao.duracaoHoras;
        cargaAtual.total++;
        if (item.destinoPlantao.tipo === TipoPlantao.REGULAR && item.destinoPlantao.duracaoHoras === 24) cargaAtual.regulares24h++;
        if (item.destinoPlantao.tipo === TipoPlantao.REGULAR && item.destinoPlantao.duracaoHoras === 12) cargaAtual.regulares12h++;
        if (item.destinoPlantao.tipo === TipoPlantao.EXTRA) cargaAtual.extras++;
        const carga = contexto.configuracao?.cargas[
          `${item.profissional.tipoVinculo}_${diasDoMes(contexto.escala.ano, contexto.escala.mes)}`
        ];
        if (carga && (cargaAtual.regulares24h > carga.plantoes24h || cargaAtual.regulares12h > carga.plantoes12h)) {
          impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} ultrapassa a carga mensal. Escolha outro plantão.` });
        }
        let maxExtras = contexto.configuracao?.maxExtras ?? 0;
        if (item.profissional.tipoVinculo === 'concursado' && (contexto.configuracao?.maxExtrasConcursado ?? 0) > 0) maxExtras = contexto.configuracao!.maxExtrasConcursado;
        if (item.profissional.tipoVinculo === 'clt' && (contexto.configuracao?.maxExtrasClt ?? 0) > 0) maxExtras = contexto.configuracao!.maxExtrasClt;
        if (cargaAtual.extras > maxExtras) {
          impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} ultrapassaria o limite de extras. Escolha outra opção.` });
        }
        if ((contexto.configuracao?.limitePlantoes ?? 0) > 0 && cargaAtual.total > contexto.configuracao!.limitePlantoes) {
          impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} ultrapassa o limite mensal. Escolha outro plantão.` });
        }
        if (item.profissional.tipoVinculo === 'rpa' && cargaAtual.total > cargaAtual.extras) {
          impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: `${this.primeiroNomeProfissional(contexto, String(item.profissional._id))} só pode fazer plantões extras. Escolha outro tipo.` });
        }
      }

      // Cobertura mínima por (setor, data, turno): aplica o delta dos dois lados
      // a partir dos contadores pré-calculados.
      const coberturaAposTroca = new Map(contexto.coberturaPorSetorDataTurnoFuncao);
      this.aplicarDeltaCobertura(coberturaAposTroca, vinculoA, plantaoA, plantaoB, vinculoB.funcao);
      this.aplicarDeltaCobertura(coberturaAposTroca, vinculoB, plantaoB, plantaoA, vinculoA.funcao);
      const datasAfetadas = new Set([
        new Date(plantaoA.data).toISOString().slice(0, 10),
        new Date(plantaoB.data).toISOString().slice(0, 10),
      ]);
      if (String(plantaoA.setorId) === String(plantaoB.setorId) && vinculoA.funcao === vinculoB.funcao) {
        // Quando setor e função permanecem iguais, o delta cancela as duas
        // remoções/adições; não há redução de cobertura.
        return { impedimentos: [...new Map(impedimentos.map((item) => [`${item.codigo}:${item.mensagem}`, item])).values()] };
      }
      if (impedimentos.some((item) => item.mensagem.includes('formação'))) {
        // Categoria já impede o par; a cobertura não adiciona um
        // resultado alternativo ao mesmo candidato inválido.
        return { impedimentos: [...new Map(impedimentos.map((item) => [`${item.codigo}:${item.mensagem}`, item])).values()] };
      }
      for (const [setorId, setor] of contexto.setoresPorId) {
        for (const data of datasAfetadas) {
          for (const turno of ['diurno', 'noturno'] as const) {
            for (const funcao of [Formacao.ENFERMEIRO, Formacao.TECNICO]) {
              const chave = `${setorId}|${data}|${turno}|${funcao}`;
              const quantidade = coberturaAposTroca.get(chave) ?? 0;
              const necessario = turno === 'diurno'
                ? (funcao === Formacao.ENFERMEIRO ? setor.turnos.diurno.enfermeiros : setor.turnos.diurno.tecnicos)
                : (funcao === Formacao.ENFERMEIRO ? setor.turnos.noturno.enfermeiros : setor.turnos.noturno.tecnicos);
              const quantidadeAntes = contexto.coberturaPorSetorDataTurnoFuncao.get(chave) ?? 0;
              if (quantidade < necessario && quantidade < quantidadeAntes) {
                impedimentos.push({ codigo: 'COBERTURA_INSUFICIENTE', mensagem: 'Esta troca deixa o turno com menos profissionais. Escolha outra opção.' });
              }
            }
          }
        }
      }

      return { impedimentos: [...new Map(impedimentos.map((item) => [`${item.codigo}:${item.mensagem}`, item])).values()] };
    })();

    if (cache) cache.set(chave, validar);
    return validar;
  }

  private aplicarDeltaCobertura(
    contadores: Map<string, number>,
    vinculoOriginal: PlantaoProfissional & { _id: Types.ObjectId },
    plantaoOriginal: Plantao & { _id: Types.ObjectId },
    plantaoDestino: Plantao & { _id: Types.ObjectId },
    funcaoNova: string,
  ): void {
    const ajustar = (plantao: Plantao, funcao: string, delta: number) => {
      const data = new Date(plantao.data).toISOString().slice(0, 10);
      const turnos = plantao.duracaoHoras >= 24
        ? ['diurno', 'noturno']
        : [plantao.horarioInicio === '07:00' ? 'diurno' : 'noturno'];
      for (const turno of turnos) {
        const chave = `${String(plantao.setorId)}|${data}|${turno}|${funcao}`;
        contadores.set(chave, Math.max(0, (contadores.get(chave) ?? 0) + delta));
      }
    };
    ajustar(plantaoOriginal, vinculoOriginal.funcao, -1);
    ajustar(plantaoDestino, funcaoNova, 1);
  }

  private inicioAlocacao(alocacao: AlocacaoMemoria): Date {
    const inicio = new Date(alocacao.plantao.data);
    const [hora, minuto] = alocacao.plantao.horarioInicio.split(':').map(Number);
    inicio.setUTCHours(hora, minuto, 0, 0);
    return inicio;
  }

  private buscarPlantaoVizinhanca(
    listaOrdenada: AlocacaoMemoria[],
    datasAfetadas: Date[],
    dias: number,
  ): AlocacaoMemoria[] {
    const resultado = new Map<string, AlocacaoMemoria>();
    for (const dataAfetada of datasAfetadas) {
      const inicio = dataAfetada.getTime() - dias * 24 * 60 * 60 * 1000;
      const fim = dataAfetada.getTime() + dias * 24 * 60 * 60 * 1000;
      let esquerda = 0;
      let direita = listaOrdenada.length;
      while (esquerda < direita) {
        const meio = Math.floor((esquerda + direita) / 2);
        if (this.inicioAlocacao(listaOrdenada[meio]).getTime() < inicio) esquerda = meio + 1;
        else direita = meio;
      }
      for (let indice = esquerda; indice < listaOrdenada.length; indice++) {
        const alocacao = listaOrdenada[indice];
        const inicioPlantao = this.inicioAlocacao(alocacao).getTime();
        if (inicioPlantao > fim) break;
        resultado.set(String(alocacao.vinculo._id), alocacao);
      }
    }
    return [...resultado.values()].sort((a, b) => this.inicioAlocacao(a).getTime() - this.inicioAlocacao(b).getTime());
  }

  private existeConflitoJornada(
    vizinhos: AlocacaoMemoria[],
    plantaoDestino: Plantao,
    vinculoAId: string,
    vinculoBId: string,
  ): boolean {
    const idsTroca = new Set([vinculoAId, vinculoBId]);
    const agenda = vizinhos
      .filter((item) => !idsTroca.has(String(item.vinculo._id)))
      .map((item) => ({ data: item.plantao.data, horarioInicio: item.plantao.horarioInicio, duracaoHoras: item.plantao.duracaoHoras }));
    agenda.push({ data: plantaoDestino.data, horarioInicio: plantaoDestino.horarioInicio, duracaoHoras: plantaoDestino.duracaoHoras });
    agenda.sort((a, b) => {
      const ia = new Date(a.data); const [ha, ma] = a.horarioInicio.split(':').map(Number); ia.setUTCHours(ha, ma, 0, 0);
      const ib = new Date(b.data); const [hb, mb] = b.horarioInicio.split(':').map(Number); ib.setUTCHours(hb, mb, 0, 0);
      return ia.getTime() - ib.getTime();
    });
    for (let indice = 0; indice < agenda.length - 1; indice++) {
      const anterior = agenda[indice];
      const seguinte = agenda[indice + 1];
      const inicioAnterior = new Date(anterior.data); const [ha, ma] = anterior.horarioInicio.split(':').map(Number); inicioAnterior.setUTCHours(ha, ma, 0, 0);
      const inicioSeguinte = new Date(seguinte.data); const [hs, ms] = seguinte.horarioInicio.split(':').map(Number); inicioSeguinte.setUTCHours(hs, ms, 0, 0);
      const permiteDiurnoNoturno =
        anterior.duracaoHoras === 12 && seguinte.duracaoHoras === 12 &&
        anterior.horarioInicio === '07:00' && seguinte.horarioInicio === '19:00';
      if (permiteDiurnoNoturno) continue;
      const descanso = anterior.duracaoHoras >= 24 ? 72 : 36;
      if (inicioSeguinte.getTime() < inicioAnterior.getTime() + anterior.duracaoHoras * 3600000 + descanso * 3600000) return true;
    }
    return false;
  }

  async validarPar(
    vinculoSolicitanteId: string,
    vinculoSolicitadoId: string,
    mes: number,
    ano: number,
    cache?: Map<string, Promise<unknown>>,
  ) {
    const ids = [new Types.ObjectId(vinculoSolicitanteId), new Types.ObjectId(vinculoSolicitadoId)];
    const vinculos = await this.vinculos.find({ _id: { $in: ids } }).lean().exec();
    const a = vinculos.find((item) => String(item._id) === vinculoSolicitanteId);
    const b = vinculos.find((item) => String(item._id) === vinculoSolicitadoId);
    if (!a || !b) return { impedimentos: [{ codigo: 'VINCULOS_INVALIDOS', mensagem: 'Um dos plantões mudou na escala. Recuse esta solicitação e peça outra.' }], avisos: [] };
    const temporaria = { _id: new Types.ObjectId(), status: StatusTroca.AGUARDANDO_RESPOSTA, mes, ano,
      solicitanteProfissionalId: a.profissionalId, profissionalSolicitadoId: b.profissionalId,
      vinculoSolicitanteId: a._id, vinculoSolicitadoId: b._id, criadaEm: new Date(), aceite: null } as TrocaRead;
    return this.validarNoBanco(temporaria._id, undefined, false, temporaria, false, cache);
  }

  async validarNoBanco(
    id: Types.ObjectId,
    session?: ClientSession,
    exigirAceite = true,
    registroTemporario?: TrocaRead,
    exigirEscalaSemRevisao = true,
    cache?: Map<string, Promise<unknown>>,
  ) {
    const query = this.trocas.findById(id);
    if (session) query.session(session);
    const troca = registroTemporario ?? await query.lean().exec();
    if (!troca) throw new NotFoundException('Solicitação de troca não encontrada.');
    const impedimentos: { codigo: string; mensagem: string }[] = [];
    const avisos: { codigo: string; mensagem: string }[] = [];
    if (String(troca.solicitanteProfissionalId) === String(troca.profissionalSolicitadoId)) {
      impedimentos.push({ codigo: 'MESMO_PROFISSIONAL', mensagem: 'A troca usa o mesmo profissional nos dois lados. Escolha outra pessoa.' });
    }
    if (exigirAceite && (troca.status !== StatusTroca.AGUARDANDO_COORDENACAO || !troca.aceite ||
      String(troca.aceite.profissionalId) !== String(troca.profissionalSolicitadoId))) {
      impedimentos.push({ codigo: 'ACEITE_AUSENTE', mensagem: 'O profissional solicitado ainda não aceitou. Aguarde o aceite ou recuse.' });
    }
    const idsVinculos = [String(troca.vinculoSolicitanteId), String(troca.vinculoSolicitadoId)];
    const vinculos = cache && !session
      ? (await Promise.all(idsVinculos.map((vinculoId) => this.comCache(cache, `vinculo:${vinculoId}`, () => this.vinculos.findById(vinculoId).lean().exec())))).filter((vinculo): vinculo is NonNullable<typeof vinculo> => vinculo !== null)
      : await this.vinculos.find({ _id: { $in: idsVinculos.map((vinculoId) => new Types.ObjectId(vinculoId)) } }).session(session ?? null).lean().exec();
    const porId = new Map(vinculos.map((v) => [String(v._id), v]));
    const vinculoA = porId.get(String(troca.vinculoSolicitanteId));
    const vinculoB = porId.get(String(troca.vinculoSolicitadoId));
    if (!vinculoA || !vinculoB || String(vinculoA.profissionalId) !== String(troca.solicitanteProfissionalId) ||
      String(vinculoB.profissionalId) !== String(troca.profissionalSolicitadoId) || String(vinculoA._id) === String(vinculoB._id)) {
      const mensagensLado = await Promise.all([
        vinculoA
          ? this.mensagemVinculoAlterado(troca, vinculoA, String(troca.solicitanteProfissionalId), 'solicitante')
          : Promise.resolve('O plantão do solicitante mudou na escala. Recuse esta solicitação e peça outra.'),
        vinculoB
          ? this.mensagemVinculoAlterado(troca, vinculoB, String(troca.profissionalSolicitadoId), 'profissional solicitado')
          : Promise.resolve('O plantão do profissional solicitado mudou na escala. Recuse esta solicitação e peça outra.'),
      ]);
      const ladoInalterado = [
        vinculoA && String(vinculoA.profissionalId) === String(troca.solicitanteProfissionalId),
        vinculoB && String(vinculoB.profissionalId) === String(troca.profissionalSolicitadoId),
      ];
      impedimentos.push({
        codigo: 'VINCULOS_INVALIDOS',
        mensagem: ladoInalterado[0] && !ladoInalterado[1]
          ? mensagensLado[1]
          : !ladoInalterado[0] && ladoInalterado[1]
            ? mensagensLado[0]
            : `${mensagensLado[0]} ${mensagensLado[1]}`,
      });
      return { apta: false, impedimentos, avisos, revisaoEsperada: 0, versaoPublicada: 0, contagemTrocas: [], limiteTrocas: null, cobertura: null };
    }
    const idsPlantoes = [String(vinculoA.plantaoId), String(vinculoB.plantaoId)];
    const plantoes = cache && !session
      ? (await Promise.all(idsPlantoes.map((plantaoId) => this.comCache(cache, `plantao:${plantaoId}`, () => this.plantoes.findById(plantaoId).lean().exec())))).filter((plantao): plantao is NonNullable<typeof plantao> => plantao !== null)
      : await this.plantoes.find({ _id: { $in: idsPlantoes.map((plantaoId) => new Types.ObjectId(plantaoId)) } }).session(session ?? null).lean().exec();
    const plantaoPorId = new Map(plantoes.map((p) => [String(p._id), p]));
    const plantaoA = plantaoPorId.get(String(vinculoA.plantaoId)); const plantaoB = plantaoPorId.get(String(vinculoB.plantaoId));
    if (!plantaoA || !plantaoB) {
      impedimentos.push({ codigo: 'PLANTAO_AUSENTE', mensagem: 'Um dos plantões saiu da escala. Recuse esta solicitação e peça outra.' });
      return { apta: false, impedimentos, avisos, revisaoEsperada: 0, versaoPublicada: 0, contagemTrocas: [], limiteTrocas: null, cobertura: null };
    }
    const idsEscalas = [String(plantaoA.escalaId), String(plantaoB.escalaId)];
    const escalas = cache && !session
      ? (await Promise.all(idsEscalas.map((escalaId) => this.comCache(cache, `escala:${escalaId}`, () => this.escalas.findById(escalaId).lean().exec())))).filter((escala): escala is NonNullable<typeof escala> => escala !== null)
      : await this.escalas.find({ _id: { $in: idsEscalas.map((escalaId) => new Types.ObjectId(escalaId)) } }).session(session ?? null).lean().exec();
    const escalaPorId = new Map(escalas.map((e) => [String(e._id), e]));
    const escalaA = escalaPorId.get(String(plantaoA.escalaId)); const escalaB = escalaPorId.get(String(plantaoB.escalaId));
    if (!escalaA || !escalaB || escalaA.mes !== escalaB.mes || escalaA.ano !== escalaB.ano) {
      impedimentos.push({ codigo: 'COMPETENCIAS_DIFERENTES', mensagem: 'Os plantões estão em meses diferentes. Recuse esta solicitação e escolha uma mesma escala.' });
      return { apta: false, impedimentos, avisos, revisaoEsperada: 0, versaoPublicada: 0, contagemTrocas: [], limiteTrocas: null, cobertura: null };
    }
    const escala = escalaA;
    if (troca.mes !== escala.mes || troca.ano !== escala.ano) {
      impedimentos.push({ codigo: 'COMPETENCIA_DIVERGENTE', mensagem: 'O mês desta solicitação mudou. Peça uma nova troca na escala atual.' });
    }
    if (String(escalaA._id) !== String(escalaB._id)) impedimentos.push({ codigo: 'ESCALAS_DIFERENTES', mensagem: 'Os plantões estão em escalas diferentes. Recuse esta solicitação e escolha outra.' });
    if (escala.status === StatusEscala.EM_REVISAO || escala.status === StatusEscala.VALIDADA) {
      if (exigirEscalaSemRevisao) {
        impedimentos.push({ codigo: 'REVISAO_ABERTA', mensagem: 'A escala está em revisão. Aguarde a publicação e valide novamente.' });
      }
    } else if (escala.status !== StatusEscala.PUBLICADA) {
      impedimentos.push({ codigo: 'ESCALA_NAO_PUBLICADA', mensagem: 'Esta escala ainda não foi publicada. Aguarde a publicação e valide novamente.' });
    }
    const plantoesMes = await this.comCache(cache, `plantoes:${String(escala._id)}`, () => {
      const query = this.plantoes.find({ escalaId: escala._id }); if (session) query.session(session);
      return query.lean().exec();
    });
    const idsPlantoesMes = plantoesMes.map((p) => p._id);
    const vinculosMes = await this.comCache(cache, `vinculos:${String(escala._id)}`, () => {
      const query = this.vinculos.find({ plantaoId: { $in: idsPlantoesMes } }); if (session) query.session(session);
      return query.lean().exec();
    });
    const profissionaisIds = [...new Set(vinculosMes.map((v) => String(v.profissionalId)))];
    const profissionaisDocs = await this.comCache(cache, `profissionais:${String(escala._id)}`, () => {
      const query = this.profissionais.find({ _id: { $in: profissionaisIds.map((value) => new Types.ObjectId(value)) } }); if (session) query.session(session);
      return query.lean().exec();
    });
    const profPorId = new Map(profissionaisDocs.map((p) => [String(p._id), p]));
    const usuarios = await this.comCache(cache, `usuarios:${String(escala._id)}`, () => {
      const query = this.usuarios.find({ _id: { $in: profissionaisDocs.map((p) => p.usuarioId) } }).select('nome'); if (session) query.session(session);
      return query.lean().exec();
    });
    const nomePorUsuario = new Map(usuarios.map((u) => [String(u._id), u.nome]));
    for (const idProfissional of [String(troca.solicitanteProfissionalId), String(troca.profissionalSolicitadoId)]) {
      const p = profPorId.get(idProfissional);
      if (!p) impedimentos.push({ codigo: 'PROFISSIONAL_AUSENTE', mensagem: 'Um profissional não está mais cadastrado. Recuse esta solicitação.' });
      else if (p.status !== StatusProfissional.ATIVO) {
        const nome = nomePorUsuario.get(String(p.usuarioId)) ?? 'Um dos profissionais';
        impedimentos.push({ codigo: 'PROFISSIONAL_INATIVO', mensagem: `${nome.split(' ')[0]} não está ativo. Aguarde ou recuse esta solicitação.` });
      }
    }
    const setorIds = [...new Set(plantoesMes.map((p) => String(p.setorId)))];
    const setores = await this.comCache(cache, `setores:${String(escala._id)}`, () => {
      const query = this.setores.find({ _id: { $in: setorIds } }); if (session) query.session(session);
      return query.lean().exec();
    });
    const restricoes = await this.comCache(cache, `restricoes:${String(escala._id)}`, () => {
      const query = this.restricoes.find({ profissionalId: { $in: profissionaisIds }, inicio: { $lte: utcDate(escala.ano, escala.mes - 1, diasDoMes(escala.ano, escala.mes), 23, 59, 59, 999) }, fim: { $gte: utcDate(escala.ano, escala.mes - 1, 1) } }); if (session) query.session(session);
      return query.lean().exec();
    });
    const chaveConfiguracao = `${String(escala.ano).padStart(4, '0')}-${String(escala.mes).padStart(2, '0')}`;
    const docConfiguracao = await this.comCache(cache, `configuracao:${chaveConfiguracao}`, () => {
      const query = this.configuracoes.findOne({ chave: chaveConfiguracao }); if (session) query.session(session);
      return query.lean().exec();
    });
    const configuracao = docConfiguracao ? {
      periodo: docConfiguracao.chave,
      limiteTrocas: docConfiguracao.limiteTrocas,
      maxExtras: docConfiguracao.maxExtras,
      limitePlantoes: docConfiguracao.limitePlantoes,
      maxExtrasConcursado: docConfiguracao.maxExtrasConcursado,
      maxExtrasClt: docConfiguracao.maxExtrasClt,
      cargas: docConfiguracao.cargas,
    } : null;
    if (!configuracao) impedimentos.push({ codigo: 'LIMITE_NAO_CONFIGURADO', mensagem: 'Este mês não está configurado. Aguarde a configuração e valide novamente.' });
    else if (typeof configuracao.limiteTrocas !== 'number') impedimentos.push({ codigo: 'LIMITE_NAO_CONFIGURADO', mensagem: 'O limite deste mês não está configurado. Aguarde e valide novamente.' });
    const profEntrada = (idProfissional: string) => {
      const p = profPorId.get(idProfissional)!;
      return { id: idProfissional, nome: nomePorUsuario.get(String(p.usuarioId)) ?? 'Profissional', formacao: p.formacao, tipoVinculo: p.tipoVinculo, status: p.status };
    };
    const idsAfetados = [String(troca.solicitanteProfissionalId), String(troca.profissionalSolicitadoId)];
    const idsVinculosTroca = new Set([String(vinculoA._id), String(vinculoB._id)]);
    const converterAlocacao = (vinculo: typeof vinculoA, profissionalId: string, plantao = plantaoPorId.get(String(vinculo.plantaoId))) => {
      if (!plantao || !profPorId.has(profissionalId)) return undefined;
      return { profissional: profEntrada(profissionalId), funcao: vinculo.funcao as Formacao, data: new Date(plantao.data),
        horarioInicio: plantao.horarioInicio, duracaoHoras: plantao.duracaoHoras, tipo: plantao.tipo, setorId: String(plantao.setorId) };
    };
    const existentes = vinculosMes.flatMap((v) => {
      if (idsVinculosTroca.has(String(v._id))) return [];
      const plantao = plantaoPorId.get(String(v.plantaoId)) ?? plantoesMes.find((item) => String(item._id) === String(v.plantaoId));
      const alocacao = converterAlocacao(v as typeof vinculoA, String(v.profissionalId), plantao);
      return alocacao ? [alocacao] : [];
    });
    const candidatas = [
      converterAlocacao(vinculoA, String(vinculoB.profissionalId), plantaoA),
      converterAlocacao(vinculoB, String(vinculoA.profissionalId), plantaoB),
    ].filter((item): item is NonNullable<typeof item> => item !== undefined);
    const periodosAdjacentes = [
      { ano: escala.mes === 1 ? escala.ano - 1 : escala.ano, mes: escala.mes === 1 ? 12 : escala.mes - 1 },
      { ano: escala.mes === 12 ? escala.ano + 1 : escala.ano, mes: escala.mes === 12 ? 1 : escala.mes + 1 },
    ].filter((periodo) => periodo.ano >= 1 && periodo.ano <= 9999);
    const chaveAdjacentes = `${escala.ano}-${escala.mes}`;
    const escalasAdjacentes = await this.comCache(cache, `escalas-adjacentes:${chaveAdjacentes}`, () => {
      const query = this.escalas.find({ $or: periodosAdjacentes }); if (session) query.session(session);
      return query.lean().exec();
    });
    let anteriores: { profissionalId: string; data: Date; horarioInicio: string; duracaoHoras: number }[] = [];
    if (escalasAdjacentes.length) {
      const pAdjacentes = await this.comCache(cache, `plantoes-adjacentes:${chaveAdjacentes}`, () => {
        const query = this.plantoes.find({ escalaId: { $in: escalasAdjacentes.map((item) => item._id) } }); if (session) query.session(session);
        return query.lean().exec();
      });
      const qVinculosAdjacentes = this.vinculos.find({ plantaoId: { $in: pAdjacentes.map((p) => p._id) }, profissionalId: { $in: idsAfetados.map((value) => new Types.ObjectId(value)) } }); if (session) qVinculosAdjacentes.session(session);
      const vAdjacentes = await qVinculosAdjacentes.lean().exec();
      anteriores = vAdjacentes.flatMap((v) => { const p = pAdjacentes.find((x) => String(x._id) === String(v.plantaoId)); return p ? [{ profissionalId: String(v.profissionalId), data: p.data, horarioInicio: p.horarioInicio, duracaoHoras: p.duracaoHoras }] : []; });
    }
    const erros = configuracao ? validarAlocacoesPlantao({
      ano: escala.ano, mes: escala.mes, configuracao,
      restricoes: restricoes.map((r) => ({ profissionalId: String(r.profissionalId), tipo: r.tipo, inicio: r.inicio, fim: r.fim, diaSemana: r.diaSemana })),
      anteriores: anteriores as never,
      existentes: existentes.map(({ setorId: _setor, ...item }) => item as AlocacaoPlantaoValidacao),
      candidatas: candidatas.map(({ setorId: _setor, ...item }) => item as AlocacaoPlantaoValidacao),
      foco: new Set(idsAfetados),
    }) : [];
    erros.forEach((mensagem) => impedimentos.push({
      codigo: 'REGRA_ESCALA',
      mensagem: this.mensagemRegraEscala(mensagem),
    }));
    const coberturaAntes = await this.comCache(cache, `cobertura:${String(escala._id)}`, async () => calcularPendenciasCobertura({ ano: escala.ano, mes: escala.mes,
      setores: setores.map((s) => ({ id: String(s._id), nome: s.nome, turnos: s.turnos })),
      alocacoes: vinculosMes.flatMap((v) => { const p = plantoesMes.find((x) => String(x._id) === String(v.plantaoId)); const prof = profPorId.get(String(v.profissionalId)); if (!p || !prof) return []; return [{ profissional: profEntrada(String(v.profissionalId)), funcao: v.funcao as Formacao, data: p.data, horarioInicio: p.horarioInicio, duracaoHoras: p.duracaoHoras, tipo: p.tipo, setorId: String(p.setorId) }]; }) }));
    // A permuta altera somente os titulares dos vínculos; setor, data, turno e função do posto permanecem fixos.
    const coberturaDepois = calcularPendenciasCobertura({
      ano: escala.ano,
      mes: escala.mes,
      setores: setores.map((s) => ({ id: String(s._id), nome: s.nome, turnos: s.turnos })),
      alocacoes: [...existentes, ...candidatas],
    });
    if (coberturaDepois.length) {
      const datasAfetadas = new Set([new Date(plantaoA.data).toISOString().slice(0, 10), new Date(plantaoB.data).toISOString().slice(0, 10)]);
      const setorIdsAfetados = new Set([String(plantaoA.setorId), String(plantaoB.setorId)]);
      const faltantesAntes = new Map(coberturaAntes.map((pendencia) => [
        `${pendencia.setorId}|${pendencia.data}|${pendencia.turno}|${pendencia.funcao}`,
        pendencia.faltam,
      ]));
      const agravouCobertura = coberturaDepois.some((pendencia) => {
        if (!datasAfetadas.has(pendencia.data) || !setorIdsAfetados.has(pendencia.setorId)) return false;
        const chave = `${pendencia.setorId}|${pendencia.data}|${pendencia.turno}|${pendencia.funcao}`;
        return pendencia.faltam > (faltantesAntes.get(chave) ?? 0);
      });
      if (agravouCobertura) {
        impedimentos.push({ codigo: 'COBERTURA_INSUFICIENTE', mensagem: 'Esta troca deixa o turno com menos profissionais. Escolha outra opção.' });
      }
    }
    const limiteTrocas = configuracao?.limiteTrocas;
    const contagemTrocas: { profissionalId: string; aprovadas: number }[] = [];
    for (const profissionalId of idsAfetados) {
      const aprovadas = await this.comCache(cache, `trocas-aprovadas:${chaveConfiguracao}:${profissionalId}`, () => {
        const queryContagem = this.trocas.countDocuments({ status: StatusTroca.APROVADA, ano: escala.ano, mes: escala.mes,
          $or: [{ solicitanteProfissionalId: new Types.ObjectId(profissionalId) }, { profissionalSolicitadoId: new Types.ObjectId(profissionalId) }] });
        if (session) queryContagem.session(session);
        return queryContagem.exec();
      });
      contagemTrocas.push({ profissionalId, aprovadas });
    }
    if (limiteTrocas === undefined) impedimentos.push({ codigo: 'LIMITE_NAO_CONFIGURADO', mensagem: 'O limite deste mês não está configurado. Aguarde e valide novamente.' });
    else for (const item of contagemTrocas) if (item.aprovadas >= limiteTrocas) {
      const p = profPorId.get(item.profissionalId);
      const nome = p ? nomePorUsuario.get(String(p.usuarioId))?.split(' ')[0] ?? 'O profissional' : 'O profissional';
      avisos.push({ codigo: 'LIMITE_ATINGIDO', mensagem: `${nome} já atingiu o limite de trocas deste mês.` });
    }
    if (coberturaDepois.length) avisos.push({ codigo: 'COBERTURA_INSUFICIENTE', mensagem: 'A cobertura mensal ainda tem posições abertas.' });
    return { apta: impedimentos.length === 0 && avisos.every((a) => a.codigo !== 'LIMITE_ATINGIDO'), impedimentos, avisos,
      revisaoEsperada: escala.revisao, versaoPublicada: escala.versaoPublicada, contagemTrocas, limiteTrocas: limiteTrocas ?? null,
      cobertura: { antes: coberturaAntes, depois: coberturaDepois } };
  }

  private mensagemRegraEscala(mensagem: string): string {
    if (mensagem.includes('não está ativo')) {
      const nome = mensagem.split(' ')[0];
      return `${nome} não está ativo. Aguarde ou recuse esta solicitação.`;
    }
    if (mensagem.includes('não possui a formação exigida')) {
      const nome = mensagem.split(' ')[0];
      return `${nome} não tem a categoria deste plantão. Escolha um colega compatível.`;
    }
    if (mensagem.includes('indisponível na data')) {
      const nome = mensagem.split(' ')[0];
      return `${nome} está indisponível nesta data. Escolha outro plantão.`;
    }
    if (mensagem.includes('indisponível no turno')) {
      const nome = mensagem.split(' ')[0];
      return `${nome} não pode fazer este turno. Escolha outro horário.`;
    }
    if (mensagem.includes('descanso obrigatório') || mensagem.includes('sobrepostos')) {
      const nome = mensagem.split(' ')[0];
      return `${nome} teria intervalo insuficiente. Escolha outro plantão.`;
    }
    if (mensagem.includes('excede a carga regular')) {
      const nome = mensagem.split(' ')[0];
      return `${nome} ultrapassa a carga mensal. Escolha outro plantão.`;
    }
    if (mensagem.includes('limite de plantões extras') || mensagem.includes('limite total') || mensagem.includes('vínculo RPA')) {
      return 'O limite mensal deste profissional seria excedido. Escolha outra opção.';
    }
    return 'Esta troca não atende às regras da escala. Escolha outra opção.';
  }

  private async mensagemVinculoAlterado(
    troca: TrocaRead,
    vinculo: PlantaoProfissional & { _id: Types.ObjectId },
    profissionalOriginalId: string,
    lado: 'solicitante' | 'profissional solicitado',
  ): Promise<string> {
    const plantao = await this.plantoes.findById(vinculo.plantaoId).lean().exec();
    const [profissionalOriginal, profissionalAtual] = await Promise.all([
      this.profissionais.findById(new Types.ObjectId(profissionalOriginalId)).lean().exec(),
      vinculo.profissionalId ? this.profissionais.findById(vinculo.profissionalId).lean().exec() : null,
    ]);
    const usuarios = await this.usuarios.find({
      _id: { $in: [profissionalOriginal?.usuarioId, profissionalAtual?.usuarioId].filter((id): id is Types.ObjectId => Boolean(id)) },
    }).lean().exec();
    const nomePorUsuario = new Map(usuarios.map((usuario) => [String(usuario._id), usuario.nome]));
    const nomeOriginal = profissionalOriginal
      ? nomePorUsuario.get(String(profissionalOriginal.usuarioId)) ?? 'o profissional'
      : 'o profissional';

    if (plantao && String(vinculo.profissionalId) !== profissionalOriginalId) {
      const data = this.formatarData(plantao.data);
      const aprovadoNoVinculo = await this.trocas.findOne({
        status: StatusTroca.APROVADA,
        $or: [
          { vinculoSolicitanteId: vinculo._id },
          { vinculoSolicitadoId: vinculo._id },
        ],
      }).lean().exec();
      const motivoOutraAprovacao = aprovadoNoVinculo
        ? 'pois foi trocado por outra solicitação já aprovada.'
        : 'pois a atribuição deste plantão foi alterada na escala.';
      const primeiroNome = nomeOriginal.split(' ')[0];
      if (aprovadoNoVinculo) {
        return `O plantão de ${primeiroNome} em ${data} já foi trocado por outra solicitação. Recuse esta e peça uma nova.`;
      }
      return `O plantão de ${primeiroNome} em ${data} mudou na escala. Recuse esta solicitação e peça outra.`;
    }

    if (!plantao) {
      return `O plantão de ${nomeOriginal.split(' ')[0]} saiu da escala. Recuse esta solicitação e peça outra.`;
    }
    return `O plantão de ${nomeOriginal.split(' ')[0]} mudou na escala. Recuse esta solicitação e peça outra.`;
  }

  private formatarData(data: Date): string {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    });
  }

  private primeiroNomeProfissional(contexto: ContextoValidacaoCandidatos, profissionalId: string): string {
    const nome = contexto.nomePorProfissionalId.get(profissionalId) ?? 'Profissional';
    return nome.split(' ')[0];
  }

  private comCache<T>(cache: Map<string, Promise<unknown>> | undefined, chave: string, carregar: () => Promise<T>): Promise<T> {
    if (!cache) return carregar();
    const existente = cache.get(chave);
    if (existente) return existente as Promise<T>;
    const carregando = carregar();
    cache.set(chave, carregando);
    carregando.catch(() => {
      if (cache.get(chave) === carregando) cache.delete(chave);
    });
    return carregando;
  }

  private async resumo(troca: TrocaRead) {
    const solicitante = await this.nomeProfissional(troca.solicitanteProfissionalId);
    const solicitado = await this.nomeProfissional(troca.profissionalSolicitadoId);
    const [plantaoA, plantaoB] = await Promise.all([
      this.plantaoResumo(troca, 'vinculoSolicitante', solicitante),
      this.plantaoResumo(troca, 'vinculoSolicitado', solicitado),
    ]);
    return {
      id: String(troca._id), status: troca.status, criadaEm: troca.criadaEm,
      solicitante: { nome: solicitante },
      profissionalSolicitado: { nome: solicitado },
      aceite: troca.aceite ? { aceito: true, aceitoEm: troca.aceite.aceitoEm } : null,
      decisaoCoordenacao: troca.decisaoCoordenacao ? {
        resultado: troca.decisaoCoordenacao.resultado,
        decididaEm: troca.decisaoCoordenacao.decididaEm,
        justificativa: troca.decisaoCoordenacao.justificativa ?? null,
        excecaoLimite: troca.decisaoCoordenacao.excecaoLimite ?? false,
        versoesEscala: troca.decisaoCoordenacao.versoesEscala ?? [],
      } : null,
      plantaoSolicitante: plantaoA,
      plantaoSolicitado: plantaoB,
    };
  }

  private async plantaoResumo(
    troca: TrocaRead,
    lado: 'vinculoSolicitante' | 'vinculoSolicitado',
    profissional: string,
  ) {
    const snapshot = troca.resumoOriginal?.[lado];
    if (snapshot) {
      return {
        profissional,
        funcao: String(snapshot.funcao ?? ''),
        lideranca: false,
        origemCobertura: 'regular',
        data: String(snapshot.data ?? ''),
        horarioInicio: String(snapshot.horarioInicio ?? ''),
        horarioFim: String(snapshot.horarioFim ?? ''),
        duracaoHoras: Number(snapshot.duracaoHoras ?? 0),
        tipo: 'regular',
        setor: String(snapshot.setor ?? 'Setor indisponível'),
        escala: { ano: troca.ano, mes: troca.mes, status: 'publicada', revisao: 0, versaoPublicada: Number(troca.resumoOriginal?.versaoOficial ?? 0) },
      };
    }
    return this.plantaoPorVinculo(lado === 'vinculoSolicitante'
      ? troca.vinculoSolicitanteId
      : troca.vinculoSolicitadoId);
  }

  private async nomeProfissional(id: Types.ObjectId) {
    const profissional = await this.profissionais.findById(id).select('usuarioId').lean().exec();
    if (!profissional) return 'Profissional indisponível';
    const usuario = await this.usuarios.findById(profissional.usuarioId).select('nome').lean().exec();
    return usuario?.nome ?? 'Profissional indisponível';
  }

  private async plantaoPorVinculo(vinculoId: Types.ObjectId) {
    const vinculo = await this.vinculos.findById(vinculoId).lean().exec();
    if (!vinculo) return null;
    const plantao = await this.plantoes.findById(vinculo.plantaoId).lean().exec();
    if (!plantao) return null;
    const [escala, setor, nome] = await Promise.all([
      this.escalas.findById(plantao.escalaId).select('ano mes status revisao versaoPublicada').lean().exec(),
      this.setores.findById(plantao.setorId).select('nome').lean().exec(),
      this.nomeProfissional(vinculo.profissionalId),
    ]);
    return {
      profissional: nome,
      funcao: vinculo.funcao, lideranca: vinculo.lideranca, origemCobertura: vinculo.origemCobertura,
      data: plantao.data, horarioInicio: plantao.horarioInicio, horarioFim: plantao.horarioFim,
      duracaoHoras: plantao.duracaoHoras, tipo: plantao.tipo, setor: setor?.nome ?? 'Setor indisponível',
      escala: escala ? { ano: escala.ano, mes: escala.mes, status: escala.status as StatusEscala, revisao: escala.revisao, versaoPublicada: escala.versaoPublicada } : null,
    };
  }

  private async renderPlantao(vinculoId: Types.ObjectId) {
    return this.plantaoPorVinculo(vinculoId);
  }
}
