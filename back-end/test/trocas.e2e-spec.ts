import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { configurarApp, configurarSwagger } from '../src/app.setup';
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
  let tokenEnfermeiraB: string;
  let tokenTecnicoA: string;
  let tokenTecnicoB: string;
  let tecnicoAId: mongoose.Types.ObjectId;
  let tecnicoBId: mongoose.Types.ObjectId;
  let administradorId: mongoose.Types.ObjectId;
  let escalaId: mongoose.Types.ObjectId;
  let setorId: mongoose.Types.ObjectId;
  let ids: { profissionalA: mongoose.Types.ObjectId; profissionalB: mongoose.Types.ObjectId; vinculoA: mongoose.Types.ObjectId; vinculoB: mongoose.Types.ObjectId };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (email: string, perfil?: string) =>
    (await http.post('/auth/login').send({ email, senha: SENHA, perfil }).expect(200)).body.accessToken as string;

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_trocas');
    await aplicarMigrations(banco.uri);
    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';
    process.env.TROCA_JANELA_MAX_DIAS = '120';
    const { AppModule } = await import('../src/app.module.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication(); configurarApp(app); configurarSwagger(app); await app.init();
    http = request(app.getHttpServer()); mongo = new mongoose.mongo.MongoClient(banco.uri);
    const usuarios = app.get(UsuariosService);
    const coord = await usuarios.criar({ nome: 'Coordenação', email: 'coord-trocas@nurseflow.com', cpf: '11144477735', senha: await AuthService.gerarHashSenha(SENHA), tipoUsuario: TipoUsuario.ADMINISTRADOR });
    await usuarios.criarAdministrador(coord._id);
    tokenCoord = await login('coord-trocas@nurseflow.com', 'coordenacao');
    const profissional = await http.post('/profissionais').set(auth(tokenCoord)).send({ nome: 'Ana Souza', cpf: '529.982.247-25', coren: 'COREN-CE 700001', formacao: 'enfermeiro', tipoVinculo: 'clt', email: 'ana-trocas@nurseflow.com', senha: SENHA }).expect(201);
    tokenEnfermeiro = await login('ana-trocas@nurseflow.com');
    const profissionalBResponse = await http.post('/profissionais').set(auth(tokenCoord)).send({ nome: 'Beatriz Lima', cpf: '390.533.447-05', coren: 'COREN-CE 700002', formacao: 'enfermeiro', tipoVinculo: 'clt', email: 'bia-trocas@nurseflow.com', senha: SENHA }).expect(201);
    tokenEnfermeiraB = await login('bia-trocas@nurseflow.com');
    const tecnicoAResponse = await http.post('/profissionais').set(auth(tokenCoord)).send({ nome: 'Rafael Técnico', cpf: '168.995.350-09', coren: 'COREN-CE 700003', formacao: 'tecnico', tipoVinculo: 'clt', email: 'rafael-tecnico-trocas@nurseflow.com', senha: SENHA }).expect(201);
    const tecnicoBResponse = await http.post('/profissionais').set(auth(tokenCoord)).send({ nome: 'Daniel Técnico', cpf: '86288366757', coren: 'COREN-CE 700004', formacao: 'tecnico', tipoVinculo: 'clt', email: 'daniel-tecnico-trocas@nurseflow.com', senha: SENHA }).expect(201);
    tokenTecnicoA = await login('rafael-tecnico-trocas@nurseflow.com');
    tokenTecnicoB = await login('daniel-tecnico-trocas@nurseflow.com');
    tecnicoAId = new mongoose.Types.ObjectId(tecnicoAResponse.body.id);
    tecnicoBId = new mongoose.Types.ObjectId(tecnicoBResponse.body.id);
    const idA = new mongoose.Types.ObjectId(); const idB = new mongoose.Types.ObjectId();
    ids = { profissionalA: new mongoose.Types.ObjectId(profissional.body.id), profissionalB: new mongoose.Types.ObjectId(profissionalBResponse.body.id), vinculoA: idA, vinculoB: idB };
    const admin = await mongo.db().collection('administradores').findOne({ usuarioId: new mongoose.Types.ObjectId(coord.id) });
    administradorId = admin!._id as mongoose.Types.ObjectId;
    escalaId = new mongoose.Types.ObjectId();
    const setor = await http.post('/setores').set(auth(tokenCoord)).send({ nome: 'Unidade de teste de trocas', turnos: { diurno: { enfermeiros: 0, tecnicos: 0 }, noturno: { enfermeiros: 0, tecnicos: 0 } } }).expect(201);
    setorId = new mongoose.Types.ObjectId(setor.body.id);
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
    const swagger = await http.get('/docs-json').expect(200);
    expect(swagger.body.paths['/trocas/minhas/{id}/recusar'].post.summary).toContain('Recusa pelo profissional');
    expect(swagger.body.paths['/trocas/{id}/recusar'].post.summary).toContain('Recusa administrativa pela Coordenação');
    await http.get('/trocas').expect(401);
    await http.get('/trocas').set(auth(tokenEnfermeiro)).expect(403);
    await http.get('/trocas/historico?ano=2026').expect(401);
    await http.get('/trocas/historico?ano=2026').set(auth(tokenEnfermeiro)).expect(403);
    await http.post('/trocas/64b7f0f0f0f0f0f0f0f0f0f0/aprovar').set(auth(tokenEnfermeiro)).send({}).expect(403);
    await http.post('/trocas/64b7f0f0f0f0f0f0f0f0f0f0/recusar').set(auth(tokenCoord)).send({}).expect(400);
  });

  it('lista decisões do ano, exclui pendentes e pagina por data de conclusão', async () => {
    const db = mongo.db();
    const coordenacao = await db.collection('usuarios').findOne({ email: 'coord-trocas@nurseflow.com' });
    const datas = [
      new Date('2097-02-10T12:00:00.000Z'),
      new Date('2097-06-17T12:00:00.000Z'),
      new Date('2098-01-01T12:00:00.000Z'),
    ];
    const base = {
      ano: 2097, mes: 11,
      solicitanteProfissionalId: ids.profissionalA,
      profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA,
      vinculoSolicitadoId: ids.vinculoB,
      aceite: { profissionalId: ids.profissionalB, aceitoEm: datas[0] },
      criadaEm: datas[0],
      createdAt: datas[0],
      decisaoCoordenacao: null,
    };
    const registros = await db.collection('solicitacoesTroca').insertMany([
      {
        ...base,
        status: 'aprovada',
        decisaoCoordenacao: { resultado: 'aprovada', usuarioId: coordenacao!._id, decididaEm: datas[0] },
        updatedAt: datas[0],
      },
      { ...base, status: 'recusada_pelo_profissional', updatedAt: datas[1] },
      { ...base, ano: 2098, status: 'aprovada', updatedAt: datas[2],
        decisaoCoordenacao: { resultado: 'aprovada', usuarioId: coordenacao!._id, decididaEm: datas[2] } },
      { ...base, status: 'aguardando_coordenacao', updatedAt: datas[1] },
    ]);

    try {
      await http.get('/trocas/historico?ano=2097&pagina=0').set(auth(tokenCoord)).expect(400);
      const primeira = await http.get('/trocas/historico?ano=2097&pagina=1&limite=1').set(auth(tokenCoord)).expect(200);
      expect(primeira.body).toMatchObject({ ano: 2097, pagina: 1, limite: 1, total: 2, totalPaginas: 2 });
      expect(primeira.body.itens[0]).toMatchObject({
        solicitante: { nome: 'Ana Souza' },
        profissionalSolicitado: { nome: 'Beatriz Lima' },
        resultado: 'recusada',
        responsavel: { nome: 'Beatriz Lima' },
        decididaEm: datas[1].toISOString(),
      });
      const segunda = await http.get('/trocas/historico?ano=2097&pagina=2&limite=1').set(auth(tokenCoord)).expect(200);
      expect(segunda.body.itens[0]).toMatchObject({
        resultado: 'aprovada',
        responsavel: { nome: 'Coordenação' },
        decididaEm: datas[0].toISOString(),
      });
      expect(JSON.stringify(segunda.body)).not.toMatch(/cpf|coren|email|telefone/i);
    } finally {
      await db.collection('solicitacoesTroca').deleteMany({ _id: { $in: Object.values(registros.insertedIds) } });
    }
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

  it('recusa solicitação inválida por vínculo alterado sem exigir revisão e mantém aprovação bloqueada', async () => {
    const db = mongo.db();
    const troca = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    await db.collection('profissionaisRelacionados').updateOne(
      { _id: ids.vinculoA },
      { $set: { profissionalId: ids.profissionalB } },
    );
    try {
      const validacao = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
      expect(validacao.body.impedimentos.map((item: { codigo: string }) => item.codigo)).toContain('VINCULOS_INVALIDOS');
      const aprovacaoInvalida = await http.post(`/trocas/${troca.id}/aprovar`).set(auth(tokenCoord)).send({
        revisaoEsperada: 1,
        operacaoId: randomUUID(),
      });
      if (aprovacaoInvalida.status !== 409) throw new Error(JSON.stringify(aprovacaoInvalida.body));
      expect(String(aprovacaoInvalida.body.message)).toMatch(/plantão|plantões|atualizada/i);

      const operacaoId = randomUUID();
      const recusada = await http.post(`/trocas/${troca.id}/recusar`).set(auth(tokenCoord)).send({
        operacaoId,
      }).expect(200);
      expect(recusada.body.status).toBe('recusada_pela_coordenacao');
      expect(recusada.body.decisaoCoordenacao.justificativa).toBeFalsy();
      await http.post(`/trocas/${troca.id}/recusar`).set(auth(tokenCoord)).send({
        operacaoId,
      }).expect(200);
      const pendentes = await http.get('/trocas?status=pendentes&ano=2026&mes=11&limite=50').set(auth(tokenCoord)).expect(200);
      expect(pendentes.body.itens.map((item: { id: string }) => item.id)).not.toContain(troca.id);
    } finally {
      await db.collection('profissionaisRelacionados').updateOne(
        { _id: ids.vinculoA },
        { $set: { profissionalId: ids.profissionalA } },
      );
    }
  });

  it('recusa com motivo opcional sem alterar plantões e grava histórico/notificações em transação', async () => {
    const db = mongo.db();
    const troca = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const operacaoSemMotivo = randomUUID();
    const responseSemMotivo = await http.post(`/trocas/${troca.id}/recusar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1, operacaoId: operacaoSemMotivo }).expect(200);
    expect(responseSemMotivo.body.status).toBe('recusada_pela_coordenacao');
    expect(responseSemMotivo.body.decisaoCoordenacao.justificativa).toBeFalsy();
    expect(responseSemMotivo.body.historico[0].justificativa).toBeFalsy();
    const notificacoesSemMotivo = await db.collection('notificacoesTroca').find({ solicitacaoId: troca.id }).toArray();
    expect(notificacoesSemMotivo.every((item) => !item.mensagem.includes('undefined') && !item.mensagem.includes('null') && item.mensagem.includes('Sem motivo informado'))).toBe(true);
    const segundaTroca = await criarSolicitacaoAceitaFixture(db, { ano: 2026, mes: 11,
      solicitanteProfissionalId: ids.profissionalA, profissionalSolicitadoId: ids.profissionalB,
      vinculoSolicitanteId: ids.vinculoA, vinculoSolicitadoId: ids.vinculoB });
    const response = await http.post(`/trocas/${segundaTroca.id}/recusar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1, operacaoId: randomUUID(), justificativa: 'Conflito com a cobertura da unidade.' }).expect(200);
    expect(response.body.status).toBe('recusada_pela_coordenacao');
    const vinculos = await db.collection('profissionaisRelacionados').find({ _id: { $in: [ids.vinculoA, ids.vinculoB] } }).toArray();
    expect(vinculos.map((v) => v.profissionalId.toString()).sort()).toEqual([ids.profissionalA.toString(), ids.profissionalB.toString()].sort());
    expect(await db.collection('auditoriaTrocas').countDocuments({ solicitacaoId: troca.id })).toBe(1);
    const notificacoes = await db.collection('notificacoesTroca').find({ solicitacaoId: troca.id }).toArray();
    expect(notificacoes).toHaveLength(2);
    expect(notificacoes.every((item) => item.mensagem.length > 0)).toBe(true);
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

    await db.collection('profissionaisRelacionados').updateOne({ _id: ids.vinculoA }, { $set: { profissionalId: ids.profissionalB } });
    result = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(result.body.impedimentos.some((item: { mensagem: string }) =>
      item.mensagem.includes('mudou na escala') ||
      item.mensagem.includes('já foi trocado'))).toBe(true);
    await db.collection('profissionaisRelacionados').updateOne({ _id: ids.vinculoA }, { $set: { profissionalId: ids.profissionalA } });

    await db.collection('profissionaisRelacionados').updateOne({ _id: ids.vinculoB }, { $set: { funcao: 'tecnico' } });
    result = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(result.body.impedimentos.some((item: { mensagem: string }) => item.mensagem.includes('categoria deste plantão'))).toBe(true);
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
    expect(result.body.impedimentos.some((item: { mensagem: string }) => item.mensagem.includes('intervalo insuficiente'))).toBe(true);
    await db.collection('profissionaisRelacionados').deleteOne({ _id: descansoVinculo });
    await db.collection('plantoes').deleteOne({ _id: descansoPlantao });

    const config = await db.collection('configuracoes').findOne({ chave: '2026-11' });
    await db.collection('configuracoes').updateOne({ chave: '2026-11' }, { $set: { 'cargas.clt_30.plantoes12h': 1 } });
    const cargaPlantao = new mongoose.Types.ObjectId(); const cargaVinculo = new mongoose.Types.ObjectId();
    await db.collection('plantoes').insertOne({ _id: cargaPlantao, escalaId, setorId: (await db.collection('plantoes').findOne({ escalaId }))!.setorId,
      data: new Date('2026-11-02T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' });
    await db.collection('profissionaisRelacionados').insertOne({ _id: cargaVinculo, plantaoId: cargaPlantao,
      profissionalId: ids.profissionalA, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' });
    result = await http.get(`/trocas/${troca.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(result.body.impedimentos.some((item: { mensagem: string }) => item.mensagem.includes('carga mensal'))).toBe(true);
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
    expect(notificacoes.every((item) => item.mensagem.includes('aprovada') || item.titulo.includes('aprovada'))).toBe(true);
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

  it('creates and accepts a professional request before it enters the coordination queue', async () => {
    const db = mongo.db();
    const month = 1;
    const year = 2027;
    await http.get('/configuracoes?ano=2027&mes=1').set(auth(tokenCoord)).expect(200);
    await db.collection('configuracoes').updateOne({ chave: '2027-01' }, { $set: { limiteTrocas: 3, cargas: { clt_31: { plantoes24h: 5, plantoes12h: 2 } } } }, { upsert: true });
    const idEscala = new mongoose.Types.ObjectId();
    const linkA = new mongoose.Types.ObjectId(); const linkB = new mongoose.Types.ObjectId();
    const shiftA = new mongoose.Types.ObjectId(); const shiftB = new mongoose.Types.ObjectId();
    const setorB = await http.post('/setores').set(auth(tokenCoord)).send({ nome: 'Setor B de troca Enfermeiro', turnos: { diurno: { enfermeiros: 1, tecnicos: 0 }, noturno: { enfermeiros: 1, tecnicos: 0 } } }).expect(201);
    const setorBId = new mongoose.Types.ObjectId(setorB.body.id);
    const plantoes = [
      { _id: shiftA, escalaId: idEscala, setorId, data: new Date('2027-01-18T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
      { _id: shiftB, escalaId: idEscala, setorId: setorBId, data: new Date('2027-01-19T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
    ];
    const vinculos = [
      { _id: linkA, plantaoId: shiftA, profissionalId: ids.profissionalA, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' },
      { _id: linkB, plantaoId: shiftB, profissionalId: ids.profissionalB, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' },
    ];
    await db.collection('escalas').insertOne({ _id: idEscala, administradorId, mes: month, ano: year, status: 'em_revisao', revisao: 2, versaoPublicada: 1, dataCriacao: new Date(), geracao: {} });
    await db.collection('plantoes').insertMany(plantoes);
    await db.collection('profissionaisRelacionados').insertMany(vinculos);
    await db.collection('versoesEscala').insertOne({ escalaId: idEscala, numero: 1, mes: month, ano: year, publicadoPor: administradorId, publicadoEm: new Date(),
      snapshot: { escala: { _id: idEscala, mes: month, ano: year, status: 'publicada', revisao: 1, versaoPublicada: 1, geracao: {} }, plantoes, profissionaisRelacionados: vinculos, pendencias: [], conflitos: [], avisos: [], cargas: [] }, pendenciasConfirmadas: false });
    const candidatos = await http.get(`/trocas/minhas/plantoes/${linkA}/candidatos`).set(auth(tokenEnfermeiro)).expect(200);
    expect(candidatos.body.itens).toHaveLength(1);
    expect(candidatos.body.itens[0]).toMatchObject({ vinculoId: String(linkB), profissional: { nome: 'Beatriz Lima' } });
    const createOperationId = randomUUID();
    const created = await http.post('/trocas/minhas').set(auth(tokenEnfermeiro)).send({ vinculoSolicitanteId: String(linkA), vinculoSolicitadoId: String(linkB), versaoOficialEsperada: 1, operacaoId: createOperationId }).expect(201);
    const repeated = await http.post('/trocas/minhas').set(auth(tokenEnfermeiro)).send({ vinculoSolicitanteId: String(linkA), vinculoSolicitadoId: String(linkB), versaoOficialEsperada: 1, operacaoId: createOperationId });
    if (repeated.status !== 201) throw new Error(JSON.stringify({ body: repeated.body, event: await db.collection('eventosTrocaProfissional').findOne({ operacaoId: createOperationId }) }));
    expect(repeated.body.id).toBe(created.body.id);
    expect(await db.collection('eventosTrocaProfissional').countDocuments({ operacaoId: createOperationId })).toBe(1);
    await http.post('/trocas/minhas').set(auth(tokenEnfermeiro)).send({ vinculoSolicitanteId: String(linkB), vinculoSolicitadoId: String(linkA), versaoOficialEsperada: 1, operacaoId: createOperationId }).expect(409);
    expect(created.body.status).toBe('aguardando_resposta');
    const before = await http.get('/trocas?status=pendentes&pagina=1&limite=50').set(auth(tokenCoord)).expect(200);
    expect(before.body.itens.map((item: { id: string }) => item.id)).not.toContain(created.body.id);
    const acceptOperationId = randomUUID();
    await http.post(`/trocas/minhas/${created.body.id}/aceite`).set(auth(tokenEnfermeiraB)).send({ operacaoId: acceptOperationId }).expect(200);
    await http.post(`/trocas/minhas/${created.body.id}/aceite`).set(auth(tokenEnfermeiraB)).send({ operacaoId: acceptOperationId }).expect(200);
    expect(await db.collection('eventosTrocaProfissional').countDocuments({ operacaoId: acceptOperationId })).toBe(1);
    const after = await http.get('/trocas?status=pendentes&pagina=1&limite=50').set(auth(tokenCoord)).expect(200);
    expect(after.body.itens.filter((item: { id: string }) => item.id === created.body.id)).toHaveLength(1);
    expect((await db.collection('profissionaisRelacionados').findOne({ _id: linkA }))!.profissionalId.toString()).toBe(String(ids.profissionalA));
    expect((await db.collection('profissionaisRelacionados').findOne({ _id: linkB }))!.profissionalId.toString()).toBe(String(ids.profissionalB));
    const revisaoAberta = await http.get(`/trocas/${created.body.id}/validacao`).set(auth(tokenCoord)).expect(200);
    expect(revisaoAberta.body.impedimentos).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'REVISAO_ABERTA' })]));
    await http.post(`/trocas/${created.body.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: revisaoAberta.body.revisaoEsperada,
      operacaoId: randomUUID() }).expect(422);
    expect((await db.collection('solicitacoesTroca').findOne({ _id: new mongoose.Types.ObjectId(created.body.id) }))?.status).toBe('aguardando_coordenacao');
    await db.collection('escalas').updateOne({ _id: idEscala }, { $set: { status: 'publicada' } });
    const validation = await http.get(`/trocas/${created.body.id}/validacao`).set(auth(tokenCoord)).expect(200);
    await http.post(`/trocas/${created.body.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: validation.body.revisaoEsperada, operacaoId: randomUUID() }).expect(200);
    expect((await db.collection('profissionaisRelacionados').findOne({ _id: linkA }))!.profissionalId.toString()).toBe(String(ids.profissionalB));
    expect((await db.collection('profissionaisRelacionados').findOne({ _id: linkB }))!.profissionalId.toString()).toBe(String(ids.profissionalA));
    expect((await http.get(`/trocas/minhas/${created.body.id}`).set(auth(tokenEnfermeiro)).expect(200)).body.status).toBe('aprovada');
    expect((await http.get(`/trocas/minhas/${created.body.id}`).set(auth(tokenEnfermeiraB)).expect(200)).body.status).toBe('aprovada');
    expect((await http.get('/notificacoes/trocas').set(auth(tokenEnfermeiro)).expect(200)).body.notificacoes.map((item: { titulo: string }) => item.titulo)).toContain('Troca de plantão aprovada');
    expect((await http.get('/notificacoes/trocas').set(auth(tokenEnfermeiraB)).expect(200)).body.notificacoes.map((item: { titulo: string }) => item.titulo)).toContain('Troca de plantão aprovada');
    const original = await db.collection('versoesEscala').findOne({ escalaId: idEscala, numero: 1 });
    expect((original!.snapshot as { profissionaisRelacionados: { profissionalId: mongoose.Types.ObjectId }[] }).profissionaisRelacionados.map((item) => item.profissionalId.toString())).toEqual([String(ids.profissionalA), String(ids.profissionalB)]);
    const reversa = await http.post('/trocas/minhas').set(auth(tokenEnfermeiro)).send({ vinculoSolicitanteId: String(linkB), vinculoSolicitadoId: String(linkA), versaoOficialEsperada: 2, operacaoId: randomUUID() }).expect(201);
    await http.post(`/trocas/minhas/${reversa.body.id}/recusar`).set(auth(tokenEnfermeiraB)).send({ operacaoId: randomUUID() }).expect(200);
    expect((await http.get(`/trocas/minhas/${reversa.body.id}`).set(auth(tokenEnfermeiro)).expect(200)).body.status).toBe('recusada_pelo_profissional');
    const cancelarAntes = await http.post('/trocas/minhas').set(auth(tokenEnfermeiro)).send({ vinculoSolicitanteId: String(linkB), vinculoSolicitadoId: String(linkA), versaoOficialEsperada: 2, operacaoId: randomUUID() }).expect(201);
    const cancelada = await http.post(`/trocas/minhas/${cancelarAntes.body.id}/cancelar`).set(auth(tokenEnfermeiro)).send({ operacaoId: randomUUID() }).expect(200);
    expect(cancelada.body.status).toBe('cancelada');
    const cancelarApos = await http.post('/trocas/minhas').set(auth(tokenEnfermeiro)).send({ vinculoSolicitanteId: String(linkB), vinculoSolicitadoId: String(linkA), versaoOficialEsperada: 2, operacaoId: randomUUID() }).expect(201);
    await http.post(`/trocas/minhas/${cancelarApos.body.id}/aceite`).set(auth(tokenEnfermeiraB)).send({ operacaoId: randomUUID() }).expect(200);
    await http.post(`/trocas/minhas/${cancelarApos.body.id}/cancelar`).set(auth(tokenEnfermeiro)).send({ operacaoId: randomUUID() }).expect(200);
    expect((await http.get('/trocas?status=pendentes&pagina=1&limite=50').set(auth(tokenCoord)).expect(200)).body.itens.map((item: { id: string }) => item.id)).not.toContain(cancelarApos.body.id);

    await http.get('/configuracoes?ano=2026&mes=11').set(auth(tokenCoord)).expect(200);
    let refusalScale = (await db.collection('escalas').findOne({ mes: 12, ano: 2026 }))?._id as mongoose.Types.ObjectId | undefined;
    if (!refusalScale) {
      refusalScale = new mongoose.Types.ObjectId();
      await db.collection('escalas').insertOne({ _id: refusalScale, administradorId, mes: 12, ano: 2026, status: 'publicada', revisao: 1, versaoPublicada: 1, dataCriacao: new Date(), geracao: {} });
    }
    await http.get('/configuracoes?ano=2026&mes=12').set(auth(tokenCoord)).expect(200);
    const refusalLinkA = new mongoose.Types.ObjectId(); const refusalLinkB = new mongoose.Types.ObjectId();
    const refusalShiftA = new mongoose.Types.ObjectId(); const refusalShiftB = new mongoose.Types.ObjectId();
    const refusalShifts = [
      { _id: refusalShiftA, escalaId: refusalScale, setorId, data: new Date('2026-12-18T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
      { _id: refusalShiftB, escalaId: refusalScale, setorId, data: new Date('2026-12-19T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
    ];
    const refusalLinks = [
      { _id: refusalLinkA, plantaoId: refusalShiftA, profissionalId: ids.profissionalA, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' },
      { _id: refusalLinkB, plantaoId: refusalShiftB, profissionalId: ids.profissionalB, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' },
    ];
    await db.collection('plantoes').insertMany(refusalShifts); await db.collection('profissionaisRelacionados').insertMany(refusalLinks);
    await db.collection('versoesEscala').insertOne({ escalaId: refusalScale, numero: 1, mes: 12, ano: 2026, publicadoPor: administradorId, publicadoEm: new Date(),
      snapshot: { escala: { _id: refusalScale, mes: 12, ano: 2026, status: 'publicada', revisao: 1, versaoPublicada: 1, geracao: {} }, plantoes: refusalShifts, profissionaisRelacionados: refusalLinks, pendencias: [], conflitos: [], avisos: [], cargas: [] }, pendenciasConfirmadas: false });
    const refused = await http.post('/trocas/minhas').set(auth(tokenEnfermeiro)).send({ vinculoSolicitanteId: String(refusalLinkA), vinculoSolicitadoId: String(refusalLinkB), versaoOficialEsperada: 1, operacaoId: randomUUID() }).expect(201);
    await http.post(`/trocas/minhas/${refused.body.id}/aceite`).set(auth(tokenEnfermeiraB)).send({ operacaoId: randomUUID() }).expect(200);
    const refusalValidation = await http.get(`/trocas/${refused.body.id}/validacao`).set(auth(tokenCoord)).expect(200);
    await http.post(`/trocas/${refused.body.id}/recusar`).set(auth(tokenCoord)).send({ revisaoEsperada: refusalValidation.body.revisaoEsperada, operacaoId: randomUUID(), justificativa: 'Cobertura incompatível no período.' }).expect(200);
    const refusalDetail = await http.get(`/trocas/minhas/${refused.body.id}`).set(auth(tokenEnfermeiro)).expect(200);
    expect(refusalDetail.body.decisaoCoordenacao.justificativa).toBe('Cobertura incompatível no período.');
    expect((await http.get(`/trocas/minhas/${refused.body.id}`).set(auth(tokenEnfermeiraB)).expect(200)).body.decisaoCoordenacao.justificativa).toBe('Cobertura incompatível no período.');
    expect((await db.collection('profissionaisRelacionados').findOne({ _id: refusalLinkA }))!.profissionalId.toString()).toBe(String(ids.profissionalA));
    expect(await db.collection('versoesEscala').countDocuments({ escalaId: refusalScale })).toBe(1);
  });
  it('homologa troca ponta a ponta entre dois Técnicos sem permitir plantão de Enfermeiro', async () => {
    const db = mongo.db();
    await http.get('/configuracoes?ano=2027&mes=2').set(auth(tokenCoord)).expect(200);
    await db.collection('configuracoes').updateOne({ chave: '2027-02' }, { $set: { limiteTrocas: 3, limitePlantoes: 20, cargas: { clt_28: { plantoes24h: 20, plantoes12h: 20 } } } }, { upsert: true });
    const escalaIdTecnicos = new mongoose.Types.ObjectId();
    await db.collection('escalas').insertOne({ _id: escalaIdTecnicos, administradorId, mes: 2, ano: 2027, status: 'publicada', revisao: 1, versaoPublicada: 1, dataCriacao: new Date(), geracao: {} });
    const setorA = await http.post('/setores').set(auth(tokenCoord)).send({ nome: 'UTI Técnica A', turnos: { diurno: { enfermeiros: 0, tecnicos: 0 }, noturno: { enfermeiros: 0, tecnicos: 0 } } }).expect(201);
    const setorB = await http.post('/setores').set(auth(tokenCoord)).send({ nome: 'UTI Técnica B', turnos: { diurno: { enfermeiros: 0, tecnicos: 0 }, noturno: { enfermeiros: 0, tecnicos: 0 } } }).expect(201);
    const setorAId = new mongoose.Types.ObjectId(setorA.body.id);
    const setorBId = new mongoose.Types.ObjectId(setorB.body.id);
    const plantaoTecnicoA = new mongoose.Types.ObjectId();
    const plantaoTecnicoB = new mongoose.Types.ObjectId();
    const enfermeiroNoTecnico = new mongoose.Types.ObjectId();
    const vinculoTecnicoA = new mongoose.Types.ObjectId();
    const vinculoTecnicoB = new mongoose.Types.ObjectId();
    const vinculoEnfermeiro = new mongoose.Types.ObjectId();
    await db.collection('plantoes').insertMany([
      { _id: plantaoTecnicoA, escalaId: escalaIdTecnicos, setorId: setorAId, data: new Date('2027-02-10T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
      { _id: plantaoTecnicoB, escalaId: escalaIdTecnicos, setorId: setorBId, data: new Date('2027-02-11T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
      { _id: enfermeiroNoTecnico, escalaId: escalaIdTecnicos, setorId: setorAId, data: new Date('2027-02-12T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular' },
    ]);
    await db.collection('profissionaisRelacionados').insertMany([
      { _id: vinculoTecnicoA, plantaoId: plantaoTecnicoA, profissionalId: tecnicoAId, funcao: 'tecnico', lideranca: false, origemCobertura: 'regular' },
      { _id: vinculoTecnicoB, plantaoId: plantaoTecnicoB, profissionalId: tecnicoBId, funcao: 'tecnico', lideranca: false, origemCobertura: 'regular' },
      { _id: vinculoEnfermeiro, plantaoId: enfermeiroNoTecnico, profissionalId: ids.profissionalA, funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular' },
    ]);
    const snapshot = {
      escala: { _id: escalaIdTecnicos, mes: 2, ano: 2027, status: 'publicada', revisao: 1, versaoPublicada: 1, geracao: {} },
      plantoes: await db.collection('plantoes').find({ escalaId: escalaIdTecnicos }).toArray(),
      profissionaisRelacionados: await db.collection('profissionaisRelacionados').find({ _id: { $in: [vinculoTecnicoA, vinculoTecnicoB, vinculoEnfermeiro] } }).toArray(),
      pendencias: [], conflitos: [], avisos: [], cargas: [],
    };
    await db.collection('versoesEscala').updateOne({ escalaId: escalaIdTecnicos, numero: 1 }, { $set: { escalaId: escalaIdTecnicos, numero: 1, mes: 2, ano: 2027, publicadoPor: administradorId, publicadoEm: new Date(), snapshot, pendenciasConfirmadas: false } }, { upsert: true });

    const candidatos = await http.get(`/trocas/minhas/plantoes/${vinculoTecnicoA}/candidatos`).set(auth(tokenTecnicoA)).expect(200);
    expect(candidatos.body.itens.map((item: { vinculoId: string }) => item.vinculoId)).toContain(String(vinculoTecnicoB));
    expect(candidatos.body.itens.map((item: { vinculoId: string }) => item.vinculoId)).not.toContain(String(vinculoEnfermeiro));

    await http.post('/trocas/minhas').set(auth(tokenTecnicoA)).send({ vinculoSolicitanteId: String(vinculoTecnicoA), vinculoSolicitadoId: String(vinculoEnfermeiro), versaoOficialEsperada: 1, operacaoId: randomUUID() }).expect(422);

    const solicitada = await http.post('/trocas/minhas').set(auth(tokenTecnicoA)).send({ vinculoSolicitanteId: String(vinculoTecnicoA), vinculoSolicitadoId: String(vinculoTecnicoB), versaoOficialEsperada: 1, operacaoId: randomUUID() }).expect(201);
    expect(solicitada.body.status).toBe('aguardando_resposta');
    expect((await http.get('/trocas?status=pendentes&pagina=1&limite=50').set(auth(tokenCoord)).expect(200)).body.itens.map((item: { id: string }) => item.id)).not.toContain(solicitada.body.id);

    await http.post(`/trocas/minhas/${solicitada.body.id}/aceite`).set(auth(tokenTecnicoB)).send({ operacaoId: randomUUID() }).expect(200);
    expect((await http.get(`/trocas/minhas/${solicitada.body.id}`).set(auth(tokenTecnicoA)).expect(200)).body.status).toBe('aguardando_coordenacao');
    expect((await db.collection('profissionaisRelacionados').findOne({ _id: vinculoTecnicoA }))!.profissionalId.toString()).toBe(String(tecnicoAId));

    const fila = await http.get('/trocas?status=pendentes&pagina=1&limite=50').set(auth(tokenCoord)).expect(200);
    expect(fila.body.itens.map((item: { id: string }) => item.id)).toContain(solicitada.body.id);
    const validacao = await http.get(`/trocas/${solicitada.body.id}/validacao`).set(auth(tokenCoord)).expect(200);
    await http.post(`/trocas/${solicitada.body.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: validacao.body.revisaoEsperada, operacaoId: randomUUID() }).expect(200);
    expect((await db.collection('profissionaisRelacionados').findOne({ _id: vinculoTecnicoA }))!.profissionalId.toString()).toBe(String(tecnicoBId));
    expect((await db.collection('profissionaisRelacionados').findOne({ _id: vinculoTecnicoB }))!.profissionalId.toString()).toBe(String(tecnicoAId));
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
