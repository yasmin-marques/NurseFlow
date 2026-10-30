import mongoose from 'mongoose';
import { cpfValido } from '../src/common/utils/cpf';
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PEOPLE, seed } = require('../scripts/seed-demo.js') as {
  PEOPLE: [string, string, string, string, string, string][];
  seed: () => Promise<void>;
};

const ENV = ['DEMO_SEED_ENABLED', 'DEMO_ADMIN_PASSWORD', 'DEMO_PRO_PASSWORD', 'MONGODB_URI', 'NODE_ENV', 'ALLOW_DEMO_IN_PRODUCTION'];

describe('seed de demonstração (e2e)', () => {
  let banco: BancoDeTeste;
  let db: mongoose.mongo.Db;
  let client: mongoose.mongo.MongoClient;
  const original = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  const contar = (colecao: string) => db.collection(colecao).countDocuments();

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_seed_test');
    await aplicarMigrations(banco.uri);
    client = new mongoose.mongo.MongoClient(banco.uri);
    db = client.db();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    Object.assign(process.env, {
      MONGODB_URI: banco.uri,
      DEMO_SEED_ENABLED: 'true',
      DEMO_ADMIN_PASSWORD: 'senha-admin-123',
      DEMO_PRO_PASSWORD: 'senha-pro-1234',
      NODE_ENV: 'test',
    });
    delete process.env.ALLOW_DEMO_IN_PRODUCTION;
  });

  afterAll(async () => {
    for (const k of ENV) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
    jest.restoreAllMocks();
    await client.close();
    await banco.parar();
  });

  it('cria 27 profissionais com a distribuição aprovada', async () => {
    await seed();
    const profs = await db.collection('profissionaisDaSaude').find().toArray();
    const por = (campo: string) =>
      profs.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p[campo]]: (acc[p[campo]] ?? 0) + 1 }), {});
    expect(profs).toHaveLength(27);
    expect(por('formacao')).toEqual({ enfermeiro: 13, tecnico: 14 });
    expect(por('tipoVinculo')).toEqual({ concursado: 10, clt: 10, rpa: 7 });
    expect(por('status')).toEqual({ ativo: 19, ferias: 3, afastado: 3, desativado: 2 });
    for (const p of profs.filter((x) => x.status === 'desativado')) expect(p.desativadoEm).toBeInstanceOf(Date);
    for (const p of profs.filter((x) => x.status !== 'desativado')) expect(p.desativadoEm).toBeNull();
  });

  it('gera CPFs válidos e únicos, e-mails e COREN únicos, e vincula usuários e profissionais', async () => {
    const usuarios = await db.collection('usuarios').find().toArray();
    const profs = await db.collection('profissionaisDaSaude').find().toArray();
    expect(usuarios).toHaveLength(28); // 27 profissionais + coordenação
    expect(usuarios.every((u) => cpfValido(u.cpf))).toBe(true);
    expect(new Set(usuarios.map((u) => u.cpf)).size).toBe(28);
    expect(new Set(usuarios.map((u) => u.email)).size).toBe(28);
    expect(usuarios.every((u) => u.email.endsWith('.test'))).toBe(true);
    expect(new Set(profs.map((p) => p.coren)).size).toBe(27);
    expect(PEOPLE.map((p) => p[5])).toEqual([...new Set(PEOPLE.map((p) => p[5]))]);

    const porId = new Map(usuarios.map((u) => [String(u._id), u]));
    for (const p of profs) expect(porId.get(String(p.usuarioId))?.tipoUsuario).toBe('profissionalDaSaude');
    const admin = usuarios.find((u) => u.tipoUsuario === 'administrador')!;
    expect(await db.collection('administradores').countDocuments({ usuarioId: admin._id })).toBe(1);
  });

  it('restrições referenciam profissionais existentes e coincidem com o status', async () => {
    const profs = await db.collection('profissionaisDaSaude').find().toArray();
    const ids = new Set(profs.map((p) => String(p._id)));
    const restricoes = await db.collection('restricoes').find().toArray();
    expect(restricoes).toHaveLength(16);
    expect(restricoes.every((r) => ids.has(String(r.profissionalId)))).toBe(true);
    expect(restricoes.every((r) => profs.find((p) => String(p._id) === String(r.profissionalId))?.status !== 'desativado')).toBe(true);
  });

  it('é idempotente: executar de novo não duplica nem altera registros', async () => {
    const antes = await db.collection('profissionaisDaSaude').find().sort({ coren: 1 }).toArray();
    const contagens = async () => [await contar('usuarios'), await contar('profissionaisDaSaude'), await contar('restricoes'), await contar('setores'), await contar('configuracoes')];
    const totais = await contagens();
    await seed();
    expect(await contagens()).toEqual(totais);
    expect(await db.collection('profissionaisDaSaude').find().sort({ coren: 1 }).toArray()).toEqual(antes);
  });

  it('mantém as proteções: desabilitado e produção sem autorização não gravam', async () => {
    const total = await contar('usuarios');
    process.env.DEMO_SEED_ENABLED = 'false';
    await seed();
    process.env.DEMO_SEED_ENABLED = 'true';
    process.env.NODE_ENV = 'production';
    await expect(seed()).rejects.toThrow(/NODE_ENV=production/);
    process.env.NODE_ENV = 'test';
    process.env.DEMO_PRO_PASSWORD = 'curta';
    await expect(seed()).rejects.toThrow(/DEMO_PRO_PASSWORD/);
    process.env.DEMO_PRO_PASSWORD = 'senha-pro-1234';
    expect(await contar('usuarios')).toBe(total);
  });
});
