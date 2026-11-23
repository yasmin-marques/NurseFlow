import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { TipoUsuario } from '../src/usuarios/schemas/usuario.schema';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { aplicarMigrations, criarSolicitacaoAceitaFixture, type BancoDeTeste, iniciarBanco } from './helpers';
import {
  ESCOPO_GOOGLE_EVENTOS,
  GoogleCalendarClient,
  GoogleReconexaoNecessariaError,
  GoogleTemporarioError,
  type TrocaDeCodigo,
} from '../src/google-agenda/google-calendar.client';
import type { EventoGoogle } from '../src/google-agenda/plantao-evento';
import type { GoogleAgendaSincronizacaoService } from '../src/google-agenda/google-agenda-sincronizacao.service';

const SENHA = 'senha-de-teste-123';
const FRONTEND = 'http://frontend.teste';

/** API do Google em memória: um "calendário" por refresh token, com falhas injetáveis. */
class GoogleFake extends GoogleCalendarClient {
  calendarios = new Map<string, Map<string, EventoGoogle>>();
  chamadas: { op: 'gravar' | 'remover'; refreshToken: string; eventId: string }[] = [];
  revogados: string[] = [];
  indisponivel = false;
  falharEvento: string | null = null;
  reconexaoPara: string | null = null;
  atraso = 0;

  calendario(refreshToken: string) {
    if (!this.calendarios.has(refreshToken)) this.calendarios.set(refreshToken, new Map());
    return this.calendarios.get(refreshToken)!;
  }
  urlAutorizacao(state: string) {
    return `https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=${encodeURIComponent(ESCOPO_GOOGLE_EVENTOS)}&state=${state}`;
  }
  async trocarCodigo(codigo: string): Promise<TrocaDeCodigo> {
    if (codigo === 'sem-escopo') return { refreshToken: 'rt-sem-escopo', escopo: 'openid' };
    return { refreshToken: `rt-${codigo}`, escopo: ESCOPO_GOOGLE_EVENTOS };
  }
  async renovarAcesso(refreshToken: string) {
    if (this.reconexaoPara === refreshToken) throw new GoogleReconexaoNecessariaError();
    if (this.indisponivel) throw new GoogleTemporarioError('Google fora do ar.');
    return `at:${refreshToken}`;
  }
  async revogar(token: string) {
    this.revogados.push(token);
  }
  async gravarEvento(accessToken: string, _calendarId: string, eventId: string, evento: EventoGoogle) {
    const refreshToken = accessToken.slice(3);
    if (this.atraso) await new Promise((resolver) => setTimeout(resolver, this.atraso));
    this.chamadas.push({ op: 'gravar', refreshToken, eventId });
    if (this.indisponivel || this.falharEvento === eventId) throw new GoogleTemporarioError('Google indisponível.');
    const calendario = this.calendario(refreshToken);
    const existia = calendario.has(eventId);
    calendario.set(eventId, evento);
    return existia ? ('atualizado' as const) : ('criado' as const);
  }
  async removerEvento(accessToken: string, _calendarId: string, eventId: string) {
    const refreshToken = accessToken.slice(3);
    this.chamadas.push({ op: 'remover', refreshToken, eventId });
    if (this.indisponivel) throw new GoogleTemporarioError('Google indisponível.');
    this.calendario(refreshToken).delete(eventId);
  }
}

describe('Integração com o Google Agenda (e2e, API do Google simulada)', () => {
  let banco: BancoDeTeste;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let mongo: mongoose.mongo.MongoClient;
  let db: mongoose.mongo.Db;
  let sinc: GoogleAgendaSincronizacaoService;
  const google = new GoogleFake();

  let tokenCoord: string;
  let tokenA: string; // enfermeiro
  let tokenB: string; // técnico
  let tokenC: string; // enfermeiro
  let tokenD: string; // enfermeiro que nunca conecta
  let setorId: mongoose.Types.ObjectId;
  let pro: Record<'A' | 'B' | 'C' | 'D', mongoose.Types.ObjectId>;
  let administradorId: mongoose.Types.ObjectId;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (email: string, perfil?: string) =>
    (await http.post('/auth/login').send({ email, senha: SENHA, perfil }).expect(200)).body.accessToken as string;

  // Mês seguinte (fixtures diretas) e dois meses à frente (fluxo real de publicação): sempre no futuro.
  const agora = new Date();
  const mesFixture = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
  const mesFluxo = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 2, 1));
  const periodo = (d: Date) => ({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 });
  const dia = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), n));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const idEvento = async (profissionalId: mongoose.Types.ObjectId, plantaoId: mongoose.Types.ObjectId) =>
    (await import('../src/google-agenda/plantao-evento')).idEventoGoogle(String(profissionalId), String(plantaoId));

  let escalaFixture: mongoose.Types.ObjectId;
  const P = { p1: new mongoose.Types.ObjectId(), p2: new mongoose.Types.ObjectId(), p3: new mongoose.Types.ObjectId(), p4: new mongoose.Types.ObjectId() };
  const V = { v1: new mongoose.Types.ObjectId(), v2: new mongoose.Types.ObjectId(), v3: new mongoose.Types.ObjectId(), v4: new mongoose.Types.ObjectId() };

  const plantaoDoc = (id: mongoose.Types.ObjectId, data: Date, horarioInicio: string, horarioFim: string, duracaoHoras: number) => ({
    _id: id, escalaId: escalaFixture, setorId, data, horarioInicio, horarioFim, duracaoHoras, tipo: 'regular',
  });
  const vinculoDoc = (id: mongoose.Types.ObjectId, plantaoId: mongoose.Types.ObjectId, profissionalId: mongoose.Types.ObjectId, funcao: string, lideranca = false) => ({
    _id: id, plantaoId, profissionalId, funcao, lideranca, origemCobertura: 'regular',
  });

  const pendentes = (profissionalId?: mongoose.Types.ObjectId) =>
    db.collection('tarefasGoogleAgenda').countDocuments({ status: 'pendente', ...(profissionalId ? { profissionalId } : {}) });
  const conectar = async (token: string, codigo: string) => {
    const { url } = (await http.post('/integracoes/google-agenda/conectar').set(auth(token)).expect(200)).body as { url: string };
    const state = new URL(url).searchParams.get('state')!;
    return http.get(`/integracoes/google-agenda/callback?code=${codigo}&state=${state}`);
  };
  const liberarTarefas = () =>
    db.collection('tarefasGoogleAgenda').updateMany({ status: 'pendente' }, { $set: { proximaTentativaEm: new Date(Date.now() - 1000) } });

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_google_agenda');
    await aplicarMigrations(banco.uri);
    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';
    process.env.GOOGLE_CLIENT_ID = 'cliente.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'segredo-do-cliente';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/integracoes/google-agenda/callback';
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.FRONTEND_URL = FRONTEND;
    const { AppModule } = await import('../src/app.module');
    const { GoogleAgendaSincronizacaoService: Sinc } = await import('../src/google-agenda/google-agenda-sincronizacao.service');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleCalendarClient)
      .useValue(google)
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    sinc = app.get(Sinc);
    http = request(app.getHttpServer());
    mongo = new mongoose.mongo.MongoClient(banco.uri);
    db = mongo.db();

    const usuarios = app.get(UsuariosService);
    const coord = await usuarios.criar({ nome: 'Coordenação', email: 'coord-gagenda@nurseflow.com', cpf: '11144477735', senha: await AuthService.gerarHashSenha(SENHA), tipoUsuario: TipoUsuario.ADMINISTRADOR });
    await usuarios.criarAdministrador(coord._id);
    tokenCoord = await login('coord-gagenda@nurseflow.com', 'coordenacao');
    const setor = await http.post('/setores').set(auth(tokenCoord)).send({ nome: 'UTI Agenda', plantao24h: { enfermeiros: 1, tecnicos: 1 } }).expect(201);
    setorId = new mongoose.Types.ObjectId(setor.body.id);
    const criar = async (nome: string, cpf: string, coren: string, formacao: string, email: string) =>
      new mongoose.Types.ObjectId(
        (await http.post('/profissionais').set(auth(tokenCoord)).send({ nome, cpf, coren, formacao, tipoVinculo: 'clt', email, senha: SENHA, setorId: setor.body.id }).expect(201)).body.id,
      );
    pro = {
      A: await criar('Ana Souza', '529.982.247-25', 'COREN-CE 810001', 'enfermeiro', 'ana-agenda@nurseflow.com'),
      B: await criar('Bruno Lima', '390.533.447-05', 'COREN-CE 810002', 'tecnico', 'bruno-agenda@nurseflow.com'),
      C: await criar('Carla Dias', '123.456.780-62', 'COREN-CE 810003', 'enfermeiro', 'carla-agenda@nurseflow.com'),
      D: await criar('Daniel Reis', '234.567.890-92', 'COREN-CE 810004', 'enfermeiro', 'daniel-agenda@nurseflow.com'),
    };
    tokenA = await login('ana-agenda@nurseflow.com');
    tokenB = await login('bruno-agenda@nurseflow.com');
    tokenC = await login('carla-agenda@nurseflow.com');
    tokenD = await login('daniel-agenda@nurseflow.com');
    administradorId = (await db.collection('administradores').findOne({ usuarioId: new mongoose.Types.ObjectId(coord.id) }))!._id as mongoose.Types.ObjectId;

    // Escala oficial (fixture direta, versão 1) no mês seguinte.
    escalaFixture = new mongoose.Types.ObjectId();
    const { ano, mes } = periodo(mesFixture);
    const plantoes = [
      plantaoDoc(P.p1, dia(mesFixture, 5), '07:00', '19:00', 12),
      plantaoDoc(P.p2, dia(mesFixture, 6), '19:00', '07:00', 12), // atravessa a meia-noite
      plantaoDoc(P.p3, dia(mesFixture, 10), '07:00', '07:00', 24),
      plantaoDoc(P.p4, dia(mesFixture, 12), '07:00', '19:00', 12),
    ];
    const vinculos = [
      vinculoDoc(V.v1, P.p1, pro.A, 'enfermeiro', true),
      vinculoDoc(V.v2, P.p2, pro.A, 'enfermeiro'),
      vinculoDoc(V.v3, P.p3, pro.B, 'tecnico'),
      vinculoDoc(V.v4, P.p4, pro.C, 'enfermeiro', true),
    ];
    await db.collection('escalas').insertOne({ _id: escalaFixture, administradorId, mes, ano, status: 'publicada', revisao: 1, versaoPublicada: 1, dataCriacao: new Date(), geracao: {} });
    await db.collection('plantoes').insertMany(plantoes);
    await db.collection('profissionaisRelacionados').insertMany(vinculos);
    await db.collection('versoesEscala').insertOne({
      escalaId: escalaFixture, numero: 1, mes, ano, publicadoPor: administradorId, publicadoEm: new Date(), pendenciasConfirmadas: false,
      snapshot: { escala: { _id: escalaFixture, mes, ano, status: 'publicada', revisao: 1, versaoPublicada: 1, geracao: {} }, plantoes, profissionaisRelacionados: vinculos, pendencias: [], conflitos: [], avisos: [], cargas: [] },
    });
    await http.get(`/configuracoes?ano=${ano}&mes=${mes}`).set(auth(tokenCoord)).expect(200);
  });

  afterAll(async () => {
    await mongo?.close();
    await app?.close();
    await banco?.parar();
  });

  it('bloqueia anônimo e Coordenação; Enfermeiro e Técnico acessam apenas o próprio estado', async () => {
    await http.get('/integracoes/google-agenda').expect(401);
    for (const [metodo, rota] of [['get', ''], ['post', '/conectar'], ['post', '/sincronizar'], ['post', '/desativar']] as const) {
      await http[metodo](`/integracoes/google-agenda${rota}`).set(auth(tokenCoord)).expect(403);
    }
    for (const token of [tokenA, tokenB]) {
      const estado = await http.get('/integracoes/google-agenda').set(auth(token)).expect(200);
      expect(estado.body).toMatchObject({ configurada: true, estado: 'nao_conectada', pendentes: 0, reconexaoNecessaria: false });
    }
    await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenA)).expect(409);
  });

  it('OAuth: state de uso único e vinculado ao profissional, escopo exigido e credenciais protegidas', async () => {
    const inicio = await http.post('/integracoes/google-agenda/conectar').set(auth(tokenA)).expect(200);
    const url = new URL(inicio.body.url as string);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('scope')).toBe(ESCOPO_GOOGLE_EVENTOS);
    const state = url.searchParams.get('state')!;
    const estadoSalvo = await db.collection('estadosOauthGoogle').findOne({ profissionalId: pro.A });
    expect(estadoSalvo?.stateHash).not.toBe(state); // somente o hash é guardado

    // state adulterado, inexistente ou expirado
    const invalido = await http.get('/integracoes/google-agenda/callback?code=x&state=inventado').expect(302);
    expect(invalido.headers.location).toBe(`${FRONTEND}/?google_agenda=estado_invalido`);
    await http.get('/integracoes/google-agenda/callback?code=x').expect(302);
    await db.collection('estadosOauthGoogle').updateOne({ _id: estadoSalvo!._id }, { $set: { expiraEm: new Date(Date.now() - 1000) } });
    expect((await http.get(`/integracoes/google-agenda/callback?code=codeA&state=${state}`).expect(302)).headers.location).toContain('estado_invalido');
    expect(await db.collection('integracoesGoogleAgenda').countDocuments()).toBe(0);

    // consentimento negado e escopo insuficiente
    const negado = await http.post('/integracoes/google-agenda/conectar').set(auth(tokenA)).expect(200);
    expect((await http.get(`/integracoes/google-agenda/callback?error=access_denied&state=${new URL(negado.body.url).searchParams.get('state')}`).expect(302)).headers.location).toContain('negada');
    expect((await conectar(tokenA, 'sem-escopo')).headers.location).toContain('permissao_insuficiente');
    expect(await db.collection('integracoesGoogleAgenda').countDocuments()).toBe(0);

    // sucesso, e o mesmo state não pode ser reutilizado
    const ok = await http.post('/integracoes/google-agenda/conectar').set(auth(tokenA)).expect(200);
    const stateOk = new URL(ok.body.url).searchParams.get('state')!;
    const sucesso = await http.get(`/integracoes/google-agenda/callback?code=codeA&state=${stateOk}`).expect(302);
    expect(sucesso.headers.location).toBe(`${FRONTEND}/?google_agenda=conectada`);
    expect((await http.get(`/integracoes/google-agenda/callback?code=outro&state=${stateOk}`).expect(302)).headers.location).toContain('estado_invalido');

    const integracao = await db.collection('integracoesGoogleAgenda').findOne({ profissionalId: pro.A });
    expect(integracao).toMatchObject({ status: 'conectada', escopo: ESCOPO_GOOGLE_EVENTOS });
    expect(integracao!.refreshTokenCifrado).toMatch(/^v1\./);
    expect(JSON.stringify(integracao)).not.toContain('rt-codeA');
    expect((await db.collection('profissionaisDaSaude').findOne({ _id: pro.A }))!.sincronizaAgenda).toBe(true);

    const estado = await http.get('/integracoes/google-agenda').set(auth(tokenA)).expect(200);
    expect(estado.body).toMatchObject({ estado: 'conectada', pendentes: 1 });
    expect(JSON.stringify(estado.body)).not.toMatch(/rt-|refreshToken|v1\./);
    // Cada profissional tem a própria conexão.
    expect((await http.get('/integracoes/google-agenda').set(auth(tokenB)).expect(200)).body.estado).toBe('nao_conectada');

    expect((await conectar(tokenB, 'codeB')).headers.location).toContain('conectada');
    expect((await conectar(tokenC, 'codeC')).headers.location).toContain('conectada');
  });

  it('processa a fila da conexão: horários oficiais, noite que atravessa a meia-noite e só dados próprios', async () => {
    expect(await sinc.processarPendentes()).toBe(3);
    const calA = google.calendario('rt-codeA');
    expect(calA.size).toBe(2);
    const e1 = calA.get(await idEvento(pro.A, P.p1))!;
    expect(e1.start).toEqual({ dateTime: `${iso(dia(mesFixture, 5))}T07:00:00-03:00`, timeZone: 'America/Fortaleza' });
    expect(e1.end.dateTime).toBe(`${iso(dia(mesFixture, 5))}T19:00:00-03:00`);
    expect(e1.summary).toBe('Plantão — UTI Agenda');
    const e2 = calA.get(await idEvento(pro.A, P.p2))!;
    expect(e2.start.dateTime).toBe(`${iso(dia(mesFixture, 6))}T19:00:00-03:00`);
    expect(e2.end.dateTime).toBe(`${iso(dia(mesFixture, 7))}T07:00:00-03:00`);
    const e3 = google.calendario('rt-codeB').get(await idEvento(pro.B, P.p3))!;
    expect(e3.end.dateTime).toBe(`${iso(dia(mesFixture, 11))}T07:00:00-03:00`);
    expect(e3.description).toContain('Função: Técnico');

    // Nada de colegas nem de outro profissional nas agendas.
    expect(JSON.stringify([...calA.values()])).not.toMatch(/Bruno|Carla|Daniel/);
    expect(google.calendario('rt-codeC').size).toBe(1);
    expect(google.chamadas.every((c) => (c.refreshToken === 'rt-codeA' ? true : !JSON.stringify(calA).includes(c.eventId)))).toBe(true);
    expect(await db.collection('eventosGoogleAgenda').countDocuments({ profissionalId: pro.A, status: 'sincronizado' })).toBe(2);
    expect(await pendentes()).toBe(0);
  });

  it('sincronização manual: repetida ou em paralelo não cria duplicatas e ignora ids de outro profissional', async () => {
    const antes = google.chamadas.length;
    google.atraso = 20;
    const respostas = await Promise.all(
      [1, 2, 3].map(() => http.post(`/integracoes/google-agenda/sincronizar?profissionalId=${pro.B}`).set(auth(tokenA)).send({ profissionalId: String(pro.B) })),
    );
    google.atraso = 0;
    for (const resposta of respostas) {
      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({ resultado: 'sucesso', falhas: 0, criados: 0, atualizados: 0, estado: { estado: 'conectada' } });
    }
    expect(google.chamadas.length).toBe(antes); // tudo já estava sincronizado: nenhuma chamada nova
    expect(google.calendario('rt-codeA').size).toBe(2);
    expect(google.calendario('rt-codeB').size).toBe(1);

    // Reprocessar a mesma publicação (dados alterados a cada ciclo) continua idempotente por id fixo.
    await db.collection('eventosGoogleAgenda').updateMany({ profissionalId: pro.A }, { $set: { hashConteudo: '' } });
    const forcada = await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenA)).expect(200);
    expect(forcada.body).toMatchObject({ resultado: 'sucesso', atualizados: 2, criados: 0 });
    expect(google.calendario('rt-codeA').size).toBe(2);
    expect(await db.collection('eventosGoogleAgenda').countDocuments({ profissionalId: pro.A })).toBe(2);
  });

  it('falha parcial é informada sem mascarar o erro e o evento não é marcado como sincronizado', async () => {
    await db.collection('setores').updateOne({ _id: setorId }, { $set: { nome: 'UTI Agenda 2' } });
    google.falharEvento = await idEvento(pro.A, P.p2);
    const resposta = await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenA)).expect(200);
    google.falharEvento = null;
    expect(resposta.body).toMatchObject({ resultado: 'parcial', atualizados: 1, falhas: 1 });
    expect(resposta.body.mensagem).toMatch(/parcial/i);
    expect(resposta.body.estado.ultimoResultado.resultado).toBe('parcial');
    const pendente = await db.collection('eventosGoogleAgenda').findOne({ profissionalId: pro.A, plantaoId: P.p2 });
    const sincronizado = await db.collection('eventosGoogleAgenda').findOne({ profissionalId: pro.A, plantaoId: P.p1 });
    expect(pendente!.hashConteudo).not.toBe(sincronizado!.hashConteudo);
    expect(google.calendario('rt-codeA').get(await idEvento(pro.A, P.p2))!.summary).toBe('Plantão — UTI Agenda');
    // Nova tentativa conclui o que faltou.
    const completa = await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenA)).expect(200);
    expect(completa.body).toMatchObject({ resultado: 'sucesso', atualizados: 1, inalterados: 1 });
    expect(google.calendario('rt-codeA').get(await idEvento(pro.A, P.p2))!.summary).toBe('Plantão — UTI Agenda 2');
    await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenB)).expect(200);
    await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenC)).expect(200);
  });

  describe('publicação, alteração oficial e troca (fluxo real)', () => {
    let escalaId: string;
    let plantaoFluxo: string;
    const corpoPlantao = (revisaoEsperada: number, equipe: { profissionalId: string; funcao: string; lideranca?: boolean }[]) => ({
      revisaoEsperada, setorId: String(setorId), data: iso(dia(mesFluxo, 8)), opcao: '24h', tipo: 'regular', coberturaReconhecida: true, equipe,
    });

    it('a publicação não depende do Google: com o Google fora do ar ela conclui e a tarefa fica na fila', async () => {
      const { ano, mes } = periodo(mesFluxo);
      await http.get(`/configuracoes?ano=${ano}&mes=${mes}`).set(auth(tokenCoord)).expect(200);
      const rascunho = await http.post('/escalas').set(auth(tokenCoord)).send({ ano, mes }).expect(201);
      escalaId = rascunho.body.escala?.id ?? rascunho.body.id;
      const atual = (await http.get(`/escalas/${escalaId}`).set(auth(tokenCoord)).expect(200)).body.escala;
      const incluido = await http
        .post(`/escalas/${escalaId}/plantoes`)
        .set(auth(tokenCoord))
        .send(corpoPlantao(atual.revisao, [{ profissionalId: String(pro.A), funcao: 'enfermeiro', lideranca: true }, { profissionalId: String(pro.B), funcao: 'tecnico' }]))
        .expect(201);
      const emRevisao = await http.post(`/escalas/${escalaId}/revisao`).set(auth(tokenCoord)).send({ revisaoEsperada: incluido.body.escala.revisao }).expect(200);
      const validada = await http.post(`/escalas/${escalaId}/validar`).set(auth(tokenCoord)).send({ revisaoEsperada: emRevisao.body.escala.revisao }).expect(200);

      google.indisponivel = true;
      const rascunhoSemTarefas = await pendentes();
      expect(rascunhoSemTarefas).toBe(0); // rascunho, revisão e validação não enviam nada
      const publicada = await http.post(`/escalas/${escalaId}/publicar`).set(auth(tokenCoord)).send({ revisaoEsperada: validada.body.escala.revisao, confirmarPendencias: true }).expect(200);
      expect(publicada.body.escala).toMatchObject({ status: 'publicada', versaoPublicada: 1 });
      // Somente A e B têm integração ativa; D (sem conexão) e a Coordenação não geram tarefas.
      expect(await pendentes()).toBe(2);
      expect(await pendentes(pro.A)).toBe(1);
      expect(await pendentes(pro.B)).toBe(1);
      expect(await pendentes(pro.D)).toBe(0);
      plantaoFluxo = String((await db.collection('plantoes').findOne({ escalaId: new mongoose.Types.ObjectId(escalaId) }))!._id);

      // Google indisponível: tentativa falha, fica reagendada com backoff e nada é marcado como sincronizado.
      await sinc.processarPendentes();
      const tarefas = await db.collection('tarefasGoogleAgenda').find({ status: 'pendente' }).toArray();
      expect(tarefas).toHaveLength(2);
      for (const tarefa of tarefas) {
        expect(tarefa.tentativas).toBe(1);
        expect(tarefa.proximaTentativaEm.getTime()).toBeGreaterThan(Date.now());
        expect(tarefa.ultimoErro).toBeTruthy();
      }
      expect(await db.collection('eventosGoogleAgenda').countDocuments({ plantaoId: new mongoose.Types.ObjectId(plantaoFluxo) })).toBe(0);
      const manual = await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenA)).expect(200);
      expect(manual.body.resultado).toBe('falha');
      expect(manual.body.mensagem).toMatch(/não foi possível/i);

      // O Google volta: a fila conclui e o plantão de 24h aparece atravessando a meia-noite.
      google.indisponivel = false;
      await liberarTarefas();
      await sinc.processarPendentes();
      expect(await pendentes()).toBe(0);
      const eventoA = google.calendario('rt-codeA').get(await idEvento(pro.A, new mongoose.Types.ObjectId(plantaoFluxo)))!;
      expect(eventoA.start.dateTime).toBe(`${iso(dia(mesFluxo, 8))}T07:00:00-03:00`);
      expect(eventoA.end.dateTime).toBe(`${iso(dia(mesFluxo, 9))}T07:00:00-03:00`);
      expect(google.calendario('rt-codeA').size).toBe(3);
    });

    it('rascunho/revisão não publicada não é enviado; nova publicação remove só o evento do plantão perdido', async () => {
      const antes = google.chamadas.length;
      const atual = (await http.get(`/escalas/${escalaId}`).set(auth(tokenCoord)).expect(200)).body.escala;
      const revisao = await http.post(`/escalas/${escalaId}/revisao`).set(auth(tokenCoord)).send({ revisaoEsperada: atual.revisao }).expect(200);
      const editada = await http
        .patch(`/escalas/${escalaId}/plantoes/${plantaoFluxo}`)
        .set(auth(tokenCoord))
        .send(corpoPlantao(revisao.body.escala.revisao, [{ profissionalId: String(pro.C), funcao: 'enfermeiro', lideranca: true }, { profissionalId: String(pro.B), funcao: 'tecnico' }]))
        .expect(200);
      // Revisão aberta, ainda não publicada: sincronizar não pode refletir a edição.
      const semMudanca = await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenA)).expect(200);
      expect(semMudanca.body).toMatchObject({ resultado: 'sucesso', criados: 0, atualizados: 0, removidos: 0 });
      expect(google.chamadas.length).toBe(antes);
      expect(google.calendario('rt-codeA').size).toBe(3);

      // Evento pessoal do profissional na mesma agenda: jamais pode ser tocado.
      google.calendario('rt-codeA').set('evento-pessoal', { summary: 'Dentista' } as EventoGoogle);

      const validada = await http.post(`/escalas/${escalaId}/validar`).set(auth(tokenCoord)).send({ revisaoEsperada: editada.body.escala.revisao }).expect(200);
      await http.post(`/escalas/${escalaId}/publicar`).set(auth(tokenCoord)).send({ revisaoEsperada: validada.body.escala.revisao, confirmarPendencias: true }).expect(200);
      // Afetados: A (perdeu), B (continua), C (ganhou). D não conecta.
      expect(await pendentes(pro.A)).toBe(1);
      expect(await pendentes(pro.B)).toBe(1);
      expect(await pendentes(pro.C)).toBe(1);
      expect(await pendentes()).toBe(3);
      await sinc.processarPendentes();

      const idPerdido = await idEvento(pro.A, new mongoose.Types.ObjectId(plantaoFluxo));
      expect(google.calendario('rt-codeA').has(idPerdido)).toBe(false);
      expect(google.calendario('rt-codeA').has('evento-pessoal')).toBe(true);
      expect(google.calendario('rt-codeA').size).toBe(3); // 2 plantões do mês seguinte + evento pessoal
      const remocoes = google.chamadas.filter((c) => c.op === 'remover');
      expect(remocoes).toEqual([{ op: 'remover', refreshToken: 'rt-codeA', eventId: idPerdido }]);
      expect(google.calendario('rt-codeC').size).toBe(2);
      expect(google.calendario('rt-codeB').size).toBe(2);
      expect((await db.collection('eventosGoogleAgenda').findOne({ profissionalId: pro.A, plantaoId: new mongoose.Types.ObjectId(plantaoFluxo) }))!.status).toBe('removido');
    });

    it('troca aprovada: tarefas nascem na transação e os dois profissionais afetados são sincronizados', async () => {
      const troca = await criarSolicitacaoAceitaFixture(db, {
        ano: periodo(mesFixture).ano, mes: periodo(mesFixture).mes,
        solicitanteProfissionalId: pro.A, profissionalSolicitadoId: pro.C, vinculoSolicitanteId: V.v1, vinculoSolicitadoId: V.v4,
      });
      expect(await pendentes()).toBe(0);
      google.indisponivel = true; // a aprovação também independe do Google
      await http.post(`/trocas/${troca.id}/aprovar`).set(auth(tokenCoord)).send({ revisaoEsperada: 1, operacaoId: randomUUID() }).expect(200);
      expect(await pendentes()).toBe(2);
      expect(await pendentes(pro.A)).toBe(1);
      expect(await pendentes(pro.C)).toBe(1);
      expect(await pendentes(pro.B)).toBe(0);
      google.indisponivel = false;
      await liberarTarefas();
      await sinc.processarPendentes();
      expect(await pendentes()).toBe(0);

      expect(google.calendario('rt-codeA').has(await idEvento(pro.A, P.p1))).toBe(false);
      expect(google.calendario('rt-codeA').has(await idEvento(pro.A, P.p4))).toBe(true);
      expect(google.calendario('rt-codeC').has(await idEvento(pro.C, P.p4))).toBe(false);
      expect(google.calendario('rt-codeC').has(await idEvento(pro.C, P.p1))).toBe(true);
      expect(google.calendario('rt-codeA').size).toBe(3); // p2 + p4 + evento pessoal
    });

    it('troca pendente ou recusada não é enviada ao Google', async () => {
      const antes = google.chamadas.length;
      await criarSolicitacaoAceitaFixture(db, {
        ano: periodo(mesFixture).ano, mes: periodo(mesFixture).mes,
        solicitanteProfissionalId: pro.A, profissionalSolicitadoId: pro.C, vinculoSolicitanteId: V.v2, vinculoSolicitadoId: V.v1,
      });
      await sinc.processarPendentes();
      expect(await pendentes()).toBe(0);
      expect(google.chamadas.length).toBe(antes);
    });
  });

  it('uma tarefa antiga nunca sobrescreve um estado oficial mais recente', async () => {
    await sinc.enfileirar([pro.B], 'publicacao'); // tarefa criada com o estado v1…
    const { ano, mes } = periodo(mesFixture);
    const snapshotAtual = (await db.collection('versoesEscala').findOne({ escalaId: escalaFixture, numero: 1 }))!.snapshot;
    const plantoes = (snapshotAtual.plantoes as { _id: mongoose.Types.ObjectId }[]).map((p) => (p._id.equals(P.p3) ? { ...p, data: dia(mesFixture, 20), horarioInicio: '19:00', horarioFim: '07:00', duracaoHoras: 12 } : p));
    const vinculos = (snapshotAtual.profissionaisRelacionados as { _id: mongoose.Types.ObjectId }[]);
    // …e antes de executá-la, uma versão oficial posterior (v3) muda o plantão de B.
    await db.collection('versoesEscala').insertOne({
      escalaId: escalaFixture, numero: 3, mes, ano, publicadoPor: administradorId, publicadoEm: new Date(), pendenciasConfirmadas: false,
      snapshot: { ...snapshotAtual, plantoes, profissionaisRelacionados: vinculos },
    });
    await sinc.processarPendentes();
    const calB = google.calendario('rt-codeB');
    expect(calB.size).toBe(2); // plantão antigo de B some do mês (v3 vence); o mês de fluxo continua
    const novo = calB.get(await idEvento(pro.B, P.p3))!;
    expect(novo.start.dateTime).toBe(`${iso(dia(mesFixture, 20))}T19:00:00-03:00`);
    expect(novo.end.dateTime).toBe(`${iso(dia(mesFixture, 21))}T07:00:00-03:00`);
    // v2 inexistente é irrelevante: a última versão por número é a oficial.
    await db.collection('versoesEscala').deleteOne({ escalaId: escalaFixture, numero: 3 });
  });

  it('retentativas são limitadas: após 5 falhas a tarefa vira "falha" e para de ser processada', async () => {
    google.indisponivel = true;
    await db.collection('eventosGoogleAgenda').updateMany({ profissionalId: pro.B }, { $set: { hashConteudo: '' } });
    await sinc.enfileirar([pro.B], 'publicacao');
    for (let i = 0; i < 5; i++) {
      await liberarTarefas();
      await sinc.processarPendentes();
    }
    google.indisponivel = false;
    const tarefa = await db.collection('tarefasGoogleAgenda').findOne({ profissionalId: pro.B, status: 'falha' });
    expect(tarefa).toMatchObject({ tentativas: 5 });
    expect(await pendentes(pro.B)).toBe(0);
    expect(await sinc.processarPendentes()).toBe(0);
    const estado = await http.get('/integracoes/google-agenda').set(auth(tokenB)).expect(200);
    expect(estado.body.ultimoResultado.resultado).toBe('falha');
    expect(estado.body.estado).toBe('conectada'); // falha temporária não exige reconexão
    await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenB)).expect(200);
  });

  it('autorização revogada: pede reconexão, para a fila e a reconexão retoma sem duplicar', async () => {
    google.reconexaoPara = 'rt-codeC';
    await sinc.enfileirar([pro.C], 'publicacao');
    await sinc.processarPendentes();
    const estado = await http.get('/integracoes/google-agenda').set(auth(tokenC)).expect(200);
    expect(estado.body).toMatchObject({ estado: 'reconexao_necessaria', reconexaoNecessaria: true, pendentes: 0 });
    expect(estado.body.ultimoResultado.mensagem).toMatch(/reconecte/i);
    expect((await db.collection('integracoesGoogleAgenda').findOne({ profissionalId: pro.C }))!.refreshTokenCifrado).toBeNull();
    const manual = await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenC)).expect(409);
    expect(manual.body.message).toMatch(/reconecte/i);

    google.reconexaoPara = null;
    const tamanhoAntes = google.calendario('rt-codeC').size;
    expect((await conectar(tokenC, 'codeC2')).headers.location).toContain('conectada');
    await sinc.processarPendentes();
    expect((await http.get('/integracoes/google-agenda').set(auth(tokenC)).expect(200)).body.estado).toBe('conectada');
    // Nova conta/token => agenda nova recebe os eventos; nenhuma duplicata por id fixo.
    expect(google.calendario('rt-codeC2').size).toBe(tamanhoAntes);
    const ids = [...google.calendario('rt-codeC2').keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('desativar interrompe novos envios, descarta o token e preserva os eventos já exportados', async () => {
    const calA = new Map(google.calendario('rt-codeA'));
    const chamadasAntes = google.chamadas.length;
    const resposta = await http.post('/integracoes/google-agenda/desativar').set(auth(tokenA)).expect(200);
    expect(resposta.body.estado).toBe('desativada');
    expect(google.revogados).toContain('rt-codeA');
    const integracao = await db.collection('integracoesGoogleAgenda').findOne({ profissionalId: pro.A });
    expect(integracao).toMatchObject({ status: 'desativada', refreshTokenCifrado: null });
    expect((await db.collection('profissionaisDaSaude').findOne({ _id: pro.A }))!.sincronizaAgenda).toBe(false);
    // idempotente
    await http.post('/integracoes/google-agenda/desativar').set(auth(tokenA)).expect(200);

    // Nada novo é enfileirado nem enviado; os eventos já exportados permanecem.
    await sinc.enfileirar([pro.A, pro.B], 'publicacao');
    expect(await pendentes(pro.A)).toBe(0);
    expect(await pendentes(pro.B)).toBe(1);
    await sinc.processarPendentes();
    await http.post('/integracoes/google-agenda/sincronizar').set(auth(tokenA)).expect(409);
    expect(google.chamadas.slice(chamadasAntes).every((c) => c.refreshToken !== 'rt-codeA')).toBe(true);
    expect([...google.calendario('rt-codeA').keys()].sort()).toEqual([...calA.keys()].sort());

    // Reativar é uma nova conexão com novo consentimento.
    expect((await conectar(tokenA, 'codeA2')).headers.location).toContain('conectada');
    await sinc.processarPendentes();
    expect(google.calendario('rt-codeA2').size).toBeGreaterThan(0);
  });

  it('profissional sem conexão (D) e Coordenação seguem o fluxo normal sem Google', async () => {
    expect((await http.get('/integracoes/google-agenda').set(auth(tokenD)).expect(200)).body.estado).toBe('nao_conectada');
    await http.post('/integracoes/google-agenda/desativar').set(auth(tokenD)).expect(200);
    expect(await db.collection('integracoesGoogleAgenda').countDocuments({ profissionalId: pro.D })).toBe(0);
    await http.get('/escalas?ano=2000').set(auth(tokenCoord)).expect((res) => expect(res.status).toBeLessThan(500));
  });
});
