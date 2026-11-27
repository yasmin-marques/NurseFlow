import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { cpfValido } from "../src/common/utils/cpf";
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from "./helpers";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const requireSeed = createRequire(
  resolve(process.cwd(), "test/seed-demo.e2e-spec.ts"),
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PEOPLE, seed } = requireSeed("../scripts/seed-demo.js") as {
  PEOPLE: [string, string, string, string, string, string][];
  seed: () => Promise<void>;
};

const ENV = [
  "DEMO_SEED_ENABLED",
  "DEMO_ADMIN_PASSWORD",
  "DEMO_PRO_PASSWORD",
  "MONGODB_URI",
  "NODE_ENV",
  "ALLOW_DEMO_IN_PRODUCTION",
];

describe("seed de demonstração (e2e)", () => {
  let banco: BancoDeTeste;
  let db: mongoose.mongo.Db;
  let client: mongoose.mongo.MongoClient;
  const original = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  const contar = (colecao: string) => db.collection(colecao).countDocuments();

  beforeAll(async () => {
    banco = await iniciarBanco("nurseflow_seed_test");
    await aplicarMigrations(banco.uri);
    client = new mongoose.mongo.MongoClient(banco.uri);
    db = client.db();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    Object.assign(process.env, {
      MONGODB_URI: banco.uri,
      DEMO_SEED_ENABLED: "true",
      DEMO_ADMIN_PASSWORD: "senha-admin-123",
      DEMO_PRO_PASSWORD: "senha-pro-1234",
      NODE_ENV: "test",
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

  it("cria o efetivo mínimo ativo e mantém os perfis inativos de demonstração", async () => {
    await seed();
    const profs = await db.collection("profissionaisDaSaude").find().toArray();
    const por = (campo: string) =>
      profs.reduce<Record<string, number>>(
        (acc, p) => ({ ...acc, [p[campo]]: (acc[p[campo]] ?? 0) + 1 }),
        {},
      );
    expect(profs).toHaveLength(46);
    expect(por("formacao")).toEqual({ enfermeiro: 12, tecnico: 34 });
    expect(por("tipoVinculo")).toEqual({ concursado: 24, clt: 15, rpa: 7 });
    expect(por("status")).toEqual({
      ativo: 39,
      ferias: 3,
      afastado: 3,
      desativado: 1,
    });
    for (const p of profs.filter((x) => x.status === "desativado"))
      expect(p.desativadoEm).toBeInstanceOf(Date);
    for (const p of profs.filter((x) => x.status !== "desativado"))
      expect(p.desativadoEm).toBeNull();
  });

  it("gera CPFs válidos e únicos, e-mails e COREN únicos, e vincula usuários e profissionais", async () => {
    const usuarios = await db.collection("usuarios").find().toArray();
    const profs = await db.collection("profissionaisDaSaude").find().toArray();
    expect(usuarios).toHaveLength(47); // 46 profissionais + coordenação
    expect(usuarios.every((u) => cpfValido(u.cpf))).toBe(true);
    expect(new Set(usuarios.map((u) => u.cpf)).size).toBe(47);
    expect(new Set(usuarios.map((u) => u.email)).size).toBe(47);
    expect(usuarios.every((u) => u.email.endsWith(".test"))).toBe(true);
    expect(new Set(profs.map((p) => p.coren)).size).toBe(46);
    expect(PEOPLE.map((p) => p[5])).toEqual([
      ...new Set(PEOPLE.map((p) => p[5])),
    ]);

    const porId = new Map(usuarios.map((u) => [String(u._id), u]));
    for (const p of profs)
      expect(porId.get(String(p.usuarioId))?.tipoUsuario).toBe(
        "profissionalDaSaude",
      );
    const admin = usuarios.find((u) => u.tipoUsuario === "administrador")!;
    expect(
      await db
        .collection("administradores")
        .countDocuments({ usuarioId: admin._id }),
    ).toBe(1);
  });

  it("restrições referenciam profissionais existentes e coincidem com o status", async () => {
    const profs = await db.collection("profissionaisDaSaude").find().toArray();
    const ids = new Set(profs.map((p) => String(p._id)));
    const restricoes = await db.collection("restricoes").find().toArray();
    expect(restricoes).toHaveLength(6);
    expect(restricoes.every((r) => ids.has(String(r.profissionalId)))).toBe(
      true,
    );
    expect(
      restricoes.every(
        (r) =>
          profs.find((p) => String(p._id) === String(r.profissionalId))
            ?.status !== "desativado",
      ),
    ).toBe(true);
  });

  it("cria configurações mensais padrão para outubro e novembro de 2026", async () => {
    const configs = await db
      .collection("configuracoes")
      .find({ chave: { $in: ["2026-10", "2026-11"] } })
      .toArray();
    expect(configs).toHaveLength(2);
    for (const config of configs) {
      expect(config).toMatchObject({
        limiteTrocas: 3,
        maxExtras: 2,
        limitePlantoes: 12,
        maxExtrasConcursado: 1,
        maxExtrasClt: 1,
        cargas: {
          concursado_31: { plantoes24h: 6, plantoes12h: 1 },
          clt_31: { plantoes24h: 5, plantoes12h: 2 },
        },
      });
    }
  });

  it("atribui a carga ativa mínima por setor e sub-setor conforme as cargas dos vínculos", async () => {
    const setores = await db.collection("setores").find().toArray();
    const subsetores = await db.collection("subsetores").find().toArray();
    const profs = await db.collection("profissionaisDaSaude").find().toArray();
    const porNome = new Map(setores.map((s) => [s.nome, s]));

    const internamento = porNome.get("Internamento")!;
    const emergencia = porNome.get("Emergência")!;
    expect(setores).toHaveLength(2);
    expect(internamento).toMatchObject({ possuiSubsetores: true, plantao24h: { enfermeiros: 1, tecnicos: 2 } });
    expect(emergencia).toMatchObject({ possuiSubsetores: false, plantao24h: { enfermeiros: 1, tecnicos: 3 } });
    const subsDoInternamento = subsetores.filter((s) => String(s.setorId) === String(internamento._id));
    expect(subsDoInternamento.map((s) => [s.nome, s.plantao24h.tecnicos]).sort()).toEqual([
      ["Setor A", 1],
      ["Setor B", 1],
    ]);
    expect(subsetores).toHaveLength(2);

    const subPorId = new Map(subsetores.map((s) => [String(s._id), s]));
    expect(profs.every((p) => p.setorId && porNome.size && [...porNome.values()].some((s) => String(s._id) === String(p.setorId)))).toBe(true);
    for (const p of profs) {
      const doInternamento = String(p.setorId) === String(internamento._id);
      if (p.formacao === "tecnico" && doInternamento) {
        expect(subPorId.get(String(p.subsetorId))?.setorId).toEqual(internamento._id);
      } else {
        expect(p.subsetorId).toBeNull();
      }
    }

    const ativos = profs.filter((p) => p.status === "ativo");
    const escalaveis = ativos.filter((p) => p.tipoVinculo !== "rpa");
    const grupo = (formacao: string, setorId: unknown, subsetorId?: unknown) =>
      escalaveis.filter((p) =>
        p.formacao === formacao &&
        String(p.setorId) === String(setorId) &&
        (subsetorId === undefined || String(p.subsetorId) === String(subsetorId)),
      );
    const vinculos = (profissionais: typeof ativos) =>
      profissionais.reduce<Record<string, number>>((acc, p) => {
        acc[p.tipoVinculo] = (acc[p.tipoVinculo] ?? 0) + 1;
        return acc;
      }, {});
    expect(ativos).toHaveLength(39);
    expect(ativos.filter((p) => p.tipoVinculo === "rpa")).toHaveLength(6);
    expect(escalaveis).toHaveLength(33);
    expect(grupo("enfermeiro", internamento._id)).toHaveLength(5);
    expect(grupo("enfermeiro", emergencia._id)).toHaveLength(5);
    expect(vinculos(grupo("enfermeiro", internamento._id))).toEqual({ concursado: 2, clt: 3 });
    expect(vinculos(grupo("enfermeiro", emergencia._id))).toEqual({ concursado: 2, clt: 3 });
    for (const subsetor of subsDoInternamento) {
      const tecnicos = grupo("tecnico", internamento._id, subsetor._id);
      expect(tecnicos).toHaveLength(5);
      expect(vinculos(tecnicos)).toEqual({ concursado: 2, clt: 3 });
    }
    const tecnicosEmergencia = grupo("tecnico", emergencia._id);
    expect(tecnicosEmergencia).toHaveLength(13);
    expect(vinculos(tecnicosEmergencia)).toEqual({ concursado: 13 });
    const idsAtivos = new Set(ativos.map((p) => String(p._id)));
    const restricoesAtivos = await db.collection("restricoes").countDocuments({
      profissionalId: { $in: [...idsAtivos].map((id) => new mongoose.Types.ObjectId(id)) },
    });
    expect(restricoesAtivos).toBe(0);
  });

  it("o diagnóstico de vínculos não encontra pendências na demo", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { diagnosticar } = requireSeed("../scripts/diagnosticar-vinculos.js") as {
      diagnosticar: (d: object) => { pendencias: unknown[]; divergencias: unknown[] };
    };
    const resultado = diagnosticar({
      setores: await db.collection("setores").find().toArray(),
      subsetores: await db.collection("subsetores").find().toArray(),
      profissionais: await db.collection("profissionaisDaSaude").find().toArray(),
    });
    expect(resultado).toEqual({ pendencias: [], divergencias: [] });
  });

  it("é idempotente: executar de novo não duplica nem altera registros", async () => {
    const antes = await db
      .collection("profissionaisDaSaude")
      .find()
      .sort({ coren: 1 })
      .toArray();
    const contagens = async () => [
      await contar("usuarios"),
      await contar("profissionaisDaSaude"),
      await contar("restricoes"),
      await contar("setores"),
      await contar("subsetores"),
      await contar("configuracoes"),
    ];
    const totais = await contagens();
    await seed();
    expect(await contagens()).toEqual(totais);
    expect(
      await db
        .collection("profissionaisDaSaude")
        .find()
        .sort({ coren: 1 })
        .toArray(),
    ).toEqual(antes);
  });

  it("mantém as proteções: desabilitado e produção sem autorização não gravam", async () => {
    const total = await contar("usuarios");
    process.env.DEMO_SEED_ENABLED = "false";
    await seed();
    process.env.DEMO_SEED_ENABLED = "true";
    process.env.NODE_ENV = "production";
    await expect(seed()).rejects.toThrow(/NODE_ENV=production/);
    process.env.NODE_ENV = "test";
    process.env.DEMO_PRO_PASSWORD = "curta";
    await expect(seed()).rejects.toThrow(/DEMO_PRO_PASSWORD/);
    process.env.DEMO_PRO_PASSWORD = "senha-pro-1234";
    expect(await contar("usuarios")).toBe(total);
  });
});
