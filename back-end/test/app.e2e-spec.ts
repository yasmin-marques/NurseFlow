import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { SenhaNotifier } from '../src/auth/senha-notifier';
import { PlantoesFuturosChecker } from '../src/profissionais/plantoes-futuros.checker';
import { Profissional } from '../src/profissionais/schemas/profissional.schema';
import { TipoUsuario, Usuario } from '../src/usuarios/schemas/usuario.schema';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from './helpers';

const SENHA_COORDENACAO = 'senha-da-coordenacao';
const SENHA_PROFISSIONAL = 'senha-do-profissional';

describe('NurseFlow API (e2e)', () => {
  let banco: BancoDeTeste;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let tokenCoordenacao: string;
  let tokenEnfermeiro: string;
  let tokensRecuperacao: Record<string, string>;
  let plantoesFuturos: { plantaoId: string; data: Date; setor: string }[];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = (email: string, senha: string, perfil?: string) =>
    request(app.getHttpServer()).post('/auth/login').send({ email, senha, perfil });

  const novoProfissional = (sobrescrever: Record<string, unknown> = {}) => ({
    nome: 'Ana Clara Souza',
    cpf: '529.982.247-25',
    email: 'ana.souza@nurseflow.com',
    coren: 'COREN-CE 123456',
    formacao: 'enfermeiro',
    tipoVinculo: 'clt',
    senha: SENHA_PROFISSIONAL,
    ...sobrescrever,
  });

  beforeAll(async () => {
    banco = await iniciarBanco();
    await aplicarMigrations(banco.uri);

    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';
    process.env.LOGIN_MAX_ATTEMPTS = '3';
    process.env.LOGIN_LOCK_MINUTES = '15';
    tokensRecuperacao = {};
    plantoesFuturos = [];

    // Import dinâmico: o ConfigModule lê o ambiente quando app.module é carregado.
    const { AppModule } = await import('../src/app.module');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SenhaNotifier)
      .useValue({
        enviarTokenRedefinicao: (email: string, token: string) => {
          tokensRecuperacao[email] = token;
          return Promise.resolve();
        },
      })
      .overrideProvider(PlantoesFuturosChecker)
      .useValue({ buscarPublicadosFuturos: () => Promise.resolve(plantoesFuturos) })
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    http = request(app.getHttpServer());

    // Primeira conta de Coordenação (em produção: npm run seed:coordenacao).
    const usuarios = app.get(UsuariosService);
    const coordenacao = await usuarios.criar({
      nome: 'Coordenação',
      email: 'coordenacao@nurseflow.com',
      cpf: '11144477735',
      senha: await AuthService.gerarHashSenha(SENHA_COORDENACAO),
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
    });
    await usuarios.criarAdministrador(coordenacao._id);

    tokenCoordenacao = (await login('coordenacao@nurseflow.com', SENHA_COORDENACAO, 'coordenação')).body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
    await banco?.parar();
  });

  describe('Autenticação (DA01)', () => {
    it('autentica a Coordenação e devolve JWT sem expor senha/hash', async () => {
      const res = await login('coordenacao@nurseflow.com', SENHA_COORDENACAO, 'coordenacao').expect(200);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        usuario: { email: 'coordenacao@nurseflow.com', perfil: 'coordenacao' },
      });
      expect(typeof res.body.accessToken).toBe('string');
      expect(JSON.stringify(res.body)).not.toMatch(/senha|hash/i);
    });

    it('aceita a grafia com acento enviada pelo front ("coordenação")', async () => {
      await login('coordenacao@nurseflow.com', SENHA_COORDENACAO, 'coordenação').expect(200);
    });

    it('infere o perfil quando ele é omitido', async () => {
      const res = await login('coordenacao@nurseflow.com', SENHA_COORDENACAO).expect(200);
      expect(res.body.usuario.perfil).toBe('coordenacao');
    });

    it('rejeita senha incorreta e e-mail inexistente com a mesma mensagem genérica', async () => {
      const senhaErrada = await login('coordenacao@nurseflow.com', 'errada-errada').expect(401);
      const emailInexistente = await login('ninguem@nurseflow.com', 'qualquer-senha').expect(401);
      expect(senhaErrada.body.message).toBe(emailInexistente.body.message);
    });

    it('rejeita perfil diferente do da conta', async () => {
      await login('coordenacao@nurseflow.com', SENHA_COORDENACAO, 'enfermeiro').expect(401);
    });

    it('valida o corpo da requisição', async () => {
      const res = await http.post('/auth/login').send({ email: 'nao-e-email', perfil: 'diretor' }).expect(400);
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('exige token nas rotas protegidas e rejeita token inválido', async () => {
      await http.get('/profissionais').expect(401);
      await http.get('/profissionais').set(auth('token-invalido')).expect(401);
    });

    it('retorna os dados da sessão em /auth/me', async () => {
      const res = await http.get('/auth/me').set(auth(tokenCoordenacao)).expect(200);
      expect(res.body).toMatchObject({ email: 'coordenacao@nurseflow.com', perfil: 'coordenacao' });
    });

    it('bloqueia temporariamente após tentativas sucessivas inválidas (inclusive com a senha correta)', async () => {
      await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional({
        nome: 'Bloqueio Teste', cpf: '39053344705', email: 'bloqueio@nurseflow.com', coren: 'COREN-CE 900001',
      })).expect(201);

      for (let i = 0; i < 3; i++) await login('bloqueio@nurseflow.com', 'senha-errada-1').expect(401);
      const bloqueado = await login('bloqueio@nurseflow.com', SENHA_PROFISSIONAL).expect(429);
      expect(bloqueado.body.message).toMatch(/bloqueado/i);
    });

    it('recupera a senha com token de uso único e não revela se o e-mail existe', async () => {
      const existente = await http.post('/auth/recuperar-senha').send({ email: 'coordenacao@nurseflow.com' }).expect(202);
      const inexistente = await http.post('/auth/recuperar-senha').send({ email: 'ninguem@nurseflow.com' }).expect(202);
      expect(existente.body).toEqual(inexistente.body);
      expect(tokensRecuperacao['ninguem@nurseflow.com']).toBeUndefined();

      const token = tokensRecuperacao['coordenacao@nurseflow.com'];
      await http.post('/auth/redefinir-senha').send({ token, novaSenha: 'curta' }).expect(400);
      await http.post('/auth/redefinir-senha').send({ token, novaSenha: SENHA_COORDENACAO }).expect(200);
      await http.post('/auth/redefinir-senha').send({ token, novaSenha: SENHA_COORDENACAO }).expect(400);
      await http.post('/auth/redefinir-senha').send({ token: 'inventado', novaSenha: SENHA_COORDENACAO }).expect(400);
    });
  });

  describe('Profissionais (DA02, DA03, DA04)', () => {
    let anaId: string;

    it('cadastra profissional, normaliza dados e não expõe senha/hash', async () => {
      const res = await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional()).expect(201);
      anaId = res.body.id;
      expect(res.body).toMatchObject({
        nome: 'Ana Clara Souza',
        cpf: '529.982.247-25',
        coren: 'COREN-CE 123456',
        formacao: 'enfermeiro',
        tipoVinculo: 'clt',
        status: 'ativo',
      });
      expect(JSON.stringify(res.body)).not.toMatch(/senha|hash/i);
    });

    it('o profissional cadastrado consegue autenticar com o perfil da sua formação', async () => {
      const res = await login('ana.souza@nurseflow.com', SENHA_PROFISSIONAL, 'enfermeiro').expect(200);
      tokenEnfermeiro = res.body.accessToken;
      expect(res.body.usuario.perfil).toBe('enfermeiro');
      await login('ana.souza@nurseflow.com', SENHA_PROFISSIONAL, 'tecnico').expect(401);
    });

    it('cria técnico sem senha (senha temporária definida via recuperação de senha)', async () => {
      await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional({
        nome: 'Rafael Martins Lima', cpf: '86288366757', email: 'rafael.lima@nurseflow.com',
        coren: 'coren-ce  234567', formacao: 'tecnico', tipoVinculo: 'concursado', senha: undefined,
      })).expect(201).expect((res) => expect(res.body.coren).toBe('COREN-CE 234567'));

      await http.post('/auth/recuperar-senha').send({ email: 'rafael.lima@nurseflow.com' }).expect(202);
      const token = tokensRecuperacao['rafael.lima@nurseflow.com'];
      await http.post('/auth/redefinir-senha').send({ token, novaSenha: 'nova-senha-do-rafael' }).expect(200);
      const res = await login('rafael.lima@nurseflow.com', 'nova-senha-do-rafael', 'técnico').expect(200);
      expect(res.body.usuario.perfil).toBe('tecnico');
    });

    it('rejeita CPF inválido e campos obrigatórios ausentes', async () => {
      const res = await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional({ cpf: '123.456.789-00' })).expect(400);
      expect(res.body.details).toContain('CPF inválido');
      await http.post('/profissionais').set(auth(tokenCoordenacao)).send({ nome: 'Só nome' }).expect(400);
      await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional({ formacao: 'medico' })).expect(400);
      await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional({ campoInexistente: 1 })).expect(400);
    });

    it('detecta "Profissional já cadastrado" por CPF (com ou sem máscara) e por COREN', async () => {
      const porCpf = await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional({
        cpf: '52998224725', email: 'outro@nurseflow.com', coren: 'COREN-CE 777777',
      })).expect(409);
      expect(porCpf.body.message).toMatch(/Profissional já cadastrado.*CPF/);

      const porCoren = await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional({
        cpf: '12345678909', email: 'outro@nurseflow.com', coren: 'coren-ce 123456',
      })).expect(409);
      expect(porCoren.body.message).toMatch(/Profissional já cadastrado.*COREN/);

      await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional({
        cpf: '12345678909', coren: 'COREN-CE 888888',
      })).expect(409).expect((res) => expect(res.body.message).toMatch(/E-mail/));
    });

    it('lista, busca (nome sem acento, CPF e COREN), filtra e ordena', async () => {
      await http.post('/profissionais').set(auth(tokenCoordenacao)).send(novoProfissional({
        nome: 'João Pedro Almeida', cpf: '12345678909', email: 'joao@nurseflow.com', coren: 'COREN-CE 456789',
        formacao: 'tecnico', tipoVinculo: 'rpa',
      })).expect(201);

      const todos = await http.get('/profissionais').set(auth(tokenCoordenacao)).expect(200);
      expect(todos.body.meta.total).toBe(4);
      expect(todos.body.data.map((p: { nome: string }) => p.nome)).toEqual([
        'Ana Clara Souza', 'Bloqueio Teste', 'João Pedro Almeida', 'Rafael Martins Lima',
      ]);
      expect(JSON.stringify(todos.body)).not.toMatch(/senha|hash|redefinicao/i);

      const nomes = async (qs: string) =>
        (await http.get(`/profissionais?${qs}`).set(auth(tokenCoordenacao)).expect(200)).body.data.map((p: { nome: string }) => p.nome);

      expect(await nomes('busca=joao')).toEqual(['João Pedro Almeida']);
      expect(await nomes('busca=529.982')).toEqual(['Ana Clara Souza']);
      expect(await nomes('busca=coren-ce 234567')).toContain('Rafael Martins Lima');
      expect(await nomes('formacao=tecnico')).toEqual(['João Pedro Almeida', 'Rafael Martins Lima']);
      expect(await nomes('tipoVinculo=rpa')).toEqual(['João Pedro Almeida']);
      expect(await nomes('formacao=tecnico&ordem=desc')).toEqual(['Rafael Martins Lima', 'João Pedro Almeida']);
      expect(await nomes('busca=.*')).toEqual([]);

      const pagina = await http.get('/profissionais?limit=2&page=2').set(auth(tokenCoordenacao)).expect(200);
      expect(pagina.body.meta).toEqual({ total: 4, page: 2, limit: 2, totalPages: 2 });
      expect(pagina.body.data).toHaveLength(2);
      await http.get('/profissionais?limit=1000').set(auth(tokenCoordenacao)).expect(400);
    });

    it('consulta individual (404 e id inválido)', async () => {
      const res = await http.get(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).expect(200);
      expect(res.body.email).toBe('ana.souza@nurseflow.com');
      await http.get('/profissionais/64b7f0c2a1b2c3d4e5f60718').set(auth(tokenCoordenacao)).expect(404);
      await http.get('/profissionais/abc').set(auth(tokenCoordenacao)).expect(400);
    });

    it('edita parcialmente; mantém o próprio CPF/COREN sem conflito; rejeita os de outro profissional', async () => {
      const res = await http.patch(`/profissionais/${anaId}`).set(auth(tokenCoordenacao))
        .send({ nome: 'Ana Clara Souza Lima', cpf: '529.982.247-25', tipoVinculo: 'concursado' }).expect(200);
      expect(res.body).toMatchObject({ nome: 'Ana Clara Souza Lima', tipoVinculo: 'concursado', coren: 'COREN-CE 123456' });

      await http.patch(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).send({ cpf: '12345678909' }).expect(409);
      await http.patch(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).send({ coren: 'COREN-CE 456789' }).expect(409);
      await http.patch(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).send({ email: 'joao@nurseflow.com' }).expect(409);
      await http.patch(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).send({ cpf: '1' }).expect(400);
    });

    it('impede a desativação quando há plantões futuros publicados (DA04)', async () => {
      plantoesFuturos = [{ plantaoId: 'p1', data: new Date('2030-01-10'), setor: 'Emergência' }];
      const res = await http.patch(`/profissionais/${anaId}/desativar`).set(auth(tokenCoordenacao)).expect(409);
      expect(res.body.plantoes).toHaveLength(1);
      await http.patch(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).send({ status: 'desativado' }).expect(409);
      const ana = await http.get(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).expect(200);
      expect(ana.body.status).toBe('ativo');
      plantoesFuturos = [];
    });

    it('desativa logicamente: preserva o registro, bloqueia login/sessão e não existe DELETE', async () => {
      await http.get('/auth/me').set(auth(tokenEnfermeiro)).expect(200); // sessão válida antes
      const res = await http.patch(`/profissionais/${anaId}/desativar`).set(auth(tokenCoordenacao)).expect(200);
      expect(res.body.status).toBe('desativado');

      const preservado = await http.get(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).expect(200);
      expect(preservado.body.status).toBe('desativado');
      expect((await http.get('/profissionais?status=desativado').set(auth(tokenCoordenacao))).body.meta.total).toBe(1);
      // A listagem geral inclui ativos e desativados.
      const geral = (await http.get('/profissionais').set(auth(tokenCoordenacao)).expect(200)).body;
      expect(geral.data.map((p: { status: string }) => p.status)).toContain('desativado');
      expect(geral.data.map((p: { status: string }) => p.status)).toContain('ativo');

      await http.delete(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).expect(404);
      await login('ana.souza@nurseflow.com', SENHA_PROFISSIONAL).expect(403);
      await http.get('/auth/me').set(auth(tokenEnfermeiro)).expect(401);

      const reativado = await http.patch(`/profissionais/${anaId}`).set(auth(tokenCoordenacao)).send({ status: 'ativo' }).expect(200);
      expect(reativado.body.status).toBe('ativo');
      tokenEnfermeiro = (await login('ana.souza@nurseflow.com', SENHA_PROFISSIONAL).expect(200)).body.accessToken;
    });

    it('persiste CPF apenas com dígitos e nunca devolve o hash da senha', async () => {
      const usuarioModel = app.get<Model<Usuario>>(getModelToken(Usuario.name));
      const ana = await usuarioModel.findOne({ email: 'ana.souza@nurseflow.com' }).select('+senha').lean();
      expect(ana?.cpf).toBe('52998224725');
      expect(ana?.senha).toMatch(/^\$2[aby]\$/);
      expect(ana?.senha).not.toBe(SENHA_PROFISSIONAL);
      const profissionalModel = app.get<Model<Profissional>>(getModelToken(Profissional.name));
      expect(await profissionalModel.countDocuments()).toBe(4);
    });
  });

  describe('Setores (DA07, DA08)', () => {
    let setorId: string;
    const novoSetor = (sobrescrever: Record<string, unknown> = {}) => ({
      nome: 'Emergência',
      descricao: 'Atendimento imediato e classificação de risco',
      turnos: { diurno: { enfermeiros: 2, tecnicos: 3 }, noturno: { enfermeiros: 1, tecnicos: 2 } },
      ...sobrescrever,
    });

    it('cadastra setor com quantitativo distinto por turno', async () => {
      const res = await http.post('/setores').set(auth(tokenCoordenacao)).send(novoSetor()).expect(201);
      setorId = res.body.id;
      expect(res.body).toMatchObject({
        nome: 'Emergência',
        ativo: true,
        turnos: { diurno: { enfermeiros: 2, tecnicos: 3 }, noturno: { enfermeiros: 1, tecnicos: 2 } },
      });
    });

    it('rejeita nome duplicado ignorando maiúsculas e acentos', async () => {
      await http.post('/setores').set(auth(tokenCoordenacao)).send(novoSetor()).expect(409);
      await http.post('/setores').set(auth(tokenCoordenacao)).send(novoSetor({ nome: '  emergencia ' })).expect(409);
    });

    it('valida quantitativos e campos obrigatórios', async () => {
      const negativo = novoSetor({ turnos: { diurno: { enfermeiros: -1, tecnicos: 3 }, noturno: { enfermeiros: 1, tecnicos: 2 } } });
      await http.post('/setores').set(auth(tokenCoordenacao)).send(negativo).expect(400);
      await http.post('/setores').set(auth(tokenCoordenacao)).send(novoSetor({ turnos: { diurno: { enfermeiros: 1, tecnicos: 1 } } })).expect(400);
      await http.post('/setores').set(auth(tokenCoordenacao)).send(novoSetor({ nome: 'X', turnos: undefined })).expect(400);
      const fracionado = novoSetor({ nome: 'UTI', turnos: { diurno: { enfermeiros: 1.5, tecnicos: 1 }, noturno: { enfermeiros: 1, tecnicos: 1 } } });
      await http.post('/setores').set(auth(tokenCoordenacao)).send(fracionado).expect(400);
    });

    it('edita apenas um turno/função sem alterar os demais (DA08)', async () => {
      const res = await http.patch(`/setores/${setorId}`).set(auth(tokenCoordenacao))
        .send({ turnos: { noturno: { tecnicos: 4 } } }).expect(200);
      expect(res.body.turnos).toEqual({ diurno: { enfermeiros: 2, tecnicos: 3 }, noturno: { enfermeiros: 1, tecnicos: 4 } });
    });

    it('edita nome/descrição e impede renomear para um nome já existente', async () => {
      await http.post('/setores').set(auth(tokenCoordenacao)).send(novoSetor({ nome: 'Bloco A', descricao: 'Assistência clínica' })).expect(201);
      await http.patch(`/setores/${setorId}`).set(auth(tokenCoordenacao)).send({ nome: 'bloco a' }).expect(409);
      const res = await http.patch(`/setores/${setorId}`).set(auth(tokenCoordenacao))
        .send({ nome: 'Emergência', descricao: 'Pronto atendimento' }).expect(200);
      expect(res.body).toMatchObject({ nome: 'Emergência', descricao: 'Pronto atendimento' });
    });

    it('lista, busca, consulta, inativa e reativa sem excluir', async () => {
      const lista = await http.get('/setores').set(auth(tokenCoordenacao)).expect(200);
      expect(lista.body.map((s: { nome: string }) => s.nome)).toEqual(['Bloco A', 'Emergência']);
      expect((await http.get('/setores?busca=emergencia').set(auth(tokenCoordenacao))).body).toHaveLength(1);
      await http.get(`/setores/${setorId}`).set(auth(tokenCoordenacao)).expect(200);
      await http.get('/setores/64b7f0c2a1b2c3d4e5f60718').set(auth(tokenCoordenacao)).expect(404);

      const inativo = await http.patch(`/setores/${setorId}/inativar`).set(auth(tokenCoordenacao)).expect(200);
      expect(inativo.body.ativo).toBe(false);
      expect((await http.get('/setores?ativo=false').set(auth(tokenCoordenacao))).body).toHaveLength(1);
      expect((await http.get('/setores?ativo=true').set(auth(tokenCoordenacao))).body).toHaveLength(1);
      await http.get('/setores?ativo=talvez').set(auth(tokenCoordenacao)).expect(400);

      const ativo = await http.patch(`/setores/${setorId}/ativar`).set(auth(tokenCoordenacao)).expect(200);
      expect(ativo.body.ativo).toBe(true);
    });
  });

  describe('Autorização por perfil', () => {
    it('Enfermeiro não acessa operações administrativas de Profissionais', async () => {
      await http.get('/profissionais').set(auth(tokenEnfermeiro)).expect(403);
      await http.post('/profissionais').set(auth(tokenEnfermeiro)).send(novoProfissional()).expect(403);
      await http.patch('/profissionais/64b7f0c2a1b2c3d4e5f60718').set(auth(tokenEnfermeiro)).send({}).expect(403);
      await http.patch('/profissionais/64b7f0c2a1b2c3d4e5f60718/desativar').set(auth(tokenEnfermeiro)).expect(403);
    });

    it('Enfermeiro não acessa nenhuma operação de Setores', async () => {
      const lista = await http.get('/setores').set(auth(tokenCoordenacao)).expect(200);
      const id = lista.body[0].id;
      await http.get('/setores').set(auth(tokenEnfermeiro)).expect(403);
      await http.get(`/setores/${id}`).set(auth(tokenEnfermeiro)).expect(403);
      await http.post('/setores').set(auth(tokenEnfermeiro)).send({}).expect(403);
      await http.patch(`/setores/${id}`).set(auth(tokenEnfermeiro)).send({ nome: 'Hackeado' }).expect(403);
      await http.patch(`/setores/${id}/inativar`).set(auth(tokenEnfermeiro)).expect(403);
      await http.patch(`/setores/${id}/ativar`).set(auth(tokenEnfermeiro)).expect(403);
    });

    it('Técnico tem o mesmo acesso restrito', async () => {
      const token = (await login('rafael.lima@nurseflow.com', 'nova-senha-do-rafael').expect(200)).body.accessToken;
      await http.get('/profissionais').set(auth(token)).expect(403);
      await http.get('/setores').set(auth(token)).expect(403);
      await http.post('/setores').set(auth(token)).send({}).expect(403);
    });
  });
});
