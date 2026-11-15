import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { TipoUsuario } from '../src/usuarios/schemas/usuario.schema';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { aplicarMigrations, criarSolicitacaoAceitaFixture, type BancoDeTeste, iniciarBanco } from './helpers';
import { NotificacaoTroca } from '../src/escalas/schemas';

const SENHA = 'senha-de-teste-123';

describe('Trocas administrativas (e2e)', () => {
  let banco: BancoDeTeste;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let mongo: mongoose.mongo.MongoClient;
  let tokenCoord: string;
  let tokenEnfermeiro: string;
  let administradorId: mongoose.Types.ObjectId;
  let escalaId: mongoose.Types.ObjectId;
  let ids: { profissionalA: mongoose.Types.ObjectId; profissionalB: mongoose.Types.ObjectId; vinculoA: mongoose.Types.ObjectId; vinculoB: mongoose.Types.ObjectId };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (email: string, perfil?: string) =>
    (await http.post('/auth/login').send({ email, senha: SENHA, perfil }).expect(200)).body.accessToken as string;

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_trocas');
    await aplicarMigrations(banco.uri);
    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';
    const { AppModule } = await import('../src/app.module');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication(); configurarApp(app); await app.init();
    http = request(app.getHttpServer()); mongo = new mongoose.mongo.MongoClient(banco.uri);
    const usuarios = app.get(UsuariosService);
    const coord = await usuarios.criar({ nome: 'Coordenação', email: 'coord-trocas@nurseflow.com', cpf: '11144477735', senha: await AuthService.gerarHashSenha(SENHA), tipoUsuario: TipoUsuario.ADMINISTRADOR });
    await usuarios.criarAdministrador(coord._id);
    tokenCoord = await login('coord-trocas@nurseflow.com', 'coordenacao');
    const profissional = await http.post('/profissionais').set(auth(tokenCoord)).send({ nome: 'Ana Souza', cpf: '529.982.247-25', coren: 'COREN-CE 700001', formacao: 'enfermeiro', tipoVinculo: 'clt', email: 'ana-trocas@nurseflow.com', senha: SENHA }).expect(201);
    tokenEnfermeiro = await login('ana-trocas@nurseflow.com');
    const profissionalBResponse = await http.post('/profissionais').set(auth(tokenCoord)).send({ nome: 'Beatriz Lima', cpf: '390.533.447-05', coren: 'COREN-CE 700002', formacao: 'enfermeiro', tipoVinculo: 'clt', email: 'bia-trocas@nurseflow.com', senha: SENHA }).expect(201);
    const idA = new mongoose.Types.ObjectId(); const idB = new mongoose.Types.ObjectId();
    ids = { profissionalA: new mongoose.Types.ObjectId(profissional.body.id), profissionalB: new mongoose.Types.ObjectId(profissionalBResponse.body.id), vinculoA: idA, vinculoB: idB };
    const admin = await mongo.db().collection('administradores').findOne({ usuarioId: new mongoose.Types.ObjectId(coord.id) });
    administradorId = admin!._id as mongoose.Types.ObjectId;
    escalaId = new mongoose.Types.ObjectId();
    const setor = await http.post('/setores').set(auth(tokenCoord)).send({ nome: 'Unidade de teste de trocas', turnos: { diurno: { enfermeiros: 0, tecnicos: 0 }, noturno: { enfermeiros: 0, tecnicos: 0 } } }).expect(201);
    const plantaoA = new mongoose.Types.ObjectId(); const plantaoB = new mongoose.Types.ObjectId();
    const db = mongo.db();
    await db.collection('escalas').insertOne({ _id: escalaId, administradorId, mes: 11, ano: 2026, status: 'publicada', revisao: 1, versaoPublicada: 1, dataCriacao: new Date(), geracao: {} });
    await db.collection('plantoes').insertMany([
      { _id: plantaoA, escalaId, setorId: new mongoose.Types.ObjectId(setor.body.id), data: new Date('2026-11-05T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
      { _id: plantaoB, escalaId, setorId: new mongoose.Types.ObjectId(setor.body.id), data: new Date('2026-11-18T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
    ]);
    await db.collection('profissionaisRelacionados').insertMany([
      { _id: idA, plantaoId: plantaoA, profissionalId: ids.profissionalA, funcao: 'enfermeiro', lideranca: true, origemCobertura: 'regular' },
      { _id: idB, plantaoId: plantaoB, profissionalId: ids.profissionalB, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' },
    ]);
    await db.collection('versoesEscala').insertOne({ escalaId, numero: 1, mes: 11, ano: 2026, publicadoPor: administradorId,
      publicadoEm: new Date(), snapshot: { escala: { _id: escalaId, mes: 11, ano: 2026, status: 'publicada', revisao: 1, versaoPublicada: 1, geracao: {} },
        plantoes: [{ _id: plantaoA, escalaId, setorId: new mongoose.Types.ObjectId(setor.body.id), data: new Date('2026-11-05T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
          { _id: plantaoB, escalaId, setorId: new mongoose.Types.ObjectId(setor.body.id), data: new Date('2026-11-18T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' }],
        profissionaisRelacionados: [{ _id: idA, plantaoId: plantaoA, profissionalId: ids.profissionalA, funcao: 'enfermeiro', lideranca: true, origemCobertura: 'regular' },
          { _id: idB, plantaoId: plantaoB, profissionalId: ids.profissionalB, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' }], pendencias: [], conflitos: [], avisos: [], cargas: [] }, pendenciasConfirmadas: false });
    await http.get('/configuracoes?ano=2026&mes=11').set(auth(tokenCoord)).expect(200);
  });

  afterAll(async () => { await mongo?.close(); await app?.close(); await banco?.parar(); });

  it('protege as consultas e decisões com autenticação e perfil de Coordenação', async () => {
    await http.get('/trocas').expect(401);
    await http.get('/trocas').set(auth(tokenEnfermeiro)).expect(403);
    await http.post('/trocas/64b7f0f0f0f0f0f0f0f0f0f0/aprovar').set(auth(tokenEnfermeiro)).send({}).expect(403);
    await http.post('/trocas/64b7f0f0f0f0f0f0f0f0f0f0/recusar').set(auth(tokenCoord)).send({}).expect(400);
  });

  it('lista somente pedidos aceitos, retorna contador global e paginação e não oferece criação/aceite administrativos', async () => {
    const db = mongo.db();
    await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const aguardandoResposta = await db.collection('solicitacoesTroca').insertOne({ status: 'aguardando_resposta', ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB, criadaEm: new Date(),
      aceite: null, decisaoCoordenacao: null, createdAt: new Date(), updatedAt: new Date() });
    const resposta = await http.get('/trocas?status=pendentes&ano=2026&mes=11&limite=1').set(auth(tokenCoord)).expect(200);
    expect(resposta.body).toMatchObject({ pagina: 1, limite: 1, total: 1, totalPaginas: 1, contadores: { pendentes: 1, aprovadas: 0, recusadas: 0, aguardandoCoordenacao: 1 } });
    expect(resposta.body.itens).toHaveLength(1);
    expect(resposta.body.itens[0]).toHaveProperty('aceite.aceitoEm');
    expect(resposta.body.itens[0]).not.toHaveProperty('cpf');
    await http.post('/trocas').set(auth(tokenCoord)).send({ status: 'aguardando_coordenacao' }).expect(404);
    await http.post('/trocas/64b7f0f0f0f0f0f0f0f0f0f0/aceite').set(auth(tokenEnfermeiro)).send({}).expect(404);
    await http.post(`/trocas/${aguardandoResposta.insertedId}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1,
      operacaoId: randomUUID() }).expect(409);
    expect((await db.collection('solicitacoesTroca').findOne({ _id: aguardandoResposta.insertedId }))?.status).toBe('aguardando_resposta');
  });

  it('recusa com motivo sem alterar plantões e grava histórico/notificações em transação', async () => {
    const db = mongo.db();
    const troca = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const semJustificativa = await http.post(`/trocas/${troca.id}/recusar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1, operacaoId: randomUUID(), justificativa: '   ' }).expect(422);
    expect(semJustificativa.body.message).toContain('motivo');
    expect((await db.collection('solicitacoesTroca').findOne({ _id: troca.id }))?.status).toBe('aguardando_coordenacao');
    expect(await db.collection('auditoriaTrocas').countDocuments({ solicitacaoId: troca.id })).toBe(0);
    const response = await http.post(`/trocas/${troca.id}/recusar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1, operacaoId: randomUUID(), justificativa: 'Conflito com a cobertura da unidade.' }).expect(200);
    expect(response.body.status).toBe('recusada_pela_coordenacao');
    const vinculos = await db.collection('profissionaisRelacionados').find({ _id: { $in: [ids.vinculoA, ids.vinculoB] } }).toArray();
    expect(vinculos.map((v) => v.profissionalId.toString()).sort()).toEqual([ids.profissionalA.toString(), ids.profissionalB.toString()].sort());
    expect(await db.collection('auditoriaTrocas').countDocuments({ solicitacaoId: troca.id })).toBe(1);
    const notificacoes = await db.collection('notificacoesTroca').find({ solicitacaoId: troca.id }).toArray();
    expect(notificacoes).toHaveLength(2);
    expect(notificacoes.every((item) => item.mensagem.includes('Conflito com a cobertura'))).toBe(true);
    const usersDestinatarios = (await db.collection('profissionaisDaSaude').find({ _id: { $in: [ids.profissionalA, ids.profissionalB] } }).toArray()).map((item) => item.usuarioId.toString()).sort();
    expect(notificacoes.map((item) => item.destinatarioId.toString()).sort()).toEqual(usersDestinatarios);
    expect(response.body.plantaoSolicitante).toMatchObject({ horarioInicio: '07:00', horarioFim: '19:00', setor: 'Unidade de teste de trocas' });
    expect(response.body.plantaoSolicitado).toHaveProperty('data');
    expect(response.body.historico[0]).toMatchObject({ resultado: 'recusada', justificativa: 'Conflito com a cobertura da unidade.', responsavel: 'Coordenação' });
  });

  it('bloqueia validação quando a escala está em revisão e quando os plantões não são da mesma competência', async () => {
    const db = mongo.db();
    const trocaRevisao = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11, solicitanteProfissionalId: ids.profissionalA,
      profissionalSolicitadoId: ids.profissionalB, vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    await db.collection('escalas').updateOne({ _id: escalaId }, { $set: { status: 'em_revisao' } });
    const revisao = await http.get(`/trocas/${trocaRevisao.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(revisao.body.impedimentos.map((item: { codigo: string }) => item.codigo)).toContain('REVISAO_ABERTA');
    await http.post(`/trocas/${trocaRevisao.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1, operacaoId: randomUUID() }).expect(422);
    expect((await db.collection('solicitacoesTroca').findOne({ _id: trocaRevisao.id }))?.status).toBe('aguardando_coordenacao');
    expect(await db.collection('auditoriaTrocas').countDocuments({ solicitacaoId: trocaRevisao.id })).toBe(0);
    await db.collection('escalas').updateOne({ _id: escalaId }, { $set: { status: 'publicada' } });
    expect((await http.get(`/trocas/${trocaRevisao.id}/validacao`).set(auth(tokenCoord)).expect(200)).body.apta).toBe(true);

    const outroPeriodoId = new mongoose.Types.ObjectId(); const novoPlantaoId = new mongoose.Types.ObjectId(); const novoVinculoId = new mongoose.Types.ObjectId();
    const setorId = (await db.collection('plantoes').findOne({ escalaId }))!.setorId;
    await db.collection('escalas').insertOne({ _id: outroPeriodoId, administradorId, mes: 12, ano: 2026, status: 'publicada', revisao: 1, versaoPublicada: 1, dataCriacao: new Date(), geracao: {} });
    await db.collection('plantoes').insertOne({ _id: novoPlantaoId, escalaId: outroPeriodoId, setorId, data: new Date('2026-12-05T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' });
    await db.collection('profissionaisRelacionados').insertOne({ _id: novoVinculoId, plantaoId: novoPlantaoId, profissionalId: ids.profissionalB, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' });
    const trocaPeriodo = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11, solicitanteProfissionalId: ids.profissionalA,
      profissionalSolicitadoId: ids.profissionalB, vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: novoVinculoId });
    const periodo = await http.get(`/trocas/${trocaPeriodo.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(periodo.body.impedimentos.map((item: { codigo: string }) => item.codigo)).toContain('COMPETENCIAS_DIFERENTES');
    await http.post(`/trocas/${trocaPeriodo.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1, operacaoId: randomUUID() }).expect(409);
    expect((await db.collection('solicitacoesTroca').findOne({ _id: trocaPeriodo.id }))?.status).toBe('aguardando_coordenacao');
  });

  it('revalida status, formação, férias/ausência, descanso e carga dos dois profissionais', async () => {
    const db = mongo.db();
    const troca = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    await db.collection('profissionaisDaSaude').updateOne({ _id: ids.profissionalB }, { $set: { status: 'desativado' } });
    let result = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(result.body.impedimentos.some((item: { mensagem: string }) => item.mensagem.includes('não está ativo'))).toBe(true);
    await db.collection('profissionaisDaSaude').updateOne({ _id: ids.profissionalB }, { $set: { status: 'ativo' } });

    await db.collection('profissionaisRelacionados').updateOne({ _id: ids.vinculoB }, { $set: { funcao: 'tecnico' } });
    result = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(result.body.impedimentos.some((item: { mensagem: string }) => item.mensagem.includes('formação exigida'))).toBe(true);
    await db.collection('profissionaisRelacionados').updateOne({ _id: ids.vinculoB }, { $set: { funcao: 'enfermeiro' } });

    const restricaoId = new mongoose.Types.ObjectId();
    await db.collection('restricoes').insertOne({ _id: restricaoId, profissionalId: ids.profissionalA, tipo: 'ferias',
      inicio: new Date('2026-11-18T00:00:00Z'), fim: new Date('2026-11-20T23:59:59Z'), diaSemana: null });
    result = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(result.body.impedimentos.some((item: { mensagem: string }) => item.mensagem.includes('indisponível'))).toBe(true);
    await db.collection('restricoes').deleteOne({ _id: restricaoId });

    const descansoPlantao = new mongoose.Types.ObjectId(); const descansoVinculo = new mongoose.Types.ObjectId();
    await db.collection('plantoes').insertOne({ _id: descansoPlantao, escalaId, setorId: (await db.collection('plantoes').findOne({ escalaId }))!.setorId,
      data: new Date('2026-11-17T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' });
    await db.collection('profissionaisRelacionados').insertOne({ _id: descansoVinculo, plantaoId: descansoPlantao,
      profissionalId: ids.profissionalA, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' });
    result = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(result.body.impedimentos.some((item: { mensagem: string }) => item.mensagem.includes('descanso obrigatório'))).toBe(true);
    await db.collection('profissionaisRelacionados').deleteOne({ _id: descansoVinculo });
    await db.collection('plantoes').deleteOne({ _id: descansoPlantao });

    const config = await db.collection('configuracoes').findOne({ chave: 'global' });
    await db.collection('configuracoes').updateOne({ chave: 'global' }, { $set: { 'cargas.clt_30.plantoes12h': 1 } });
    const cargaPlantao = new mongoose.Types.ObjectId(); const cargaVinculo = new mongoose.Types.ObjectId();
    await db.collection('plantoes').insertOne({ _id: cargaPlantao, escalaId, setorId: (await db.collection('plantoes').findOne({ escalaId }))!.setorId,
      data: new Date('2026-11-02T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' });
    await db.collection('profissionaisRelacionados').insertOne({ _id: cargaVinculo, plantaoId: cargaPlantao,
      profissionalId: ids.profissionalA, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' });
    result = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(result.body.impedimentos.some((item: { mensagem: string }) => item.mensagem.includes('excede a carga regular'))).toBe(true);
    await db.collection('profissionaisRelacionados').deleteOne({ _id: cargaVinculo });
    await db.collection('plantoes').deleteOne({ _id: cargaPlantao });
    if (config) await db.collection('configuracoes').replaceOne({ _id: config._id }, config);
  });

  it('calcula a cobertura antes/depois e permite manter faltas já existentes sem agravamento', async () => {
    const db = mongo.db();
    const troca = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const plantaoA = await db.collection('plantoes').findOne({ _id: (await db.collection('profissionaisRelacionados').findOne({ _id: ids.vinculoA }))!.plantaoId });
    const setor = await db.collection('setores').findOne({ _id: plantaoA!.setorId });
    await db.collection('setores').updateOne({ _id: setor!._id }, { $set: { 'turnos.diurno.enfermeiros': 1 } });
    const result = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(result.body.cobertura.antes.length).toBeGreaterThan(0);
    expect(result.body.cobertura.depois).toEqual(result.body.cobertura.antes);
    expect(result.body.impedimentos.map((item: { codigo: string }) => item.codigo)).not.toContain('COBERTURA_AGRAVADA');
    await db.collection('setores').replaceOne({ _id: setor!._id }, setor!);
  });

  it('faz rollback integral quando falha uma etapa posterior à alteração dos vínculos', async () => {
    const db = mongo.db();
    const troca = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const notificacoes = app.get(getModelToken(NotificacaoTroca.name)) as { insertMany: (...args: unknown[]) => Promise<unknown> };
    const spy = jest.spyOn(notificacoes, 'insertMany').mockRejectedValueOnce(new Error('falha injetada ao persistir eventos'));
    try {
      await http.post(`/trocas/${troca.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1, operacaoId: randomUUID() }).expect(500);
    } finally { spy.mockRestore(); }
    expect((await db.collection('solicitacoesTroca').findOne({ _id: troca.id }))?.status).toBe('aguardando_coordenacao');
    expect((await db.collection('escalas').findOne({ _id: escalaId }))?.versaoPublicada).toBe(1);
    expect(await db.collection('versoesEscala').countDocuments({ escalaId })).toBe(1);
    expect(await db.collection('auditoriaTrocas').countDocuments({ solicitacaoId: troca.id })).toBe(0);
    expect(await db.collection('notificacoesTroca').countDocuments({ solicitacaoId: troca.id })).toBe(0);
    const vinculos = await db.collection('profissionaisRelacionados').find({ _id: { $in: [ids.vinculoA, ids.vinculoB] } }).toArray();
    expect(vinculos.find((v) => v._id.equals(ids.vinculoA))?.profissionalId.equals(ids.profissionalA)).toBe(true);
    expect(vinculos.find((v) => v._id.equals(ids.vinculoB))?.profissionalId.equals(ids.profissionalB)).toBe(true);
  });

  it('revalida e aprova a permuta com versão oficial nova, preservando vínculos e metadados; retry é idempotente', async () => {
    const db = mongo.db();
    const troca = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const validacao = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(validacao.body).toMatchObject({ apta: true, revisaoEsperada: 1, versaoPublicada: 1, limiteTrocas: 3 });
    const operation = randomUUID();
    const body = { revisaoEsperada: 1, operacaoId: operation };
    const response = await http.post(`/trocas/${troca.id}/aprovar`).set(auth(tokenCoord)).send(body).expect(200);
    expect(response.body.status).toBe('aprovada');
    expect(response.body.plantaoSolicitante).toHaveProperty('data');
    expect(response.body.plantaoSolicitado).toHaveProperty('data');
    expect(response.body.historico[0]).toMatchObject({ resultado: 'aprovada', responsavel: 'Coordenação' });
    const retry = await http.post(`/trocas/${troca.id}/aprovar`).set(auth(tokenCoord)).send(body).expect(200);
    expect(retry.body.status).toBe('aprovada');
    const vinculos = await db.collection('profissionaisRelacionados').find({ _id: { $in: [ids.vinculoA, ids.vinculoB] } }).toArray();
    expect(vinculos.find((v) => v._id.equals(ids.vinculoA))?.profissionalId.equals(ids.profissionalB)).toBe(true);
    expect(vinculos.find((v) => v._id.equals(ids.vinculoB))?.profissionalId.equals(ids.profissionalA)).toBe(true);
    expect(vinculos.find((v) => v._id.equals(ids.vinculoA))).toMatchObject({ funcao: 'enfermeiro', lideranca: true, origemCobertura: 'regular' });
    expect(await db.collection('versoesEscala').countDocuments({ escalaId })).toBe(2);
    expect(await db.collection('versoesEscala').countDocuments({ escalaId, numero: 2 })).toBe(1);
    expect(await db.collection('auditoriaTrocas').countDocuments({ solicitacaoId: troca.id })).toBe(1);
    const notificacoes = await db.collection('notificacoesTroca').find({ solicitacaoId: troca.id }).toArray();
    expect(notificacoes).toHaveLength(2);
    expect(notificacoes.every((item) => item.mensagem.includes('2026-11-05') && item.mensagem.includes('2026-11-18'))).toBe(true);
    expect(await db.collection('solicitacoesTroca').countDocuments({ status: 'aprovada', ano: 2026, mes: 11, $or: [{ solicitanteProfissionalId: ids.profissionalA }, { profissionalSolicitadoId: ids.profissionalA }] })).toBe(1);
    expect(await db.collection('escalas').findOne({ _id: escalaId })).toMatchObject({ versaoPublicada: 2, revisao: 2 });
    const versaoAnterior = await db.collection('versoesEscala').findOne({ escalaId, numero: 1 });
    expect(versaoAnterior?.snapshot.profissionaisRelacionados.map((item: { profissionalId: mongoose.Types.ObjectId }) => item.profissionalId.toString()).sort())
      .toEqual([ids.profissionalA.toString(), ids.profissionalB.toString()].sort());
    const aprovadas = await http.get('/trocas?status=aprovadas&ano=2026&mes=11').set(auth(tokenCoord)).expect(200);
    expect(aprovadas.body.contadores).toMatchObject({ aprovadas: 1 });
    expect(aprovadas.body.itens.map((item: { id: string }) => item.id)).toContain(String(troca.id));
    expect(aprovadas.body.itens[0]).not.toHaveProperty('cpf');
  });

  it('serializa decisões concorrentes em vínculos compartilhados e atende retries simultâneos com a mesma chave', async () => {
    const db = mongo.db();
    const vinculoA = await db.collection('profissionaisRelacionados').findOne({ _id: ids.vinculoA });
    const vinculoB = await db.collection('profissionaisRelacionados').findOne({ _id: ids.vinculoB });
    const winner = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: vinculoA!.profissionalId, profissionalSolicitadoId: vinculoB!.profissionalId,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const contender = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: vinculoA!.profissionalId, profissionalSolicitadoId: vinculoB!.profissionalId,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const revisaoEsperada = (await db.collection('escalas').findOne({ _id: escalaId }))!.revisao;
    const operacaoWinner = randomUUID(); const operacaoContender = randomUUID();
    const [respostaWinner, respostaContender] = await Promise.all([
      http.post(`/trocas/${winner.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada, operacaoId: operacaoWinner }),
      http.post(`/trocas/${contender.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada, operacaoId: operacaoContender }),
    ]);
    expect([respostaWinner.status, respostaContender.status].filter((status) => status === 200)).toHaveLength(1);
    expect([respostaWinner.status, respostaContender.status].filter((status) => [409, 422].includes(status))).toHaveLength(1);
    const vencedorId = respostaWinner.status === 200 ? winner.id : contender.id;
    const perdedorId = respostaWinner.status === 200 ? contender.id : winner.id;
    const operacaoEfetivada = respostaWinner.status === 200 ? operacaoWinner : operacaoContender;
    const repeticoes = await Promise.all([1, 2].map(() => http.post(`/trocas/${vencedorId}/aprovar`).set(auth(tokenCoord))
      .send({ revisaoEsperada, operacaoId: operacaoEfetivada })));
    expect(repeticoes.map((response) => response.status)).toEqual([200, 200]);
    expect(await db.collection('auditoriaTrocas').countDocuments({ solicitacaoId: vencedorId })).toBe(1);
    expect(await db.collection('notificacoesTroca').countDocuments({ solicitacaoId: vencedorId })).toBe(2);
    expect(await db.collection('auditoriaTrocas').countDocuments({ solicitacaoId: perdedorId })).toBe(0);
    expect(await db.collection('notificacoesTroca').countDocuments({ solicitacaoId: perdedorId })).toBe(0);
    expect((await db.collection('escalas').findOne({ _id: escalaId }))?.versaoPublicada).toBe(revisaoEsperada + 1);
  });

  it('conta o limite mensal por participante, permite exceção justificada e não ignora outros bloqueios', async () => {
    const db = mongo.db();
    const vinculoA = await db.collection('profissionaisRelacionados').findOne({ _id: ids.vinculoA });
    const vinculoB = await db.collection('profissionaisRelacionados').findOne({ _id: ids.vinculoB });
    const participanteA = vinculoA!.profissionalId as mongoose.Types.ObjectId;
    const participanteB = vinculoB!.profissionalId as mongoose.Types.ObjectId;
    await criarSolicitacaoAceitaFixture(db, { status: 'aprovada', ano: 2026, mes: 11, solicitanteProfissionalId: participanteA,
      profissionalSolicitadoId: participanteB, vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const recusada = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11, solicitanteProfissionalId: participanteA,
      profissionalSolicitadoId: participanteB, vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const revisao = (await db.collection('escalas').findOne({ _id: escalaId }))!.revisao;
    await http.post(`/trocas/${recusada.id}/recusar`).set(auth(tokenCoord)).send({ revisaoEsperada: revisao,
      operacaoId: randomUUID(), justificativa: 'Esta recusa não consome limite.' }).expect(200);
    const troca = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11, solicitanteProfissionalId: participanteA,
      profissionalSolicitadoId: participanteB, vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const validacao = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(validacao.body.contagemTrocas).toEqual(expect.arrayContaining([
      expect.objectContaining({ profissionalId: String(participanteA), aprovadas: 3 }),
      expect.objectContaining({ profissionalId: String(participanteB), aprovadas: 3 }),
    ]));
    expect(validacao.body.avisos.map((item: { codigo: string }) => item.codigo)).toContain('LIMITE_ATINGIDO');
    const operacaoId = randomUUID();
    await http.post(`/trocas/${troca.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: revisao,
      operacaoId, excecaoLimite: false }).expect(422);
    const plantaoRecebidoPorA = await db.collection('plantoes').findOne({ _id: vinculoB!.plantaoId });
    const restricaoId = new mongoose.Types.ObjectId();
    await db.collection('restricoes').insertOne({ _id: restricaoId, profissionalId: participanteA, tipo: 'ausencia',
      inicio: plantaoRecebidoPorA!.data, fim: plantaoRecebidoPorA!.data, diaSemana: null });
    const comOutroBloqueio = await http.post(`/trocas/${troca.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: revisao,
      operacaoId, excecaoLimite: true, justificativa: 'Exceção excepcional autorizada.' }).expect(422);
    expect(comOutroBloqueio.body.impedimentos).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'REGRA_ESCALA' })]));
    await db.collection('restricoes').deleteOne({ _id: restricaoId });
    const aprovada = await http.post(`/trocas/${troca.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: revisao,
      operacaoId, excecaoLimite: true, justificativa: 'Exceção excepcional autorizada.' }).expect(200);
    expect(aprovada.body.status).toBe('aprovada');
    expect(aprovada.body.historico[0]).toMatchObject({ excecaoLimite: true, justificativa: 'Exceção excepcional autorizada.' });
    expect(await db.collection('auditoriaTrocas').countDocuments({ solicitacaoId: troca.id, excecaoLimite: true })).toBe(1);
  });

  it('exige confirmação operacional de transações antes de decidir em produção', async () => {
    const troca = await criarSolicitacaoAceitaFixture(mongo.db(), { ano: 2026, mes: 11, solicitanteProfissionalId: ids.profissionalA,
      profissionalSolicitadoId: ids.profissionalB, vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const nodeEnv = process.env.NODE_ENV; const transactionsConfirmed = process.env.MONGO_TRANSACTIONS_CONFIRMED;
    process.env.NODE_ENV = 'production'; delete process.env.MONGO_TRANSACTIONS_CONFIRMED;
    try {
      await http.post(`/trocas/${troca.id}/recusar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1, operacaoId: randomUUID(), justificativa: 'Teste de guarda.' }).expect(503);
    } finally {
      if (nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = nodeEnv;
      if (transactionsConfirmed === undefined) delete process.env.MONGO_TRANSACTIONS_CONFIRMED; else process.env.MONGO_TRANSACTIONS_CONFIRMED = transactionsConfirmed;
    }
  });
});
