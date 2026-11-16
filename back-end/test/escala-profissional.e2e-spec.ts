import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import mongoose from 'mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { TipoUsuario } from '../src/usuarios/schemas/usuario.schema';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from './helpers';

const SENHA = 'senha-de-teste-123';
const { ObjectId } = mongoose.Types;

describe('Escala do profissional (e2e)', () => {
  let banco: BancoDeTeste;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let mongo: mongoose.mongo.MongoClient;
  let tokenCoord: string;
  let tokenAna: string;
  let tokenCamila: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (email: string, perfil?: string) =>
    (await http.post('/auth/login').send({ email, senha: SENHA, perfil }).expect(200)).body.accessToken as string;

  const agora = new Date();
  const mesRelativo = (delta: number) => {
    const indice = agora.getUTCFullYear() * 12 + agora.getUTCMonth() + delta;
    return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
  };
  const passado = mesRelativo(-2);
  const futuro = mesRelativo(2);
  const dia = (p: { ano: number; mes: number }, d: number) => `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_escala_profissional');
    await aplicarMigrations(banco.uri);
    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';
    const { AppModule } = await import('../src/app.module');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication(); configurarApp(app); await app.init();
    http = request(app.getHttpServer()); mongo = new mongoose.mongo.MongoClient(banco.uri);

    const usuarios = app.get(UsuariosService);
    const coord = await usuarios.criar({ nome: 'Coordenação', email: 'coord-ep@nurseflow.com', cpf: '11144477735', senha: await AuthService.gerarHashSenha(SENHA), tipoUsuario: TipoUsuario.ADMINISTRADOR });
    await usuarios.criarAdministrador(coord._id);
    tokenCoord = await login('coord-ep@nurseflow.com', 'coordenacao');
    const criar = async (nome: string, cpf: string, coren: string, formacao: string, email: string) =>
      new ObjectId((await http.post('/profissionais').set(auth(tokenCoord)).send({ nome, cpf, coren, formacao, tipoVinculo: 'clt', email, senha: SENHA }).expect(201)).body.id);
    const ana = await criar('Ana Ribeiro', '529.982.247-25', 'COREN-CE 710001', 'enfermeiro', 'ana-ep@nurseflow.com');
    const camila = await criar('Camila Souza', '390.533.447-05', 'COREN-CE 710002', 'tecnico', 'camila-ep@nurseflow.com');
    const bruno = await criar('Bruno Lima', '168.995.350-09', 'COREN-CE 710003', 'tecnico', 'bruno-ep@nurseflow.com');
    tokenAna = await login('ana-ep@nurseflow.com');
    tokenCamila = await login('camila-ep@nurseflow.com');

    const db = mongo.db();
    const admin = await db.collection('administradores').findOne({ usuarioId: new ObjectId(coord.id) });
    const administradorId = admin!._id as mongoose.Types.ObjectId;
    const setor = await http.post('/setores').set(auth(tokenCoord)).send({ nome: 'Setor A', turnos: { diurno: { enfermeiros: 0, tecnicos: 0 }, noturno: { enfermeiros: 0, tecnicos: 0 } } }).expect(201);
    const setorId = new ObjectId(setor.body.id);

    const publicar = async (periodo: { ano: number; mes: number }, status: string, numero: number | null, plantoes: Record<string, unknown>[], vinculos: Record<string, unknown>[]) => {
      const escalaId = new ObjectId();
      await db.collection('escalas').insertOne({ _id: escalaId, administradorId, ...periodo, status, revisao: 1, versaoPublicada: numero ?? 0, dataCriacao: new Date(), geracao: {} });
      const comEscala = plantoes.map((p) => ({ ...p, escalaId }));
      if (numero) {
        await db.collection('versoesEscala').insertOne({ escalaId, numero, ...periodo, publicadoPor: administradorId, publicadoEm: new Date(),
          snapshot: { plantoes: comEscala, profissionaisRelacionados: vinculos, pendencias: [], conflitos: [], avisos: [], cargas: [] }, pendenciasConfirmadas: false });
      }
      return escalaId;
    };
    const plantao = (p: { ano: number; mes: number }, d: number, inicio: string, fim: string, horas: number, tipo = 'regular') => ({
      _id: new ObjectId(), setorId, data: new Date(`${dia(p, d)}T00:00:00Z`), horarioInicio: inicio, horarioFim: fim, duracaoHoras: horas, tipo });
    const vinculo = (plantaoId: mongoose.Types.ObjectId, profissionalId: mongoose.Types.ObjectId, funcao: string, lideranca = false, origem = 'regular') =>
      ({ _id: new ObjectId(), plantaoId, profissionalId, funcao, lideranca, origemCobertura: origem });

    // Passado: Camila e Ana no mesmo plantão de 24h; Bruno em outro plantão (não deve vazar para Camila).
    const p1 = plantao(passado, 10, '07:00', '07:00', 24);
    const p2 = plantao(passado, 11, '07:00', '19:00', 12);
    await publicar(passado, 'publicada', 1, [p1, p2], [
      vinculo(p1._id, ana, 'enfermeiro', true), vinculo(p1._id, camila, 'tecnico'), vinculo(p1._id, bruno, 'tecnico', false, 'restricao'),
      vinculo(p2._id, bruno, 'tecnico'),
    ]);
    // Futuro: versão 1 com Camila, versão 2 (nova publicação) com Camila em outro dia; e uma revisão em andamento não publicada.
    const f1 = plantao(futuro, 5, '19:00', '07:00', 12, 'extra');
    const f2 = plantao(futuro, 6, '07:00', '19:00', 12);
    const escalaFuturo = await publicar(futuro, 'em_revisao', 1, [f1], [vinculo(f1._id, ana, 'enfermeiro', true), vinculo(f1._id, camila, 'tecnico')]);
    await db.collection('versoesEscala').insertOne({ escalaId: escalaFuturo, numero: 2, ...futuro, publicadoPor: administradorId, publicadoEm: new Date(),
      snapshot: { plantoes: [{ ...f1, escalaId: escalaFuturo }, { ...f2, escalaId: escalaFuturo }],
        profissionaisRelacionados: [vinculo(f1._id, ana, 'enfermeiro', true), vinculo(f1._id, camila, 'tecnico'), vinculo(f2._id, camila, 'tecnico')], pendencias: [], conflitos: [], avisos: [], cargas: [] }, pendenciasConfirmadas: false });
    // Rascunho que nunca foi publicado (sem versão): não pode aparecer.
    const rascunho = mesRelativo(3);
    await publicar(rascunho, 'rascunho', null, [plantao(rascunho, 3, '07:00', '19:00', 12)], []);
  });

  afterAll(async () => { await mongo?.close(); await app?.close(); await banco?.parar(); });

  it('exige autenticação e vínculo de profissional', async () => {
    await http.get('/escala-profissional/meus-plantoes').expect(401);
    await http.get('/escala-profissional/meus-plantoes').set(auth(tokenCoord)).expect(403);
    await http.get(`/escala-profissional/geral?ano=${futuro.ano}&mes=${futuro.mes}`).set(auth(tokenCoord)).expect(403);
    await http.get(`/escala-profissional/geral/dia?data=${dia(futuro, 5)}`).set(auth(tokenCoord)).expect(403);
  });

  it('valida parâmetros', async () => {
    await http.get('/escala-profissional/meus-plantoes?situacao=outro').set(auth(tokenAna)).expect(400);
    await http.get('/escala-profissional/geral?ano=2026&mes=13').set(auth(tokenAna)).expect(400);
    await http.get('/escala-profissional/geral/dia?data=2026-02-31').set(auth(tokenAna)).expect(400);
    await http.get('/escala-profissional/geral/dia?data=10/11/2026').set(auth(tokenAna)).expect(400);
  });

  it('lista em Anteriores somente os plantões encerrados do próprio profissional, com equipe', async () => {
    const res = await http.get('/escala-profissional/meus-plantoes?situacao=anteriores').set(auth(tokenCamila)).expect(200);
    expect(res.body.total).toBe(1);
    const [item] = res.body.itens;
    expect(item).toMatchObject({ data: dia(passado, 10), duracaoHoras: 24, status: 'trabalhado', tipo: 'regular', funcao: 'tecnico', setor: { nome: 'Setor A' }, chefe: { nome: 'Ana Ribeiro' } });
    expect(item.enfermeiros).toEqual([{ nome: 'Ana Ribeiro', lideranca: true }]);
    expect(item.tecnicos).toEqual([{ nome: 'Bruno Lima' }]);
  });

  it('lista em Próximos a última versão publicada, ignorando a revisão em andamento', async () => {
    const res = await http.get('/escala-profissional/meus-plantoes?situacao=proximos').set(auth(tokenCamila)).expect(200);
    expect(res.body.itens.map((i: { data: string }) => i.data)).toEqual([dia(futuro, 5), dia(futuro, 6)]);
    expect(res.body.itens[0]).toMatchObject({ tipo: 'extra', status: 'trabalhando' });
    const ana = await http.get('/escala-profissional/meus-plantoes?situacao=proximos').set(auth(tokenAna)).expect(200);
    expect(ana.body.itens).toHaveLength(1);
  });

  it('não aceita identificador de outro profissional e não vaza dados pessoais', async () => {
    const res = await http.get('/escala-profissional/meus-plantoes?situacao=anteriores&profissionalId=64b7f0f0f0f0f0f0f0f0f0f0').set(auth(tokenAna));
    expect([200, 400]).toContain(res.status);
    const corpo = JSON.stringify([
      (await http.get('/escala-profissional/meus-plantoes?situacao=anteriores').set(auth(tokenCamila)).expect(200)).body,
      (await http.get(`/escala-profissional/geral?ano=${passado.ano}&mes=${passado.mes}`).set(auth(tokenCamila)).expect(200)).body,
      (await http.get(`/escala-profissional/geral/dia?data=${dia(passado, 10)}`).set(auth(tokenCamila)).expect(200)).body,
    ]);
    for (const proibido of ['cpf', 'coren', 'email', 'telefone', 'restricoes', '529.982', 'COREN-CE']) expect(corpo.toLowerCase()).not.toContain(proibido.toLowerCase());
  });

  it('retorna a escala geral do mês e o detalhe do dia', async () => {
    const mes = await http.get(`/escala-profissional/geral?ano=${passado.ano}&mes=${passado.mes}`).set(auth(tokenCamila)).expect(200);
    expect(mes.body).toMatchObject({ publicada: true, versao: { numero: 1 } });
    expect(mes.body.dias).toEqual([
      { data: dia(passado, 10), turnos: [{ turno: '24h', horarioInicio: '07:00', horarioFim: '07:00' }], chefe: { nome: 'Ana Ribeiro' }, setores: ['Setor A'] },
      { data: dia(passado, 11), turnos: [{ turno: 'diurno', horarioInicio: '07:00', horarioFim: '19:00' }], chefe: null, setores: ['Setor A'] },
    ]);
    const detalhe = await http.get(`/escala-profissional/geral/dia?data=${dia(passado, 10)}`).set(auth(tokenCamila)).expect(200);
    expect(detalhe.body.chefe).toMatchObject({ nome: 'Ana Ribeiro', setores: ['Setor A'] });
    expect(detalhe.body.enfermeiros).toEqual([{ nome: 'Ana Ribeiro', cargo: 'Enfermeiro chefe', setores: ['Setor A'], regime: '24 horas · 07h—07h' }]);
    expect(detalhe.body.tecnicos.map((t: { nome: string; regime: string }) => [t.nome, t.regime])).toEqual([
      ['Bruno Lima', '24 horas · 07h—07h · restrição'],
      ['Camila Souza', '24 horas · 07h—07h'],
    ]);
    expect(detalhe.body.contagens).toEqual({ enfermeiros: 1, tecnicos: 2 });
  });

  it('informa mês sem versão publicada (inexistente ou rascunho) sem erro', async () => {
    const rascunho = mesRelativo(3);
    for (const periodo of [rascunho, mesRelativo(8)]) {
      const res = await http.get(`/escala-profissional/geral?ano=${periodo.ano}&mes=${periodo.mes}`).set(auth(tokenAna)).expect(200);
      expect(res.body).toMatchObject({ publicada: false, dias: [] });
    }
    const dia3 = await http.get(`/escala-profissional/geral/dia?data=${dia(rascunho, 3)}`).set(auth(tokenAna)).expect(200);
    expect(dia3.body).toMatchObject({ publicada: false, enfermeiros: [], tecnicos: [] });
  });
});
