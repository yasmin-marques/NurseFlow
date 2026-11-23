import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { type ClientSession, type Connection, Model, Types } from 'mongoose';
import { executarTransacao } from '../common/utils/mongo-transaction';
import { Perfil } from '../common/enums/perfil.enum';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { StatusProfissional } from '../profissionais/profissionais.enums';
import { Escala, EventoTrocaProfissional, NotificacaoTroca, Plantao, PlantaoProfissional, SolicitacaoTroca, StatusEscala, StatusTroca, VersaoEscala } from '../escalas/schemas';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { Setor } from '../setores/schemas/setor.schema';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { CriarMinhaTrocaDto, ListarMinhasTrocasDto } from './dto/minhas-trocas.dto';
import { TrocasService } from './trocas.service';
import { calcularBloqueiosDoProfissional } from '../escalas/montar-problema';

type ShiftSnapshot = Plantao & { _id: Types.ObjectId };
type LinkSnapshot = PlantaoProfissional & { _id: Types.ObjectId };
type PublicSnapshot = { plantoes: ShiftSnapshot[]; profissionaisRelacionados: LinkSnapshot[] };
// Mínimo 0: não excluir plantões próximos. A janela limita apenas o horizonte máximo.
const JANELA_TROCA_MIN_DIAS_BRUTA = Number(process.env.TROCA_JANELA_MIN_DIAS ?? 0);
const JANELA_TROCA_MAX_DIAS_BRUTA = Number(process.env.TROCA_JANELA_MAX_DIAS ?? 60);
const LIMITE_CANDIDATOS_TROCA_BRUTO = Number(process.env.TROCA_LIMITE_CANDIDATOS ?? 10);
const JANELA_TROCA_MIN_DIAS = Number.isFinite(JANELA_TROCA_MIN_DIAS_BRUTA) && JANELA_TROCA_MIN_DIAS_BRUTA >= 0
  ? JANELA_TROCA_MIN_DIAS_BRUTA
  : 0;
const JANELA_TROCA_MAX_DIAS = Number.isFinite(JANELA_TROCA_MAX_DIAS_BRUTA) ? JANELA_TROCA_MAX_DIAS_BRUTA : 60;
const LIMITE_CANDIDATOS_TROCA = Number.isFinite(LIMITE_CANDIDATOS_TROCA_BRUTO) ? LIMITE_CANDIDATOS_TROCA_BRUTO : 10;

@Injectable()
export class MinhasTrocasService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Profissional.name) private readonly profissionais: Model<Profissional>,
    @InjectModel(Usuario.name) private readonly usuarios: Model<Usuario>,
    @InjectModel(Escala.name) private readonly escalas: Model<Escala>,
    @InjectModel(VersaoEscala.name) private readonly versoes: Model<VersaoEscala>,
    @InjectModel(Plantao.name) private readonly plantoes: Model<Plantao>,
    @InjectModel(PlantaoProfissional.name) private readonly vinculos: Model<PlantaoProfissional>,
    @InjectModel(SolicitacaoTroca.name) private readonly trocas: Model<SolicitacaoTroca>,
    @InjectModel(EventoTrocaProfissional.name) private readonly eventos: Model<EventoTrocaProfissional>,
    @InjectModel(NotificacaoTroca.name) private readonly notificacoes: Model<NotificacaoTroca>,
    @InjectModel(Setor.name) private readonly setores: Model<Setor>,
    private readonly regras: TrocasService,
  ) {}

  async contar(usuario: UsuarioAutenticado) {
    const profissional = await this.profissionalDoUsuario(usuario);
    const recebidas = await this.trocas.countDocuments({ profissionalSolicitadoId: profissional._id, status: StatusTroca.AGUARDANDO_RESPOSTA }).exec();
    return { recebidas };
  }

  async listarNotificacoes(usuario: UsuarioAutenticado) {
    await this.profissionalDoUsuario(usuario);
    const itens = await this.notificacoes.find({ destinatarioId: new Types.ObjectId(usuario.id) }).sort({ createdAt: -1, _id: -1 }).limit(50).lean().exec();
    return { notificacoes: itens.map((item) => ({ id: String(item._id), solicitacaoId: String(item.solicitacaoId), eventKey: item.eventKey, titulo: item.titulo, mensagem: item.mensagem, criadaEm: item.createdAt, lidaEm: item.lidaEm ?? null })), naoLidas: itens.filter((item) => !item.lidaEm).length };
  }

  async marcarNotificacaoLida(usuario: UsuarioAutenticado, id: string) {
    await this.profissionalDoUsuario(usuario); this.validarObjectId(id);
    const result = await this.notificacoes.findOneAndUpdate({ _id: new Types.ObjectId(id), destinatarioId: new Types.ObjectId(usuario.id) }, { $set: { lidaEm: new Date() } }, { new: true }).lean().exec();
    if (!result) throw new NotFoundException('Notificação não encontrada.');
    return { id: String(result._id), lidaEm: result.lidaEm };
  }

  async listar(usuario: UsuarioAutenticado, dto: ListarMinhasTrocasDto) {
    const profissional = await this.profissionalDoUsuario(usuario);
    const ids = dto.aba === 'recebidas' ? { profissionalSolicitadoId: profissional._id, status: StatusTroca.AGUARDANDO_RESPOSTA }
      : dto.aba === 'enviadas' ? { solicitanteProfissionalId: profissional._id, status: { $in: [StatusTroca.AGUARDANDO_RESPOSTA, StatusTroca.AGUARDANDO_COORDENACAO] } }
        : { $or: [{ solicitanteProfissionalId: profissional._id }, { profissionalSolicitadoId: profissional._id }], status: { $in: [StatusTroca.APROVADA, StatusTroca.RECUSADA_PELA_COORDENACAO, StatusTroca.RECUSADA_PELO_PROFISSIONAL, StatusTroca.CANCELADA] } };
    const [docs, total] = await Promise.all([
      this.trocas.find(ids).sort({ updatedAt: -1, _id: -1 }).skip((dto.pagina - 1) * dto.limite).limit(dto.limite).lean().exec(),
      this.trocas.countDocuments(ids).exec(),
    ]);
    return { itens: await Promise.all(docs.map((doc) => this.detalhe(String(doc._id), usuario))), pagina: dto.pagina, limite: dto.limite, total, totalPaginas: Math.ceil(total / dto.limite) };
  }

  async plantoesProprios(usuario: UsuarioAutenticado) {
    const profissional = await this.profissionalDoUsuario(usuario);
    const agora = new Date();
    const escalas = await this.escalas.find({ status: StatusEscala.PUBLICADA, versaoPublicada: { $gte: 1 }, $or: this.periodosProximos(agora) }).lean().exec();
    const meses = await Promise.all(escalas.map(async (escala) => {
      const versao = await this.versoes.findOne({ escalaId: escala._id, numero: escala.versaoPublicada }).lean().exec();
      const snapshot = versao?.snapshot as Partial<PublicSnapshot> | undefined;
      if (!versao || !snapshot || !Array.isArray(snapshot.plantoes) || !Array.isArray(snapshot.profissionaisRelacionados)) return [];
      const shifts = new Map(snapshot.plantoes.map((p) => [String(p._id), p]));
      return snapshot.profissionaisRelacionados.filter((v) => String(v.profissionalId) === String(profissional._id)).flatMap((v) => {
        const shift = shifts.get(String(v.plantaoId));
        if (!shift || this.inicioPlantao(shift) <= agora) return [];
        return [{ v, shift, escala, versao }];
      });
    }));
    const raw = meses.flat();
    const setores = await this.setores.find({ _id: { $in: [...new Set(raw.map((item) => String(item.shift.setorId)))].map((id) => new Types.ObjectId(id)) } }).select('_id nome').lean().exec();
    const nomes = new Map(setores.map((setor) => [String(setor._id), setor.nome]));
    return { itens: raw.map(({ v, shift, escala, versao }) => ({ ...this.resumoVinculo(v, shift, nomes), escalaId: String(escala._id), versaoOficial: versao.numero, versaoOficialEsperada: escala.versaoPublicada })).sort((a, b) => a.data.localeCompare(b.data)) };
  }

  async candidatos(usuario: UsuarioAutenticado, vinculoId: string) {
    const profissional = await this.profissionalDoUsuario(usuario);
    const meu = await this.vinculoOficial(vinculoId);
    if (String(meu.vinculo.profissionalId) !== String(profissional._id)) throw new ForbiddenException('Este plant?o n?o pertence ao profissional autenticado.');
    if (this.inicioPlantao(meu.plantao) <= new Date()) throw new ConflictException('O plant?o j? come?ou.');

    // Contexto carregado uma única vez para esta busca.
    const contexto = await this.regras.prepararContextoValidacaoCandidatos(String(meu.escala._id));
    const agora = new Date();
    const inicioJanela = agora.getTime() + JANELA_TROCA_MIN_DIAS * 24 * 60 * 60 * 1000;
    const fimJanela = agora.getTime() + JANELA_TROCA_MAX_DIAS * 24 * 60 * 60 * 1000;

    const candidaturasBase: { v: LinkSnapshot; shift: ShiftSnapshot; escala: typeof meu.escala }[] = [];
    for (const lista of contexto.plantoesPorProfissional.values()) {
      for (const alocacao of lista) {
        if (String(alocacao.plantao.escalaId) !== String(meu.escala._id)) continue;
        if (String(alocacao.vinculo.profissionalId) === String(profissional._id)) continue;
        if (String(alocacao.vinculo._id) === String(meu.vinculo._id)) continue;
        candidaturasBase.push({ v: alocacao.vinculo as LinkSnapshot, shift: alocacao.plantao as ShiftSnapshot, escala: meu.escala });
      }
    }

    const nomePorUsuario = new Map<string, string>();
    const usuarioIds = [...new Set(candidaturasBase.map(({ v }) => {
      const colega = contexto.profissionaisPorId.get(String(v.profissionalId));
      return colega ? String(colega.usuarioId) : '';
    }).filter(Boolean))].map((id) => new Types.ObjectId(id));
    if (usuarioIds.length) {
      const usuarios = await this.usuarios.find({ _id: { $in: usuarioIds } }).select('nome').lean().exec();
      usuarios.forEach((usuario) => nomePorUsuario.set(String(usuario._id), usuario.nome));
    }

    const cacheValidacao = new Map<string, Promise<{ impedimentos: { codigo: string; mensagem: string }[] }>>();
    const candidaturas: Record<string, unknown>[] = [];
    const limite = Number.isInteger(LIMITE_CANDIDATOS_TROCA) && LIMITE_CANDIDATOS_TROCA > 0 ? LIMITE_CANDIDATOS_TROCA : 10;

    for (const { v, shift, escala } of candidaturasBase) {
      if (candidaturas.length >= limite) break;
      const colega = contexto.profissionaisPorId.get(String(v.profissionalId));
      if (!colega || colega.status !== StatusProfissional.ATIVO) continue;

      // 1. Mesma categoria
      if (colega.formacao !== profissional.formacao) continue;

      // 2. Apenas plantões futuros na janela configurável
      const inicioCandidato = this.inicioPlantao(shift).getTime();
      if (inicioCandidato < inicioJanela || inicioCandidato > fimJanela) continue;

      // 3. Compatibilidade de turno com as restrições do profissional
      const ano = contexto.escala.ano;
      const mes = contexto.escala.mes;
      const restricoes = contexto.restricoesPorProfissional.get(String(colega._id)) ?? [];
      const bloqueios = calcularBloqueiosDoProfissional(
        restricoes.map((r) => ({
          profissionalId: String(r.profissionalId), tipo: r.tipo, inicio: r.inicio, fim: r.fim,
          diasSemana: r.diasSemana, diaSemana: r.diaSemana, turno: r.turno,
        })),
        ano,
        mes,
      );
      const dia = new Date(shift.data).getUTCDate();
      if (bloqueios.diasBloqueados.includes(dia)) continue;
      const turnos = shift.duracaoHoras >= 24
        ? ['diurno', 'noturno']
        : [shift.horarioInicio === '07:00' ? 'diurno' : 'noturno'];
      if (turnos.some((turno) => bloqueios.turnosBloqueados.some((tb) => tb.dia === dia && tb.turno === turno))) continue;

      // 4. O candidato não pode estar escalado no dia do meu plantão,
      // e eu não posso estar escalado no dia do candidato.
      const candidatoOcupado = (contexto.plantoesPorProfissional.get(String(colega._id) ?? '') ?? [])
        .some((item) => new Date(item.plantao.data).toISOString().slice(0, 10) === new Date(meu.plantao.data).toISOString().slice(0, 10));
      const meuOcupado = (contexto.plantoesPorProfissional.get(String(profissional._id) ?? '') ?? [])
        .some((item) => new Date(item.plantao.data).toISOString().slice(0, 10) === new Date(shift.data).toISOString().slice(0, 10));
      if (candidatoOcupado || meuOcupado) continue;

      // 5. Somente os sobreviventes executam as regras pesadas.
      const elegibilidade = await this.regras.validarParEmMemoria(
        String(meu.vinculo._id),
        String(v._id),
        contexto,
        cacheValidacao,
      );
      if (elegibilidade.impedimentos.length) continue;

      const nomesSetores = new Map([[String(shift.setorId), contexto.setoresPorId.get(String(shift.setorId))?.nome ?? 'Setor']]);
      candidaturas.push({
        profissional: { id: String(colega._id), nome: nomePorUsuario.get(String(colega.usuarioId)) ?? 'Profissional' },
        ...this.resumoVinculo(v, shift, nomesSetores),
        escalaId: String(escala._id),
        versaoOficialEsperada: escala.versaoPublicada,
      });
    }

    return { itens: candidaturas };
  }
  async criar(usuario: UsuarioAutenticado, dto: CriarMinhaTrocaDto) {
    this.regras.exigirTransacoesConfirmadas();
    const profissional = await this.profissionalDoUsuario(usuario);
    this.validarObjectId(dto.vinculoSolicitanteId); this.validarObjectId(dto.vinculoSolicitadoId);
    if (dto.vinculoSolicitanteId === dto.vinculoSolicitadoId) throw new UnprocessableEntityException('Selecione dois plantões diferentes.');
    const existente = await this.eventos.findOne({ atorUsuarioId: new Types.ObjectId(usuario.id), operacaoId: dto.operacaoId }).lean().exec();
    if (existente) {
      const resumo = existente.resumoSeguro as Record<string, unknown>;
      if (existente.acao !== 'solicitada' || resumo.vinculoSolicitanteId !== dto.vinculoSolicitanteId || resumo.vinculoSolicitadoId !== dto.vinculoSolicitadoId || resumo.versaoOficialEsperada !== dto.versaoOficialEsperada) throw new ConflictException('O identificador da operação já foi usado com outra solicitação.');
      return this.detalhe(String(existente.solicitacaoId), usuario);
    }
    let id = '';
    await executarTransacao(this.connection, async (session) => {
      const a = await this.vinculoOficial(dto.vinculoSolicitanteId, session);
      const b = await this.vinculoOficial(dto.vinculoSolicitadoId, session);
      if (String(a.vinculo.profissionalId) !== String(profissional._id)) throw new ForbiddenException('O primeiro plantão deve pertencer a você.');
      if (String(a.escala._id) !== String(b.escala._id) || a.escala.versaoPublicada !== dto.versaoOficialEsperada) throw new ConflictException('A escala oficial mudou. Atualize os plantões e tente novamente.');
      if (this.inicioPlantao(a.plantao) <= new Date() || this.inicioPlantao(b.plantao) <= new Date()) throw new ConflictException('Os dois plantões precisam estar no futuro.');
      const destinatario = await this.profissionais.findById(b.vinculo.profissionalId).session(session).lean().exec();
      if (!destinatario || destinatario.status !== StatusProfissional.ATIVO) throw new UnprocessableEntityException('O profissional solicitado não está ativo.');
      const configuracao = await this.connection.collection('configuracoes').findOne({ chave: `${a.escala.ano}-${String(a.escala.mes).padStart(2, '0')}` }, { session });
      if (!configuracao || typeof configuracao.limiteTrocas !== 'number') throw new UnprocessableEntityException('O limite mensal de trocas não está configurado.');
      const contagem = await this.trocas.countDocuments({ ano: a.escala.ano, mes: a.escala.mes, status: StatusTroca.APROVADA, $or: [{ solicitanteProfissionalId: profissional._id }, { profissionalSolicitadoId: profissional._id }] }).session(session).exec();
      if (contagem >= configuracao.limiteTrocas) throw new UnprocessableEntityException('Você atingiu o limite mensal de trocas.');
      const setores = await this.setores.find({ _id: { $in: [a.plantao.setorId, b.plantao.setorId] } }).select('_id nome').session(session).lean().exec();
      const nomesSetores = new Map(setores.map((setor) => [String(setor._id), setor.nome]));
      const [doc] = await this.trocas.create([{
        mes: a.escala.mes, ano: a.escala.ano, solicitanteProfissionalId: profissional._id, profissionalSolicitadoId: destinatario._id,
        vinculoSolicitanteId: a.vinculo._id, vinculoSolicitadoId: b.vinculo._id, status: StatusTroca.AGUARDANDO_RESPOSTA,
        criadaEm: new Date(), resumoOriginal: { versaoOficial: a.escala.versaoPublicada, vinculoSolicitante: this.resumoVinculo(a.vinculo, a.plantao, nomesSetores), vinculoSolicitado: this.resumoVinculo(b.vinculo, b.plantao, nomesSetores) },
      }], { session });
      id = String(doc._id);
      const validacao = await this.regras.validarNoBanco(doc._id, session, false, undefined, false);
      if (validacao.impedimentos.length) throw new UnprocessableEntityException({ message: 'A troca não é elegível.', impedimentos: validacao.impedimentos });
      await this.registrarEvento(session, usuario, profissional._id, doc._id, dto.operacaoId, 'solicitada', 'nova', StatusTroca.AGUARDANDO_RESPOSTA, { vinculoSolicitanteId: String(a.vinculo._id), vinculoSolicitadoId: String(b.vinculo._id), versaoOficialEsperada: dto.versaoOficialEsperada });
      await this.notificar(session, doc._id, String(destinatario.usuarioId), `solicitacao:${doc._id}`, 'Nova solicitação de troca', 'Você recebeu uma solicitação de troca de plantão.');
    });
    return this.detalhe(id, usuario);
  }

  async aceitar(usuario: UsuarioAutenticado, id: string, operacaoId: string) { return this.transicionar(usuario, id, operacaoId, 'aceita'); }
  async recusar(usuario: UsuarioAutenticado, id: string, operacaoId: string) { return this.transicionar(usuario, id, operacaoId, 'recusada_pelo_profissional'); }
  async cancelar(usuario: UsuarioAutenticado, id: string, operacaoId: string) { return this.transicionar(usuario, id, operacaoId, 'cancelada'); }

  async detalhe(id: string, usuario: UsuarioAutenticado) {
    const profissional = await this.profissionalDoUsuario(usuario);
    const doc = await this.trocas.findById(id).lean().exec();
    if (!doc || (![doc.solicitanteProfissionalId, doc.profissionalSolicitadoId].some((value) => String(value) === String(profissional._id)))) throw new NotFoundException('Solicitação não encontrada.');
    const [solicitante, solicitado, eventos] = await Promise.all([
      this.nomeProfissional(doc.solicitanteProfissionalId), this.nomeProfissional(doc.profissionalSolicitadoId),
      this.eventos.find({ solicitacaoId: doc._id }).sort({ ocorridoEm: 1 }).select('acao estadoAnterior estadoNovo ocorridoEm resumoSeguro').lean().exec(),
    ]);
    return { id: String(doc._id), status: doc.status, criadaEm: doc.criadaEm, direcao: String(doc.solicitanteProfissionalId) === String(profissional._id) ? 'enviada' : 'recebida', solicitante: { nome: solicitante }, profissionalSolicitado: { nome: solicitado },
      plantaoSolicitante: doc.resumoOriginal?.vinculoSolicitante ?? null, plantaoSolicitado: doc.resumoOriginal?.vinculoSolicitado ?? null,
      decisaoCoordenacao: doc.decisaoCoordenacao ?? null, historico: eventos };
  }

  private async transicionar(usuario: UsuarioAutenticado, id: string, operacaoId: string, acao: 'aceita' | 'recusada_pelo_profissional' | 'cancelada') {
    this.regras.exigirTransacoesConfirmadas();
    const profissional = await this.profissionalDoUsuario(usuario); this.validarObjectId(id);
    const preexistente = await this.eventos.findOne({ atorUsuarioId: new Types.ObjectId(usuario.id), operacaoId }).lean().exec();
    if (preexistente) { if (String(preexistente.solicitacaoId) !== id || preexistente.acao !== acao) throw new ConflictException('O identificador da operação já foi utilizado com outra ação.'); return this.detalhe(id, usuario); }
    await executarTransacao(this.connection, async (session) => {
      const troca = await this.trocas.findById(id).session(session).lean().exec();
      if (!troca) throw new NotFoundException('Solicitação não encontrada.');
      const isSender = String(troca.solicitanteProfissionalId) === String(profissional._id);
      const isRecipient = String(troca.profissionalSolicitadoId) === String(profissional._id);
      if (acao === 'cancelada' ? !isSender : !isRecipient) throw new ForbiddenException('Você não pode executar esta ação.');
      const statusEsperado = acao === 'cancelada' ? [StatusTroca.AGUARDANDO_RESPOSTA, StatusTroca.AGUARDANDO_COORDENACAO] : [StatusTroca.AGUARDANDO_RESPOSTA];
      if (!statusEsperado.includes(troca.status)) throw new ConflictException('A solicitação já foi respondida ou concluída.');
      if (acao === 'aceita') {
        const a = await this.vinculoOficial(String(troca.vinculoSolicitanteId), session);
        const b = await this.vinculoOficial(String(troca.vinculoSolicitadoId), session);
        const resumoA = troca.resumoOriginal?.vinculoSolicitante;
        const resumoB = troca.resumoOriginal?.vinculoSolicitado;
        if (!this.termosCorrespondem(resumoA, this.resumoVinculo(a.vinculo, a.plantao)) || !this.termosCorrespondem(resumoB, this.resumoVinculo(b.vinculo, b.plantao))) throw new ConflictException('Os termos ou titulares mudaram desde a solicitação. Peça uma nova troca.');
        const validacao = await this.regras.validarNoBanco(troca._id, session, false, undefined, false);
        if (validacao.impedimentos.length) throw new UnprocessableEntityException({ message: 'A troca não é mais elegível.', impedimentos: validacao.impedimentos });
        const atualizado = await this.trocas.updateOne({ _id: troca._id, status: StatusTroca.AGUARDANDO_RESPOSTA }, { $set: { status: StatusTroca.AGUARDANDO_COORDENACAO, aceite: { profissionalId: profissional._id, aceitoEm: new Date() } } }, { session });
        if (atualizado.modifiedCount !== 1) throw new ConflictException('A solicitação foi atualizada por outra operação.');
      } else {
        const next = acao === 'cancelada' ? StatusTroca.CANCELADA : StatusTroca.RECUSADA_PELO_PROFISSIONAL;
        const update = acao === 'cancelada' ? { status: next, cancelamento: { profissionalId: profissional._id, canceladaEm: new Date() } } : { status: next };
        const result = await this.trocas.updateOne({ _id: troca._id, status: troca.status }, { $set: update }, { session });
        if (!result.modifiedCount) throw new ConflictException('A solicitação foi atualizada por outra operação.');
      }
      const next = acao === 'aceita' ? StatusTroca.AGUARDANDO_COORDENACAO : acao === 'cancelada' ? StatusTroca.CANCELADA : StatusTroca.RECUSADA_PELO_PROFISSIONAL;
      await this.registrarEvento(session, usuario, profissional._id, troca._id, operacaoId, acao, troca.status, next, {});
      const alvoProfissionalId = acao === 'cancelada' ? troca.profissionalSolicitadoId : troca.solicitanteProfissionalId;
      const alvo = await this.profissionais.findById(alvoProfissionalId).session(session).select('usuarioId').lean().exec();
      if (alvo) await this.notificar(session, troca._id, String(alvo.usuarioId), `${acao}:${troca._id}`, acao === 'aceita' ? 'Troca aceita' : acao === 'cancelada' ? 'Troca cancelada' : 'Troca recusada', acao === 'aceita' ? 'A solicitação aguarda a decisão da Coordenação.' : acao === 'cancelada' ? 'O profissional cancelou a solicitação.' : 'O profissional recusou a solicitação.');
    });
    return this.detalhe(id, usuario);
  }

  private async vinculoOficial(id: string, session?: ClientSession) {
    const q = this.vinculos.findById(id); if (session) q.session(session);
    const vinculo = await q.lean().exec(); if (!vinculo) throw new NotFoundException('Vínculo de plantão não encontrado.');
    const qp = this.plantoes.findById(vinculo.plantaoId); if (session) qp.session(session);
    const plantao = await qp.lean().exec(); if (!plantao) throw new NotFoundException('Plantão não encontrado.');
    const qe = this.escalas.findById(plantao.escalaId); if (session) qe.session(session);
    const escala = await qe.lean().exec();
    if (!escala || escala.versaoPublicada < 1) throw new ConflictException('O plantão não pertence a uma escala oficial publicada.');
    const qv = this.versoes.findOne({ escalaId: escala._id, numero: escala.versaoPublicada }); if (session) qv.session(session);
    const versao = await qv.lean().exec(); const snapshot = versao?.snapshot as Partial<PublicSnapshot> | undefined;
    if (!versao || !snapshot?.plantoes?.some((item) => String(item._id) === String(plantao._id)) || !snapshot.profissionaisRelacionados?.some((item) => String(item._id) === String(vinculo._id))) throw new ConflictException('O vínculo não consta na versão oficial vigente.');
    return { vinculo, plantao, escala, versao };
  }
  private resumoVinculo(v: LinkSnapshot, p: ShiftSnapshot, nomes?: Map<string, string>) { return { vinculoId: String(v._id), plantaoId: String(p._id), data: new Date(p.data).toISOString(), horarioInicio: p.horarioInicio, horarioFim: p.horarioFim, duracaoHoras: p.duracaoHoras, setorId: String(p.setorId), setor: nomes?.get(String(p.setorId)) ?? String(p.setorId), funcao: v.funcao }; }
  private termosCorrespondem(original: Record<string, unknown> | undefined, atual: Record<string, unknown>) { return Boolean(original) && ['vinculoId', 'plantaoId', 'data', 'horarioInicio', 'horarioFim', 'duracaoHoras', 'setorId', 'funcao'].every((chave) => original![chave] === atual[chave]); }
  private inicioPlantao(plantao: Plantao) { const inicio = new Date(plantao.data); const [hora, minuto] = plantao.horarioInicio.split(':').map(Number); inicio.setUTCHours(hora, minuto, 0, 0); return inicio; }
  private async profissionalDoUsuario(usuario: UsuarioAutenticado) {
    if (![Perfil.ENFERMEIRO, Perfil.TECNICO].includes(usuario.perfil) || !usuario.profissionalId || !Types.ObjectId.isValid(usuario.profissionalId)) throw new ForbiddenException('Cadastro profissional não associado à conta.');
    const profissional = await this.profissionais.findById(usuario.profissionalId).lean().exec();
    if (!profissional || String(profissional.usuarioId) !== usuario.id || profissional.status !== StatusProfissional.ATIVO) throw new ForbiddenException('Cadastro profissional não ativo ou não associado à conta.');
    return profissional;
  }
  private async nomeProfissional(id: Types.ObjectId) { const p = await this.profissionais.findById(id).select('usuarioId').lean().exec(); const u = p ? await this.usuarios.findById(p.usuarioId).select('nome').lean().exec() : null; return u?.nome ?? 'Profissional'; }
  private validarObjectId(id: string) { if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Solicitação não encontrada.'); }
  private periodosProximos(date: Date) { const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1; return [{ ano: y, mes: m }, { ano: m === 12 ? y + 1 : y, mes: m === 12 ? 1 : m + 1 }]; }
  private async registrarEvento(session: ClientSession, usuario: UsuarioAutenticado, profissionalId: Types.ObjectId, solicitacaoId: Types.ObjectId, operacaoId: string, acao: string, anterior: string, novo: string, resumoSeguro: Record<string, unknown>) {
    const assinaturaOperacao = createHash('sha256').update(JSON.stringify({ solicitacaoId: String(solicitacaoId), acao, resumoSeguro })).digest('hex');
    await this.eventos.create([{ solicitacaoId, atorUsuarioId: new Types.ObjectId(usuario.id), atorProfissionalId: profissionalId, acao, estadoAnterior: anterior, estadoNovo: novo, operacaoId, assinaturaOperacao, resumoSeguro: Object.keys(resumoSeguro).length ? resumoSeguro : { acao }, ocorridoEm: new Date() }], { session });
  }
  private async notificar(session: ClientSession, solicitacaoId: Types.ObjectId, destinatarioId: string, eventKey: string, titulo: string, mensagem: string) { await this.notificacoes.updateOne({ eventKey, destinatarioId: new Types.ObjectId(destinatarioId) }, { $setOnInsert: { solicitacaoId, eventKey, destinatarioId: new Types.ObjectId(destinatarioId), titulo, mensagem } }, { upsert: true, session }); }
}
