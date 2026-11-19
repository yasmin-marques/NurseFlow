import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { TipoUsuario } from '../src/usuarios/schemas/usuario.schema';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from './helpers';

const SENHA = 'senha-de-teste-123';

describe('Extras programados (e2e)', () => {
  let banco: BancoDeTeste;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let mongo: mongoose.mongo.MongoClient;
  let tokenCoord: string;
  let tokenEnfermeiro: string;
  let setorId: string;
  let profissionalEnfermeiroId: string;
  let _profissionalTecnicoId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (email: string, perfil?: string) =>
    (await http.post('/auth/login').send({ email, senha: SENHA, perfil }).expect(200)).body.accessToken as string;

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_extras');
    await aplicarMigrations(banco.uri);
    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';

    const { AppModule } = await import('../src/app.module');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();

    http = request(app.getHttpServer());
    mongo = new mongoose.mongo.MongoClient(banco.uri);

    const usuarios = app.get(UsuariosService);
    const coord = await usuarios.criar({
      nome: 'Coordenação Extras',
      email: 'coord-extras@nurseflow.com',
      cpf: '11144477735',
      senha: await AuthService.gerarHashSenha(SENHA),
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
    });
    await usuarios.criarAdministrador(coord._id);
    tokenCoord = await login('coord-extras@nurseflow.com', 'coordenacao');

    const enfermeiroResp = await http
      .post('/profissionais')
      .set(auth(tokenCoord))
      .send({
        nome: 'Carla Dias',
        cpf: '529.982.247-25',
        coren: 'COREN-CE 700010',
        formacao: 'enfermeiro',
        tipoVinculo: 'clt',
        email: 'carla-extras@nurseflow.com',
        senha: SENHA,
      })
      .expect(201);
    profissionalEnfermeiroId = enfermeiroResp.body.id;
    tokenEnfermeiro = await login('carla-extras@nurseflow.com');

    const tecnicoResp = await http
      .post('/profissionais')
      .set(auth(tokenCoord))
      .send({
        nome: 'Diego Rocha',
        cpf: '390.533.447-05',
        coren: 'COREN-CE 700020',
        formacao: 'tecnico',
        tipoVinculo: 'rpa',
        email: 'diego-extras@nurseflow.com',
        senha: SENHA,
      })
      .expect(201);
    _profissionalTecnicoId = tecnicoResp.body.id;

    const setorResp = await http
      .post('/setores')
      .set(auth(tokenCoord))
      .send({
        nome: 'UTI Pediátrica Extras',
        turnos: {
          diurno: { enfermeiros: 2, tecnicos: 4 },
          noturno: { enfermeiros: 1, tecnicos: 2 },
        },
      })
      .expect(201);
    setorId = setorResp.body.id;
  });

  afterAll(async () => {
    await mongo?.close();
    await app?.close();
    await banco?.parar();
  });

  it('protege endpoints com autenticação e perfil de Coordenação para mutações', async () => {
    // 401 sem autenticação
    await http.get('/extras').expect(401);
    await http.get('/extras/resumo?ano=2027&mes=3').expect(401);
    await http.get('/extras/64b7f0f0f0f0f0f0f0f0f0f0').expect(401);
    await http.post('/extras').send({}).expect(401);
    await http.patch('/extras/64b7f0f0f0f0f0f0f0f0f0f0').send({}).expect(401);
    await http.post('/extras/64b7f0f0f0f0f0f0f0f0f0f0/cancelar').send({}).expect(401);
    await http.post('/extras/64b7f0f0f0f0f0f0f0f0f0f0/conciliar').send({}).expect(401);
    await http.post('/extras/64b7f0f0f0f0f0f0f0f0f0f0/desconciliar').send({}).expect(401);

    // 403 para enfermeiro em mutações
    await http
      .post('/extras')
      .set(auth(tokenEnfermeiro))
      .send({
        data: '2027-03-10',
        opcao: '12d',
        setorId,
        funcao: 'enfermeiro',
        substitutoId: profissionalEnfermeiroId,
        motivo: 'reforco',
      })
      .expect(403);

    await http
      .patch('/extras/64b7f0f0f0f0f0f0f0f0f0f0')
      .set(auth(tokenEnfermeiro))
      .send({ revisaoEsperada: 1 })
      .expect(403);

    await http
      .post('/extras/64b7f0f0f0f0f0f0f0f0f0f0/cancelar')
      .set(auth(tokenEnfermeiro))
      .send({ revisaoEsperada: 1, justificativa: 'Cancelamento teste' })
      .expect(403);

    await http
      .post('/extras/64b7f0f0f0f0f0f0f0f0f0f0/conciliar')
      .set(auth(tokenEnfermeiro))
      .send({})
      .expect(403);

    await http
      .post('/extras/64b7f0f0f0f0f0f0f0f0f0f0/desconciliar')
      .set(auth(tokenEnfermeiro))
      .send({})
      .expect(403);

    // Leitura permitida para enfermeiro autenticado
    await http.get('/extras?ano=2027&mes=3').set(auth(tokenEnfermeiro)).expect(200);
    await http.get('/extras/resumo?ano=2027&mes=3').set(auth(tokenEnfermeiro)).expect(200);
  });

  it('valida DTO de criação com erro 400 para formato inválido de data e campos ausentes', async () => {
    // Data inválida
    await http
      .post('/extras')
      .set(auth(tokenCoord))
      .send({
        data: 'data-invalida',
        opcao: '12d',
        setorId,
        funcao: 'enfermeiro',
        substitutoId: profissionalEnfermeiroId,
        motivo: 'reforco',
      })
      .expect(400);

    // Campos obrigatórios ausentes
    await http
      .post('/extras')
      .set(auth(tokenCoord))
      .send({
        data: '2027-03-10',
      })
      .expect(400);
  });

  it('rejeita criação com 404 para substituto inexistente e 422 para formação incompatível', async () => {
    // Substituto inexistente
    const idFake = new Types.ObjectId().toString();
    await http
      .post('/extras')
      .set(auth(tokenCoord))
      .send({
        data: '2027-03-10',
        opcao: '12d',
        setorId,
        funcao: 'enfermeiro',
        substitutoId: idFake,
        motivo: 'reforco',
      })
      .expect(404);

    // Formação incompatível: profissional é enfermeiro, função informada é técnico
    await http
      .post('/extras')
      .set(auth(tokenCoord))
      .send({
        data: '2027-03-10',
        opcao: '12d',
        setorId,
        funcao: 'tecnico',
        substitutoId: profissionalEnfermeiroId,
        motivo: 'reforco',
      })
      .expect(422);
  });

  it('fluxo completo de CRUD: cria extra, consulta resumo, lista, detalha, edita e cancela com auditoria', async () => {
    // 1. Criação do extra válido
    const criacaoResp = await http
      .post('/extras')
      .set(auth(tokenCoord))
      .send({
        data: '2027-03-15',
        opcao: '12d',
        setorId,
        funcao: 'enfermeiro',
        substitutoId: profissionalEnfermeiroId,
        motivo: 'reforco',
        observacao: 'Extra de teste E2E',
      })
      .expect(201);

    const extraId = criacaoResp.body._id;
    expect(extraId).toBeDefined();
    expect(criacaoResp.body.situacao).toBe('programado');
    expect(criacaoResp.body.revisao).toBe(1);

    // Tentativa de duplicidade / sobreposição ativa -> 422
    await http
      .post('/extras')
      .set(auth(tokenCoord))
      .send({
        data: '2027-03-15',
        opcao: '12d',
        setorId,
        funcao: 'enfermeiro',
        substitutoId: profissionalEnfermeiroId,
        motivo: 'reforco',
      })
      .expect(422);

    // 2. Consulta de resumo mensal
    const resumoResp = await http
      .get('/extras/resumo?ano=2027&mes=3')
      .set(auth(tokenCoord))
      .expect(200);

    expect(resumoResp.body).toMatchObject({
      ano: 2027,
      mes: 3,
      totalExtrasAtivos: 1,
      totalHoras: 12,
      totalRpaAtivos: 1, // Diego Rocha cadastrado como RPA ativo
    });

    // 3. Listagem com filtros e paginação
    const listaResp = await http
      .get(`/extras?ano=2027&mes=3&setorId=${setorId}&situacao=programado&limite=5`)
      .set(auth(tokenCoord))
      .expect(200);

    expect(listaResp.body.total).toBe(1);
    expect(listaResp.body.pagina).toBe(1);
    expect(listaResp.body.limite).toBe(5);
    expect(listaResp.body.itens).toHaveLength(1);
    expect(listaResp.body.itens[0]).toMatchObject({
      id: extraId,
      data: '2027-03-15',
      opcao: '12d',
      funcao: 'enfermeiro',
      situacao: 'programado',
      statusVinculo: 'sem_escala',
    });
    expect(listaResp.body.itens[0].substitutoId).toHaveProperty('nome', 'Carla Dias');
    expect(listaResp.body.itens[0].setorId).toHaveProperty('nome', 'UTI Pediátrica Extras');

    // Busca textual por nome do profissional
    const buscaResp = await http
      .get('/extras?ano=2027&mes=3&busca=Carla')
      .set(auth(tokenCoord))
      .expect(200);
    expect(buscaResp.body.total).toBe(1);

    // 4. Detalhe do extra
    const detalheResp = await http
      .get(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .expect(200);

    expect(detalheResp.body.id).toBe(extraId);
    expect(detalheResp.body.statusVinculo).toBe('sem_escala');
    expect(detalheResp.body.historico).toHaveLength(1);
    expect(detalheResp.body.historico[0].evento).toBe('CRIADO');

    // 404 para ID inexistente e 400 para ObjectId mal formatado
    await http.get(`/extras/${new Types.ObjectId()}`).set(auth(tokenCoord)).expect(404);
    await http.get('/extras/id-invalido').set(auth(tokenCoord)).expect(400);

    // 5. Edição com controle de concorrência por revisão
    // Rejeita com 409 se revisaoEsperada estiver obsoleta
    await http
      .patch(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .send({
        revisaoEsperada: 99,
        observacao: 'Tentativa concorrente inválida',
      })
      .expect(409);

    // Edição bem-sucedida com revisaoEsperada: 1
    const edicaoResp = await http
      .patch(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .send({
        revisaoEsperada: 1,
        observacao: 'Observação alterada com sucesso',
      })
      .expect(200);

    expect(edicaoResp.body.revisao).toBe(2);
    expect(edicaoResp.body.observacao).toBe('Observação alterada com sucesso');

    // 6. Cancelamento lógico
    // Rejeita com 400 se justificativa for em branco
    await http
      .post(`/extras/${extraId}/cancelar`)
      .set(auth(tokenCoord))
      .send({
        revisaoEsperada: 2,
        justificativa: '   ',
      })
      .expect(400);

    // Rejeita com 409 se revisão for obsoleta
    await http
      .post(`/extras/${extraId}/cancelar`)
      .set(auth(tokenCoord))
      .send({
        revisaoEsperada: 1,
        justificativa: 'Substituto cancelou',
      })
      .expect(409);

    // Cancelamento bem-sucedido com revisaoEsperada: 2
    const cancelamentoResp = await http
      .post(`/extras/${extraId}/cancelar`)
      .set(auth(tokenCoord))
      .send({
        revisaoEsperada: 2,
        justificativa: 'Substituto cancelou com antecedência',
      })
      .expect(200);

    expect(cancelamentoResp.body.situacao).toBe('cancelado');
    expect(cancelamentoResp.body.revisao).toBe(3);
    expect(cancelamentoResp.body.justificativaCancelamento).toBe('Substituto cancelou com antecedência');

    // Não permite cancelar novamente (409)
    await http
      .post(`/extras/${extraId}/cancelar`)
      .set(auth(tokenCoord))
      .send({
        revisaoEsperada: 3,
        justificativa: 'Tentando cancelar de novo',
      })
      .expect(409);

    // Não permite editar um extra já cancelado (409)
    await http
      .patch(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .send({
        revisaoEsperada: 3,
        observacao: 'Não pode editar cancelado',
      })
      .expect(409);

    // Detalhe agora contém eventos CRIADO, EDITADO e CANCELADO
    const detalheAposCancelamento = await http
      .get(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .expect(200);

    expect(detalheAposCancelamento.body.situacao).toBe('cancelado');
    expect(detalheAposCancelamento.body.historico).toHaveLength(3);
    const eventos = detalheAposCancelamento.body.historico.map((h: { evento: string }) => h.evento);
    expect(eventos).toContain('CRIADO');
    expect(eventos).toContain('EDITADO');
    expect(eventos).toContain('CANCELADO');

    // Resumo mensal reflete 0 extras ativos após o cancelamento
    const resumoAposCancelamento = await http
      .get('/extras/resumo?ano=2027&mes=3')
      .set(auth(tokenCoord))
      .expect(200);

    expect(resumoAposCancelamento.body.totalExtrasAtivos).toBe(0);
    expect(resumoAposCancelamento.body.totalHoras).toBe(0);
    expect(resumoAposCancelamento.body.totalRpaAtivos).toBe(1);
  });

  it('integração com escalas: conciliação idempotente, desconciliação e proteção de escala publicada', async () => {
    // 1. Cria escala rascunho para 05/2027
    const escalaResp = await http
      .post('/escalas')
      .set(auth(tokenCoord))
      .send({ ano: 2027, mes: 5 })
      .expect(201);
    const escalaId = escalaResp.body.escala.id;

    // 2. Cria um extra sem escala para 2027-05-10
    const extraResp = await http
      .post('/extras')
      .set(auth(tokenCoord))
      .send({
        data: '2027-05-10',
        opcao: '12d',
        setorId,
        funcao: 'enfermeiro',
        substitutoId: profissionalEnfermeiroId,
        motivo: 'reforco',
      })
      .expect(201);
    const extraId = extraResp.body._id;

    // Detalhe inicial mostra statusVinculo: sem_escala
    const detalheSemEscala = await http
      .get(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .expect(200);
    expect(detalheSemEscala.body.statusVinculo).toBe('sem_escala');

    // 3. Concilia o extra com a escala editável
    const conciliarResp1 = await http
      .post(`/extras/${extraId}/conciliar`)
      .set(auth(tokenCoord))
      .send({ escalaId })
      .expect(200);

    expect(conciliarResp1.body.escalaId).toBe(escalaId);
    expect(conciliarResp1.body.plantaoProfissionalId).toBeDefined();
    const plantaoProfissionalId = conciliarResp1.body.plantaoProfissionalId;

    // Detalhe agora mostra statusVinculo: vinculado
    const detalheVinculado = await http
      .get(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .expect(200);
    expect(detalheVinculado.body.statusVinculo).toBe('vinculado');

    // 4. Idempotência: concilia novamente e confere que mantém a mesma alocação sem duplicar
    const conciliarResp2 = await http
      .post(`/extras/${extraId}/conciliar`)
      .set(auth(tokenCoord))
      .send({ escalaId })
      .expect(200);

    expect(conciliarResp2.body.plantaoProfissionalId).toBe(plantaoProfissionalId);

    const vinculosNoBanco = await mongo
      .db('nurseflow_extras')
      .collection('profissionaisRelacionados')
      .countDocuments({ extraProgramadoId: new Types.ObjectId(extraId) });
    expect(vinculosNoBanco).toBe(1);

    // 5. Desconcilia o extra
    await http
      .post(`/extras/${extraId}/desconciliar`)
      .set(auth(tokenCoord))
      .expect(200);

    const detalheAposDesconciliar = await http
      .get(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .expect(200);
    expect(detalheAposDesconciliar.body.statusVinculo).toBe('sem_escala');

    const vinculosAposDesconciliar = await mongo
      .db('nurseflow_extras')
      .collection('profissionaisRelacionados')
      .countDocuments({ extraProgramadoId: new Types.ObjectId(extraId) });
    expect(vinculosAposDesconciliar).toBe(0);

    // 6. Concilia novamente
    await http
      .post(`/extras/${extraId}/conciliar`)
      .set(auth(tokenCoord))
      .send({ escalaId })
      .expect(200);

    // 7. Simula publicação da escala e valida proteção contra alteração/cancelamento direto
    await mongo
      .db('nurseflow_extras')
      .collection('escalas')
      .updateOne({ _id: new Types.ObjectId(escalaId) }, { $set: { status: 'publicada' } });

    const extraParaCancelar = await http
      .get(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .expect(200);

    // Tentar cancelar extra vinculado a escala publicada é bloqueado com 409
    await http
      .post(`/extras/${extraId}/cancelar`)
      .set(auth(tokenCoord))
      .send({
        justificativa: 'Tentando cancelar com escala publicada',
        revisaoEsperada: extraParaCancelar.body.revisao,
      })
      .expect(409);

    // Tentar editar extra vinculado a escala publicada é bloqueado com 409
    await http
      .patch(`/extras/${extraId}`)
      .set(auth(tokenCoord))
      .send({
        observacao: 'Tentando editar com escala publicada',
        revisaoEsperada: extraParaCancelar.body.revisao,
      })
      .expect(409);
  });
});
