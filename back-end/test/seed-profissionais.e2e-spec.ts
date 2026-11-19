import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from "./helpers";

const requireSeed = createRequire(resolve(process.cwd(), "test/seed-profissionais.e2e-spec.ts"));
const { main: seed, TOTAL, planoDeProfissionais } = requireSeed("../scripts/seed-profissionais.js") as {
  main: () => Promise<void>;
  TOTAL: number;
  planoDeProfissionais: () => { cpf: string }[];
};

const ENV = ["MONGODB_URI", "NODE_ENV", "ALLOW_DEMO_IN_PRODUCTION"];

describe("seed de 40 profissionais com setor fixo (e2e)", () => {
  let banco: BancoDeTeste;
  let client: mongoose.mongo.MongoClient;
  let db: mongoose.mongo.Db;
  const original = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  const col = (nome: string) => db.collection(nome);
  const turnos = (d: [number, number], n: [number, number]) => ({
    diurno: { enfermeiros: d[0], tecnicos: d[1] },
    noturno: { enfermeiros: n[0], tecnicos: n[1] },
  });
  const agora = new Date();
  const inserirSetor = async (nome: string, d: [number, number], n: [number, number], ativo = true) =>
    (await col("setores").insertOne({ nome, ativo, turnos: turnos(d, n), createdAt: agora, updatedAt: agora })).insertedId;
  const filtroSeed = { email: /^prof\.seed\.\d{2}@/ };
  const usuarioAlheio = (email: string, cpf: string) => ({
    nome: "Pessoa Alheia", email, cpf, senha: "x", tipoUsuario: "profissionalDaSaude",
    senhaTemporaria: false, tentativasFalhasLogin: 0, bloqueadoAte: null, ultimoLoginEm: null, createdAt: agora, updatedAt: agora,
  });

  beforeAll(async () => {
    banco = await iniciarBanco("nurseflow_seed_profissionais");
    await aplicarMigrations(banco.uri);
    client = new mongoose.mongo.MongoClient(banco.uri);
    db = client.db();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    Object.assign(process.env, { MONGODB_URI: banco.uri, NODE_ENV: "test" });
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

  it("sem setores cadastrados interrompe com o pré-requisito e não grava nada", async () => {
    await expect(seed()).rejects.toThrow(/Pré-requisito.*setores ativos/);
    expect(await col("usuarios").countDocuments()).toBe(0);
    expect(await col("profissionaisDaSaude").countDocuments()).toBe(0);
  });

  it("setores inativos não contam como pré-requisito", async () => {
    await inserirSetor("Antigo", [1, 1], [1, 1], false);
    await expect(seed()).rejects.toThrow(/Pré-requisito/);
    expect(await col("profissionaisDaSaude").countDocuments()).toBe(0);
    await col("setores").deleteMany({});
  });

  it("cria exatamente 40 profissionais, cada um com um único setor ativo existente, sem criar setores nem dados demo", async () => {
    const uti = await inserirSetor("UTI", [2, 3], [2, 2]);
    const emergencia = await inserirSetor("Emergência", [2, 3], [1, 2]);
    const clinica = await inserirSetor("Clínica Médica", [1, 2], [1, 1]);
    // Profissional pré-existente que NÃO é da seed: nunca pode ser alterado.
    const usuario = await col("usuarios").insertOne(usuarioAlheio("alheia@exemplo.test", "11144477735"));
    const alheio = {
      usuarioId: usuario.insertedId, coren: "CE-99999", formacao: "tecnico", tipoVinculo: "clt", status: "ativo",
      setorId: null, sincronizaAgenda: false, desativadoEm: null, createdAt: agora, updatedAt: agora,
    };
    const { insertedId: alheioId } = await col("profissionaisDaSaude").insertOne(alheio);

    await seed();

    const usuarios = await col("usuarios").find(filtroSeed).toArray();
    expect(usuarios).toHaveLength(TOTAL);
    expect(TOTAL).toBe(40);
    const profs = await col("profissionaisDaSaude").find({ usuarioId: { $in: usuarios.map((u) => u._id) } }).toArray();
    expect(profs).toHaveLength(40);
    const setoresValidos = new Set([uti, emergencia, clinica].map(String));
    expect(profs.every((p) => p.setorId && setoresValidos.has(String(p.setorId)))).toBe(true);
    expect(profs.every((p) => p.status === "ativo" && ["enfermeiro", "tecnico"].includes(p.formacao))).toBe(true);
    expect(new Set(profs.map((p) => p.coren)).size).toBe(40);
    // Todos os setores recebem pessoas, na proporção da exigência de cada categoria.
    const contagem = (setor: unknown, formacao: string) =>
      profs.filter((p) => String(p.setorId) === String(setor) && p.formacao === formacao).length;
    expect(contagem(uti, "enfermeiro")).toBeGreaterThan(contagem(clinica, "enfermeiro"));
    expect(contagem(uti, "tecnico")).toBeGreaterThanOrEqual(contagem(clinica, "tecnico"));
    expect([uti, emergencia, clinica].every((s) => contagem(s, "enfermeiro") + contagem(s, "tecnico") > 0)).toBe(true);

    // Não cria setores, escalas, plantões, solicitações de troca nem outros dados de demonstração.
    expect(await col("setores").countDocuments()).toBe(3);
    const vazias = ["escalas", "plantoes", "profissionaisRelacionados", "versoesEscala", "solicitacoesTroca", "restricoes", "extrasProgramados", "configuracoes", "administradores"];
    for (const nome of vazias) expect([nome, await col(nome).countDocuments()]).toEqual([nome, 0]);
    // O profissional que não pertence à seed permanece idêntico.
    expect(await col("profissionaisDaSaude").findOne({ _id: alheioId })).toEqual({ _id: alheioId, ...alheio });
  });

  it("a segunda execução é idempotente: não duplica nem altera os 40 registros", async () => {
    const antes = await col("profissionaisDaSaude").find().sort({ coren: 1 }).toArray();
    const usuariosAntes = await col("usuarios").find().sort({ email: 1 }).toArray();
    await seed();
    expect(await col("profissionaisDaSaude").find().sort({ coren: 1 }).toArray()).toEqual(antes);
    expect(await col("usuarios").find().sort({ email: 1 }).toArray()).toEqual(usuariosAntes);
    expect(await col("usuarios").countDocuments(filtroSeed)).toBe(40);
  });

  it("conflito com cadastro alheio aborta tudo-ou-nada (nada parcial)", async () => {
    await col("profissionaisDaSaude").deleteMany({});
    await col("usuarios").deleteMany({});
    // Usuário alheio com o CPF reservado à seed (profissional 07): a seed deve recusar antes de gravar.
    await col("usuarios").insertOne(usuarioAlheio("outro@exemplo.test", planoDeProfissionais()[6].cpf));

    await expect(seed()).rejects.toThrow(/Conflito/);
    expect(await col("usuarios").countDocuments(filtroSeed)).toBe(0);
    expect(await col("profissionaisDaSaude").countDocuments()).toBe(0);
  });

  it("categorias não exigidas por um setor não recebem profissionais dessa categoria", async () => {
    await col("usuarios").deleteMany({});
    await col("setores").deleteMany({});
    const soEnf = await inserirSetor("Só enfermeiros", [2, 0], [2, 0]);
    const soTec = await inserirSetor("Só técnicos", [0, 3], [0, 3]);
    await seed();
    const profs = await col("profissionaisDaSaude").find().toArray();
    expect(profs).toHaveLength(40);
    expect(profs.filter((p) => String(p.setorId) === String(soEnf)).every((p) => p.formacao === "enfermeiro")).toBe(true);
    expect(profs.filter((p) => String(p.setorId) === String(soTec)).every((p) => p.formacao === "tecnico")).toBe(true);
  });
});
