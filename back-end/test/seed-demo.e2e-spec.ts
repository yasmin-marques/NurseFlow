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

  it("cria 76 profissionais com a distribuição aprovada", async () => {
    await seed();
    const profs = await db.collection("profissionaisDaSaude").find().toArray();
    const por = (campo: string) =>
      profs.reduce<Record<string, number>>(
        (acc, p) => ({ ...acc, [p[campo]]: (acc[p[campo]] ?? 0) + 1 }),
        {},
      );
    expect(profs).toHaveLength(76);
    expect(por("formacao")).toEqual({ enfermeiro: 32, tecnico: 44 });
    expect(por("tipoVinculo")).toEqual({ concursado: 36, clt: 33, rpa: 7 });
    expect(por("status")).toEqual({
      ativo: 68,
      ferias: 3,
      afastado: 3,
      desativado: 2,
    });
    for (const p of profs.filter((x) => x.status === "desativado"))
      expect(p.desativadoEm).toBeInstanceOf(Date);
    for (const p of profs.filter((x) => x.status !== "desativado"))
      expect(p.desativadoEm).toBeNull();
  });

  it("gera CPFs válidos e únicos, e-mails e COREN únicos, e vincula usuários e profissionais", async () => {
    const usuarios = await db.collection("usuarios").find().toArray();
    const profs = await db.collection("profissionaisDaSaude").find().toArray();
    expect(usuarios).toHaveLength(77); // 76 profissionais + coordenação
    expect(usuarios.every((u) => cpfValido(u.cpf))).toBe(true);
    expect(new Set(usuarios.map((u) => u.cpf)).size).toBe(77);
    expect(new Set(usuarios.map((u) => u.email)).size).toBe(77);
    expect(usuarios.every((u) => u.email.endsWith(".test"))).toBe(true);
    expect(new Set(profs.map((p) => p.coren)).size).toBe(76);
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
    expect(restricoes).toHaveLength(16);
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

  it("setores e vínculos refletem as regras de subsetores (mínimos, setor/subsetor dos profissionais)", async () => {
    const setores = await db.collection("setores").find().toArray();
    const subsetores = await db.collection("subsetores").find().toArray();
    const profs = await db.collection("profissionaisDaSaude").find().toArray();
    const porNome = new Map(setores.map((s) => [s.nome, s]));

    // Setor com subsetores: mínimo de enfermeiros no setor; técnicos por subsetor (derivado = soma, mesma demanda de antes).
    const uti = porNome.get("UTI")!;
    expect(uti).toMatchObject({ possuiSubsetores: true, plantao24h: { enfermeiros: 2, tecnicos: 3 } });
    const subsDaUti = subsetores.filter((s) => String(s.setorId) === String(uti._id));
    expect(subsDaUti.map((s) => [s.nome, s.plantao24h.tecnicos]).sort()).toEqual([
      ["UTI Adulto", 2],
      ["UTI Intermediária", 1],
    ]);
    // Setores sem subsetores: os dois mínimos no setor.
    expect(porNome.get("Emergência")).toMatchObject({ possuiSubsetores: false, plantao24h: { enfermeiros: 2, tecnicos: 3 } });
    expect(porNome.get("Clínica Médica")).toMatchObject({ possuiSubsetores: false, plantao24h: { enfermeiros: 1, tecnicos: 2 } });
    expect(subsetores).toHaveLength(2);

    // Todos os profissionais têm setor; subsetor só para técnicos de setor com subsetores, sempre do próprio setor.
    const subPorId = new Map(subsetores.map((s) => [String(s._id), s]));
    expect(profs.every((p) => p.setorId && porNome.size && [...porNome.values()].some((s) => String(s._id) === String(p.setorId)))).toBe(true);
    for (const p of profs) {
      const doUti = String(p.setorId) === String(uti._id);
      if (p.formacao === "tecnico" && doUti) {
        expect(subPorId.get(String(p.subsetorId))?.setorId).toEqual(uti._id);
      } else {
        expect(p.subsetorId).toBeNull();
      }
    }
    // Os técnicos do UTI se repartem proporcionalmente ao mínimo de cada subsetor (2:1).
    const tecnicosUti = profs.filter((p) => p.formacao === "tecnico" && String(p.setorId) === String(uti._id));
    const contagem = (nome: string) => tecnicosUti.filter((p) => subPorId.get(String(p.subsetorId))?.nome === nome).length;
    expect(contagem("UTI Adulto") + contagem("UTI Intermediária")).toBe(tecnicosUti.length);
    expect(contagem("UTI Adulto")).toBeGreaterThan(contagem("UTI Intermediária"));
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
