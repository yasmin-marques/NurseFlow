import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Configuracao } from '../configuracoes/configuracao.schema';
import { utcDate } from '../common/utils/date';
import { executarTransacao } from '../common/utils/mongo-transaction';
import { validarAlocacoesPlantao, calcularPendenciasCobertura, type AlocacaoPlantaoValidacao } from '../escalas/regras-plantao';
import { diasDoMes } from '../escalas/montar-problema';
import { AuditoriaTroca, AuditoriaEscala, Escala, NotificacaoTroca, Plantao, PlantaoProfissional, SolicitacaoTroca, StatusEscala, StatusTroca, TipoPlantao, VersaoEscala } from '../escalas/schemas';
import { Formacao, StatusProfissional } from '../profissionais/profissionais.enums';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { Restricao } from '../restricoes/restricao.schema';
import { Administrador } from '../usuarios/schemas/administrador.schema';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import type { AprovarTrocaDto, RecusarTrocaDto } from './dto/decidir-troca.dto';
import { Setor } from '../setores/schemas/setor.schema';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { FiltroTroca, ListarTrocasDto } from './dto/listar-trocas.dto';

type TrocaRead = SolicitacaoTroca & { _id: Types.ObjectId };
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

  async detalhe(id: string) {
    const troca = await this.trocas.findById(id).lean().exec();
    if (!troca) throw new NotFoundException('Solicitação de troca não encontrada.');
    const [solicitado, aceito, decisao, historico] = await Promise.all([
      this.resumo(troca as TrocaRead),
      this.renderPlantao(troca.vinculoSolicitanteId),
      this.renderPlantao(troca.vinculoSolicitadoId),
      this.auditoriasTroca.find({ solicitacaoId: troca._id }).sort({ decididaEm: -1 }).lean().exec(),
    ]);
    const detalhes = { ...solicitado, plantaoSolicitante: aceito, plantaoSolicitado: decisao,
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
      if (!vinculoA || !vinculoB) throw new ConflictException('Os vínculos dos plantões foram alterados.');
      const plantaoA = await this.plantoes.findById(vinculoA.plantaoId).session(session).lean().exec();
      const plantaoB = await this.plantoes.findById(vinculoB.plantaoId).session(session).lean().exec();
      if (!plantaoA || !plantaoB || String(plantaoA.escalaId) !== String(plantaoB.escalaId)) throw new ConflictException('Os plantões não pertencem à mesma escala oficial.');
      const escala = await this.escalas.findById(plantaoA.escalaId).session(session).lean().exec();
      if (!escala || escala.status !== StatusEscala.PUBLICADA || escala.revisao !== dto.revisaoEsperada || escala.versaoPublicada !== validacao.versaoPublicada) throw new ConflictException('A escala oficial mudou ou possui revisão aberta.');
      const a = await this.vinculos.updateOne({ _id: vinculoA._id, profissionalId: vinculoA.profissionalId }, { $set: { profissionalId: vinculoB.profissionalId } }, { session });
      const b = await this.vinculos.updateOne({ _id: vinculoB._id, profissionalId: vinculoB.profissionalId }, { $set: { profissionalId: vinculoA.profissionalId } }, { session });
      if (a.modifiedCount !== 1 || b.modifiedCount !== 1) throw new ConflictException('Os vínculos foram alterados por outra operação.');
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
        titulo: 'Troca de plantão aprovada', mensagem: `A troca foi aprovada. Plantão ${plantaoA.data.toISOString().slice(0, 10)} (${plantaoA.horarioInicio}–${plantaoA.horarioFim}) e plantão ${plantaoB.data.toISOString().slice(0, 10)} (${plantaoB.horarioInicio}–${plantaoB.horarioFim}) foram permutados na versão ${numero}.` })), { session });
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
    if (!dto.justificativa.trim()) throw new UnprocessableEntityException('Informe o motivo da recusa.');
    try { await executarTransacao(this.connection, async (session) => {
      const troca = await this.trocas.findById(id).session(session).lean().exec();
      if (!troca) throw new NotFoundException('Solicitação de troca não encontrada.');
      if (troca.status !== StatusTroca.AGUARDANDO_COORDENACAO || !troca.aceite || String(troca.aceite.profissionalId) !== String(troca.profissionalSolicitadoId)) throw new ConflictException('A solicitação não está aguardando decisão da Coordenação.');
      const va = await this.vinculos.findById(troca.vinculoSolicitanteId).session(session).lean().exec();
      const vb = await this.vinculos.findById(troca.vinculoSolicitadoId).session(session).lean().exec();
      if (!va || !vb || String(va.profissionalId) !== String(troca.solicitanteProfissionalId) ||
        String(vb.profissionalId) !== String(troca.profissionalSolicitadoId) || String(va._id) === String(vb._id)) {
        throw new ConflictException('Os vínculos dos plantões foram alterados ou não correspondem aos participantes.');
      }
      const pa = await this.plantoes.findById(va.plantaoId).session(session).lean().exec();
      const pb = await this.plantoes.findById(vb.plantaoId).session(session).lean().exec();
      const escala = pa ? await this.escalas.findById(pa.escalaId).session(session).lean().exec() : null;
      if (!pa || !pb || !escala || String(pa.escalaId) !== String(pb.escalaId) || escala.mes !== troca.mes || escala.ano !== troca.ano ||
        new Date(pa.data).getUTCMonth() + 1 !== escala.mes || new Date(pa.data).getUTCFullYear() !== escala.ano ||
        new Date(pb.data).getUTCMonth() + 1 !== escala.mes || new Date(pb.data).getUTCFullYear() !== escala.ano ||
        escala.revisao !== dto.revisaoEsperada || escala.status !== StatusEscala.PUBLICADA) throw new ConflictException('A escala foi atualizada. Recarregue e tente novamente.');
      const agora = new Date();
      const atualizada = await this.trocas.updateOne({ _id: troca._id, status: StatusTroca.AGUARDANDO_COORDENACAO }, { $set: {
        status: StatusTroca.RECUSADA_PELA_COORDENACAO, chaveIdempotencia: dto.operacaoId,
        decisaoCoordenacao: { resultado: 'recusada', usuarioId: new Types.ObjectId(usuario.id), decididaEm: agora, justificativa: dto.justificativa.trim(), versoesEscala: [{ ano: escala.ano, mes: escala.mes, numero: escala.versaoPublicada }] },
      } }, { session });
      if (atualizada.modifiedCount !== 1) throw new ConflictException('A solicitação foi decidida por outra operação.');
      const versoesEscala = [{ ano: escala.ano, mes: escala.mes, numero: escala.versaoPublicada }];
      await this.auditoriasTroca.create([{ solicitacaoId: troca._id, usuarioId: new Types.ObjectId(usuario.id), resultado: 'recusada', decididaEm: agora,
        justificativa: dto.justificativa.trim(), excecaoLimite: false, operacaoId: dto.operacaoId,
        vinculos: [{ vinculoId: String(va._id), plantaoId: String(pa._id), profissionalId: String(va.profissionalId) }, { vinculoId: String(vb._id), plantaoId: String(pb._id), profissionalId: String(vb.profissionalId) }], versoesEscala }], { session });
      await this.auditoriasEscala.create([{ escalaId: escala._id, revisao: escala.revisao, acao: 'troca_recusada', usuarioId: new Types.ObjectId(usuario.id), ocorridoEm: agora, detalhes: { solicitacaoId: String(troca._id), operacaoId: dto.operacaoId, justificativa: dto.justificativa.trim() } }], { session });
      const profissionais = await this.profissionais.find({ _id: { $in: [troca.solicitanteProfissionalId, troca.profissionalSolicitadoId] } }).select('usuarioId').session(session).lean().exec();
      const userIds = [...new Set(profissionais.map((p) => String(p.usuarioId)))];
      await this.notificacoes.insertMany(userIds.map((destinatarioId) => ({ solicitacaoId: troca._id, destinatarioId: new Types.ObjectId(destinatarioId), eventKey: `troca:${String(troca._id)}:${dto.operacaoId}`,
        titulo: 'Troca de plantão recusada', mensagem: `A Coordenação recusou a troca: ${dto.justificativa.trim()}` })), { session });
    }); } catch (erro) {
      const resultado = await this.trocas.findById(id).lean().exec();
      if (resultado?.status === StatusTroca.RECUSADA_PELA_COORDENACAO && resultado.chaveIdempotencia === dto.operacaoId) return this.detalhe(id);
      throw erro;
    }
    return this.detalhe(id);
  }

  private exigirTransacoesConfirmadas() {
    if (process.env.NODE_ENV === 'production' && process.env.MONGO_TRANSACTIONS_CONFIRMED !== 'true') {
      throw new ServiceUnavailableException('Decisões de troca estão desabilitadas até a confirmação de replica set/transações no MongoDB de produção.');
    }
  }

  async validar(id: string) {
    return this.validarNoBanco(new Types.ObjectId(id));
  }

  private async validarNoBanco(id: Types.ObjectId, session?: ClientSession) {
    const query = this.trocas.findById(id);
    if (session) query.session(session);
    const troca = await query.lean().exec();
    if (!troca) throw new NotFoundException('Solicitação de troca não encontrada.');
    const impedimentos: { codigo: string; mensagem: string }[] = [];
    const avisos: { codigo: string; mensagem: string }[] = [];
    if (String(troca.solicitanteProfissionalId) === String(troca.profissionalSolicitadoId)) {
      impedimentos.push({ codigo: 'MESMO_PROFISSIONAL', mensagem: 'Os dois participantes da troca precisam ser profissionais diferentes.' });
    }
    if (troca.status !== StatusTroca.AGUARDANDO_COORDENACAO || !troca.aceite ||
      String(troca.aceite.profissionalId) !== String(troca.profissionalSolicitadoId)) {
      impedimentos.push({ codigo: 'ACEITE_AUSENTE', mensagem: 'A solicitação não possui aceite válido do profissional solicitado.' });
    }
    const idsVinculos = [troca.vinculoSolicitanteId, troca.vinculoSolicitadoId];
    const qVinculos = this.vinculos.find({ _id: { $in: idsVinculos } }); if (session) qVinculos.session(session);
    const vinculos = await qVinculos.lean().exec();
    const porId = new Map(vinculos.map((v) => [String(v._id), v]));
    const vinculoA = porId.get(String(troca.vinculoSolicitanteId));
    const vinculoB = porId.get(String(troca.vinculoSolicitadoId));
    if (!vinculoA || !vinculoB || String(vinculoA.profissionalId) !== String(troca.solicitanteProfissionalId) ||
      String(vinculoB.profissionalId) !== String(troca.profissionalSolicitadoId) || String(vinculoA._id) === String(vinculoB._id)) {
      impedimentos.push({ codigo: 'VINCULOS_INVALIDOS', mensagem: 'Os dois vínculos não correspondem aos participantes registrados.' });
      return { apta: false, impedimentos, avisos, revisaoEsperada: 0, versaoPublicada: 0, contagemTrocas: [], limiteTrocas: null, cobertura: null };
    }
    const qPlantoes = this.plantoes.find({ _id: { $in: [vinculoA.plantaoId, vinculoB.plantaoId] } }); if (session) qPlantoes.session(session);
    const plantoes = await qPlantoes.lean().exec();
    const plantaoPorId = new Map(plantoes.map((p) => [String(p._id), p]));
    const plantaoA = plantaoPorId.get(String(vinculoA.plantaoId)); const plantaoB = plantaoPorId.get(String(vinculoB.plantaoId));
    if (!plantaoA || !plantaoB) {
      impedimentos.push({ codigo: 'PLANTAO_AUSENTE', mensagem: 'Um dos plantões associados à solicitação não existe.' });
      return { apta: false, impedimentos, avisos, revisaoEsperada: 0, versaoPublicada: 0, contagemTrocas: [], limiteTrocas: null, cobertura: null };
    }
    const qEscalas = this.escalas.find({ _id: { $in: [plantaoA.escalaId, plantaoB.escalaId] } }); if (session) qEscalas.session(session);
    const escalas = await qEscalas.lean().exec();
    const escalaPorId = new Map(escalas.map((e) => [String(e._id), e]));
    const escalaA = escalaPorId.get(String(plantaoA.escalaId)); const escalaB = escalaPorId.get(String(plantaoB.escalaId));
    if (!escalaA || !escalaB || escalaA.mes !== escalaB.mes || escalaA.ano !== escalaB.ano) {
      impedimentos.push({ codigo: 'COMPETENCIAS_DIFERENTES', mensagem: 'Os plantões não pertencem ao mesmo mês e ano.' });
      return { apta: false, impedimentos, avisos, revisaoEsperada: 0, versaoPublicada: 0, contagemTrocas: [], limiteTrocas: null, cobertura: null };
    }
    const escala = escalaA;
    if (troca.mes !== escala.mes || troca.ano !== escala.ano) {
      impedimentos.push({ codigo: 'COMPETENCIA_DIVERGENTE', mensagem: 'O período registrado na solicitação não corresponde aos plantões associados.' });
    }
    if (String(escalaA._id) !== String(escalaB._id)) impedimentos.push({ codigo: 'ESCALAS_DIFERENTES', mensagem: 'Os plantões não pertencem à mesma escala mensal oficial.' });
    if (escala.status === StatusEscala.EM_REVISAO || escala.status === StatusEscala.VALIDADA) {
      impedimentos.push({ codigo: 'REVISAO_ABERTA', mensagem: 'A escala possui uma revisão aberta. Revalide após publicá-la ou descartá-la.' });
    } else if (escala.status !== StatusEscala.PUBLICADA) {
      impedimentos.push({ codigo: 'ESCALA_NAO_PUBLICADA', mensagem: 'A escala mensal não possui uma versão oficial publicada vigente.' });
    }
    const qMensais = this.plantoes.find({ escalaId: escala._id }); if (session) qMensais.session(session);
    const plantoesMes = await qMensais.lean().exec();
    const idsPlantoesMes = plantoesMes.map((p) => p._id);
    const qVinculosMes = this.vinculos.find({ plantaoId: { $in: idsPlantoesMes } }); if (session) qVinculosMes.session(session);
    const vinculosMes = await qVinculosMes.lean().exec();
    const profissionaisIds = [...new Set(vinculosMes.map((v) => String(v.profissionalId)))];
    const qProfissionais = this.profissionais.find({ _id: { $in: profissionaisIds.map((value) => new Types.ObjectId(value)) } }); if (session) qProfissionais.session(session);
    const profissionaisDocs = await qProfissionais.lean().exec();
    const profPorId = new Map(profissionaisDocs.map((p) => [String(p._id), p]));
    const qUsuarios = this.usuarios.find({ _id: { $in: profissionaisDocs.map((p) => p.usuarioId) } }).select('nome'); if (session) qUsuarios.session(session);
    const usuarios = await qUsuarios.lean().exec();
    const nomePorUsuario = new Map(usuarios.map((u) => [String(u._id), u.nome]));
    for (const idProfissional of [String(troca.solicitanteProfissionalId), String(troca.profissionalSolicitadoId)]) {
      const p = profPorId.get(idProfissional);
      if (!p) impedimentos.push({ codigo: 'PROFISSIONAL_AUSENTE', mensagem: 'Um dos profissionais não está cadastrado.' });
      else if (p.status !== StatusProfissional.ATIVO) impedimentos.push({ codigo: 'PROFISSIONAL_INATIVO', mensagem: 'Um dos profissionais não está ativo.' });
    }
    const setorIds = [...new Set(plantoesMes.map((p) => String(p.setorId)))];
    const qSetores = this.setores.find({ _id: { $in: setorIds } }); if (session) qSetores.session(session);
    const setores = await qSetores.lean().exec();
    const qRestricoes = this.restricoes.find({ profissionalId: { $in: profissionaisIds }, inicio: { $lte: utcDate(escala.ano, escala.mes - 1, diasDoMes(escala.ano, escala.mes), 23, 59, 59, 999) }, fim: { $gte: utcDate(escala.ano, escala.mes - 1, 1) } }); if (session) qRestricoes.session(session);
    const restricoes = await qRestricoes.lean().exec();
    const chaveConfiguracao = `${String(escala.ano).padStart(4, '0')}-${String(escala.mes).padStart(2, '0')}`;
    const qConfiguracao = this.configuracoes.findOne({ chave: chaveConfiguracao }); if (session) qConfiguracao.session(session);
    const docConfiguracao = await qConfiguracao.lean().exec();
    const configuracao = docConfiguracao ? {
      periodo: docConfiguracao.chave,
      limiteTrocas: docConfiguracao.limiteTrocas,
      maxExtras: docConfiguracao.maxExtras,
      limitePlantoes: docConfiguracao.limitePlantoes,
      maxExtrasConcursado: docConfiguracao.maxExtrasConcursado,
      maxExtrasClt: docConfiguracao.maxExtrasClt,
      cargas: docConfiguracao.cargas,
    } : null;
    if (!configuracao) impedimentos.push({ codigo: 'LIMITE_NAO_CONFIGURADO', mensagem: 'A configuração mensal de trocas não existe; não será presumido um limite.' });
    else if (typeof configuracao.limiteTrocas !== 'number') impedimentos.push({ codigo: 'LIMITE_NAO_CONFIGURADO', mensagem: 'O limite de trocas desta competência não está configurado.' });
    const profEntrada = (idProfissional: string) => {
      const p = profPorId.get(idProfissional)!;
      return { id: idProfissional, nome: nomePorUsuario.get(String(p.usuarioId)) ?? 'Profissional', formacao: p.formacao, tipoVinculo: p.tipoVinculo, status: p.status };
    };
    const alocacoes = vinculosMes.flatMap((v) => {
      const p = plantaoPorId.get(String(v.plantaoId)) ?? plantoesMes.find((x) => String(x._id) === String(v.plantaoId));
      if (!p || !profPorId.has(String(v.profissionalId))) return [];
      let profissionalId = String(v.profissionalId);
      if (String(v._id) === String(vinculoA._id)) profissionalId = String(vinculoB.profissionalId);
      else if (String(v._id) === String(vinculoB._id)) profissionalId = String(vinculoA.profissionalId);
      return [{ profissional: profEntrada(profissionalId), funcao: v.funcao as Formacao, data: new Date(p.data), horarioInicio: p.horarioInicio, duracaoHoras: p.duracaoHoras, tipo: p.tipo, setorId: String(p.setorId) }];
    });
    const idsAfetados = [String(troca.solicitanteProfissionalId), String(troca.profissionalSolicitadoId)];
    const inicioMes = utcDate(escala.ano, escala.mes - 1, 1);
    const periodosAdjacentes = [
      { ano: escala.mes === 1 ? escala.ano - 1 : escala.ano, mes: escala.mes === 1 ? 12 : escala.mes - 1 },
      { ano: escala.mes === 12 ? escala.ano + 1 : escala.ano, mes: escala.mes === 12 ? 1 : escala.mes + 1 },
    ].filter((periodo) => periodo.ano >= 1 && periodo.ano <= 9999);
    const qAdjacentes = this.escalas.find({ $or: periodosAdjacentes }); if (session) qAdjacentes.session(session);
    const escalasAdjacentes = await qAdjacentes.lean().exec();
    let anteriores: { profissionalId: string; data: Date; horarioInicio: string; duracaoHoras: number }[] = [];
    if (escalasAdjacentes.length) {
      const qPlantoesAdjacentes = this.plantoes.find({ escalaId: { $in: escalasAdjacentes.map((item) => item._id) } }); if (session) qPlantoesAdjacentes.session(session);
      const pAdjacentes = await qPlantoesAdjacentes.lean().exec();
      const qVinculosAdjacentes = this.vinculos.find({ plantaoId: { $in: pAdjacentes.map((p) => p._id) }, profissionalId: { $in: idsAfetados.map((value) => new Types.ObjectId(value)) } }); if (session) qVinculosAdjacentes.session(session);
      const vAdjacentes = await qVinculosAdjacentes.lean().exec();
      anteriores = vAdjacentes.flatMap((v) => { const p = pAdjacentes.find((x) => String(x._id) === String(v.plantaoId)); return p ? [{ profissionalId: String(v.profissionalId), data: p.data, horarioInicio: p.horarioInicio, duracaoHoras: p.duracaoHoras }] : []; });
    }
    const erros = configuracao ? validarAlocacoesPlantao({
      ano: escala.ano, mes: escala.mes, configuracao,
      restricoes: restricoes.map((r) => ({ profissionalId: String(r.profissionalId), tipo: r.tipo, inicio: r.inicio, fim: r.fim, diaSemana: r.diaSemana })),
      anteriores: anteriores as never,
      existentes: [],
      candidatas: alocacoes.map(({ setorId: _setor, ...item }) => item as AlocacaoPlantaoValidacao),
    }) : [];
    erros.forEach((mensagem) => impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem }));
    const coberturaAntes = calcularPendenciasCobertura({ ano: escala.ano, mes: escala.mes,
      setores: setores.map((s) => ({ id: String(s._id), nome: s.nome, turnos: s.turnos })),
      alocacoes: vinculosMes.flatMap((v) => { const p = plantoesMes.find((x) => String(x._id) === String(v.plantaoId)); const prof = profPorId.get(String(v.profissionalId)); if (!p || !prof) return []; return [{ profissional: profEntrada(String(v.profissionalId)), funcao: v.funcao as Formacao, data: p.data, horarioInicio: p.horarioInicio, duracaoHoras: p.duracaoHoras, tipo: p.tipo, setorId: String(p.setorId) }]; }) });
    const coberturaDepois = calcularPendenciasCobertura({ ano: escala.ano, mes: escala.mes, setores: setores.map((s) => ({ id: String(s._id), nome: s.nome, turnos: s.turnos })), alocacoes });
    const faltasAntes = new Map(coberturaAntes.map((x) => [`${x.setorId}|${x.data}|${x.turno}|${x.funcao}`, x.faltam]));
    for (const falta of coberturaDepois) {
      const antes = faltasAntes.get(`${falta.setorId}|${falta.data}|${falta.turno}|${falta.funcao}`) ?? 0;
      if (falta.faltam > antes) impedimentos.push({ codigo: 'COBERTURA_AGRAVADA', mensagem: `${falta.setor}, ${falta.data} (${falta.turno}/${falta.funcao}): a falta aumentaria de ${antes} para ${falta.faltam}.` });
    }
    const limiteTrocas = configuracao?.limiteTrocas;
    const contagemTrocas: { profissionalId: string; aprovadas: number }[] = [];
    for (const profissionalId of idsAfetados) {
      const queryContagem = this.trocas.countDocuments({ status: StatusTroca.APROVADA, ano: escala.ano, mes: escala.mes,
        $or: [{ solicitanteProfissionalId: new Types.ObjectId(profissionalId) }, { profissionalSolicitadoId: new Types.ObjectId(profissionalId) }] });
      if (session) queryContagem.session(session);
      contagemTrocas.push({ profissionalId, aprovadas: await queryContagem.exec() });
    }
    if (limiteTrocas === undefined) impedimentos.push({ codigo: 'LIMITE_NAO_CONFIGURADO', mensagem: 'O limite de trocas desta competência não está configurado.' });
    else for (const item of contagemTrocas) if (item.aprovadas >= limiteTrocas) avisos.push({ codigo: 'LIMITE_ATINGIDO', mensagem: `O profissional atingiu o limite mensal de ${limiteTrocas} trocas.` });
    if (coberturaDepois.length) avisos.push({ codigo: 'COBERTURA_INSUFICIENTE', mensagem: `${coberturaDepois.length} posições de cobertura permanecerão sem preencher.` });
    return { apta: impedimentos.length === 0 && avisos.every((a) => a.codigo !== 'LIMITE_ATINGIDO'), impedimentos, avisos,
      revisaoEsperada: escala.revisao, versaoPublicada: escala.versaoPublicada, contagemTrocas, limiteTrocas: limiteTrocas ?? null,
      cobertura: { antes: coberturaAntes, depois: coberturaDepois } };
  }

  private async resumo(troca: TrocaRead) {
    const [solicitante, solicitado, plantaoA, plantaoB] = await Promise.all([
      this.nomeProfissional(troca.solicitanteProfissionalId),
      this.nomeProfissional(troca.profissionalSolicitadoId),
      this.plantaoPorVinculo(troca.vinculoSolicitanteId),
      this.plantaoPorVinculo(troca.vinculoSolicitadoId),
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
