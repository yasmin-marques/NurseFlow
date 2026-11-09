import mongoose from "mongoose";
import {
  aplicarMigrations,
  aplicarMigrationsAte,
  type BancoDeTeste,
  iniciarBanco,
  listarMigrations,
} from "./helpers";

describe("Migrations", () => {
  let banco: BancoDeTeste;
  let client: mongoose.mongo.MongoClient;
  let db: mongoose.mongo.Db;

  beforeAll(async () => {
    banco = await iniciarBanco("nurseflow_migrations");
    client = new mongoose.mongo.MongoClient(banco.uri);
    db = client.db();

    // Estado "antigo" (db/mongo/script.js original): sem validators novos.
    await db.collection("setores").insertOne({
      nome: "Bloco A",
      descricao: "Assistência clínica",
      quantMinEnf: 2,
      quantMinTec: 3,
    });
    await db.collection("profissionaisDaSaude").insertOne({
      usuarioId: new mongoose.Types.ObjectId(),
      coren: "COREN-CE 1",
      tipoVinculo: "clt",
      status: "desligado",
      formacao: "tecnico",
      sincronizaAgenda: false,
    });
    const administradorId = new mongoose.Types.ObjectId();
    const escalaId = new mongoose.Types.ObjectId();
    const plantaoId = new mongoose.Types.ObjectId();
    await db.collection("escalas").insertOne({
      _id: escalaId,
      administradorId,
      mes: 10,
      ano: 2026,
      status: "publicada",
      dataCriacao: new Date("2026-09-20T12:00:00.000Z"),
    });
    await db.collection("plantoes").insertOne({
      _id: plantaoId,
      escalaId,
      setorId: new mongoose.Types.ObjectId(),
      data: new Date("2026-10-01T00:00:00.000Z"),
      horarioInicio: "07:00",
      horarioFim: "07:00",
      duracaoHoras: 24,
      tipo: "regular",
    });
    await db.collection("profissionaisRelacionados").insertOne({
      plantaoId,
      profissionalId: new mongoose.Types.ObjectId(),
      funcao: "enfermeiro",
    });
  });

  afterAll(async () => {
    await client?.close();
    await banco?.parar();
  });

  it("há migrations nomeadas com timestamp", () => {
    expect(listarMigrations()).toHaveLength(10);
    expect(listarMigrations()).toContain("20261101000009-restricoes-campos-estruturados.js");
    expect(listarMigrations()).toContain("20261101000010-trocas.js");
  });

  it('up: converte setores para quantitativo por turno e "desligado" para "desativado"', async () => {
    await aplicarMigrations(banco.uri, "up");

    const setor = await db.collection("setores").findOne({ nome: "Bloco A" });
    expect(setor).toMatchObject({
      ativo: true,
      turnos: {
        diurno: { enfermeiros: 2, tecnicos: 3 },
        noturno: { enfermeiros: 2, tecnicos: 3 },
      },
    });
    expect(setor).not.toHaveProperty("quantMinEnf");
    expect(setor).not.toHaveProperty("quantMinTec");

    const profissional = await db
      .collection("profissionaisDaSaude")
      .findOne({ coren: "COREN-CE 1" });
    expect(profissional?.status).toBe("desativado");
  });

  it("up: aplica os validators e índices únicos", async () => {
    await expect(
      db.collection("setores").insertOne({ nome: "Sem turnos", ativo: true }),
    ).rejects.toThrow(/validation/i);
    await expect(
      db.collection("profissionaisDaSaude").insertOne({
        usuarioId: new mongoose.Types.ObjectId(),
        coren: "X",
        tipoVinculo: "clt",
        status: "desligado",
        formacao: "tecnico",
        sincronizaAgenda: false,
      }),
    ).rejects.toThrow(/validation/i);
    await expect(
      db.collection("setores").insertOne({
        nome: "bloco a",
        ativo: true,
        turnos: {
          diurno: { enfermeiros: 1, tecnicos: 1 },
          noturno: { enfermeiros: 1, tecnicos: 1 },
        },
      }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('up: cria as coleções, o contrato persistente e os índices de consulta/auditoria de trocas', async () => {
    await aplicarMigrations(banco.uri);
    const solicitacaoId = new mongoose.Types.ObjectId();
    const profissionalA = new mongoose.Types.ObjectId();
    const profissionalB = new mongoose.Types.ObjectId();
    const vinculoA = new mongoose.Types.ObjectId();
    const vinculoB = new mongoose.Types.ObjectId();
    await db.collection('solicitacoesTroca').insertOne({
      status: 'aguardando_coordenacao', ano: 2026, mes: 11, solicitanteProfissionalId: profissionalA,
      profissionalSolicitadoId: profissionalB, vinculoSolicitanteId: vinculoA, vinculoSolicitadoId: vinculoB,
      criadaEm: new Date(), aceite: { profissionalId: profissionalB, aceitoEm: new Date() }, decisaoCoordenacao: null,
      chaveIdempotencia: null, createdAt: new Date(), updatedAt: new Date(),
    });
    await expect(db.collection('solicitacoesTroca').insertOne({ status: 'aprovada', ano: 2026, mes: 13,
      solicitanteProfissionalId: profissionalA, profissionalSolicitadoId: profissionalB, vinculoSolicitanteId: vinculoA,
      vinculoSolicitadoId: vinculoB, criadaEm: new Date() })).rejects.toThrow(/validation/i);
    const indexes = await db.collection('solicitacoesTroca').indexes();
    expect(indexes.map((item) => item.name)).toContain('status_1_ano_1_mes_1_criadaEm_-1');
    expect((await db.listCollections({ name: 'auditoriaTrocas' }).toArray())).toHaveLength(1);
    expect((await db.listCollections({ name: 'notificacoesTroca' }).toArray())).toHaveLength(1);
    expect(solicitacaoId).toBeInstanceOf(mongoose.Types.ObjectId);
  });

  it('down da migration de trocas preserva solicitações e auditorias já registradas', async () => {
    const solicId = new mongoose.Types.ObjectId();
    await db.collection('solicitacoesTroca').insertOne({ _id: solicId, status: 'aguardando_coordenacao', ano: 2026, mes: 11,
      solicitanteProfissionalId: new mongoose.Types.ObjectId(), profissionalSolicitadoId: new mongoose.Types.ObjectId(),
      vinculoSolicitanteId: new mongoose.Types.ObjectId(), vinculoSolicitadoId: new mongoose.Types.ObjectId(), criadaEm: new Date() });
    await aplicarMigrations(banco.uri, 'down');
    expect(await db.collection('solicitacoesTroca').countDocuments({ _id: solicId })).toBe(1);
    expect((await db.listCollections({ name: 'auditoriaTrocas' }).toArray())).toHaveLength(1);
  });

  async function criarBancoParaMigracao00009() {
    const banco = await iniciarBanco("nurseflow_00009_isolado");
    const client = new mongoose.mongo.MongoClient(banco.uri);
    const db = client.db();
    await aplicarMigrationsAte(
      banco.uri,
      "20261030000008-anos-escalas-independentes.js",
    );
    return { banco, client, db };
  }

  it("00009: preserva campos existentes, aceita BSON int/double, preenche ausentes e é idempotente", async () => {
    const arquivo00009 = "20261101000009-restricoes-campos-estruturados.js";
    const { banco, client, db } = await criarBancoParaMigracao00009();

    try {
      const legadoSemCampos = await db.collection("restricoes").insertOne({
        profissionalId: new mongoose.Types.ObjectId(),
        tipo: "indisponivel",
        inicio: new Date("2026-07-01T00:00:00.000Z"),
        fim: new Date("2026-07-05T23:59:59.999Z"),
        diaSemana: new mongoose.mongo.Int32(1),
      });

      const legadoDouble = await db.collection("restricoes").insertOne({
        profissionalId: new mongoose.Types.ObjectId(),
        tipo: "ausencia",
        inicio: new Date("2026-08-01T00:00:00.000Z"),
        fim: new Date("2026-08-05T23:59:59.999Z"),
        diaSemana: new mongoose.mongo.Double(2),
        turno: "diurno",
        motivo: "falta médica",
      });

      const legadoComCampos = await db.collection("restricoes").insertOne({
        profissionalId: new mongoose.Types.ObjectId(),
        tipo: "vinculo_externo",
        inicio: new Date("2026-08-10T00:00:00.000Z"),
        fim: new Date("2026-08-15T23:59:59.999Z"),
        diaSemana: new mongoose.mongo.Int32(3),
        turno: "noturno",
        motivo: "evento familiar",
        observacao: "arquivo antigo preservado",
        instituicao: "Hospital Regional",
        tipoVinculo: "concursado",
      });

      const legadoLongo = await db.collection("restricoes").insertOne({
        profissionalId: new mongoose.Types.ObjectId(),
        tipo: "disponivel",
        inicio: new Date("2026-09-01T00:00:00.000Z"),
        fim: new Date("2026-09-10T23:59:59.999Z"),
        diaSemana: new mongoose.mongo.Double(4),
        observacao: "x".repeat(800),
      });

      const validatorAntes = await db.command({
        listCollections: 1,
        filter: { name: "restricoes" },
        cursor: {},
      });
      const schemaAntes = validatorAntes.cursor.firstBatch[0].options.validator;
      expect(schemaAntes.$jsonSchema.properties).not.toHaveProperty("turno");

      await aplicarMigrations(banco.uri, "up", arquivo00009);

      const faltante = await db
        .collection("restricoes")
        .findOne({ _id: legadoSemCampos.insertedId });
      expect(faltante).toMatchObject({
        diaSemana: 1,
        turno: null,
        motivo: null,
        observacao: null,
        instituicao: null,
        tipoVinculo: null,
      });

      const tipoDouble = await db
        .collection("restricoes")
        .aggregate([
          { $match: { _id: legadoDouble.insertedId } },
          { $project: { tipoDiaSemana: { $type: "$diaSemana" } } },
        ])
        .next();
      expect(tipoDouble?.tipoDiaSemana).toBe("double");
      expect(
        await db
          .collection("restricoes")
          .findOne({ _id: legadoDouble.insertedId }),
      ).toMatchObject({ diaSemana: 2, turno: "diurno" });

      const tipoInt = await db
        .collection("restricoes")
        .aggregate([
          { $match: { _id: legadoComCampos.insertedId } },
          { $project: { tipoDiaSemana: { $type: "$diaSemana" } } },
        ])
        .next();
      expect(tipoInt?.tipoDiaSemana).toBe("int");

      const preservado = await db
        .collection("restricoes")
        .findOne({ _id: legadoComCampos.insertedId });
      expect(preservado).toMatchObject({
        diaSemana: 3,
        turno: "noturno",
        motivo: "evento familiar",
        observacao: "arquivo antigo preservado",
        instituicao: "Hospital Regional",
        tipoVinculo: "concursado",
      });

      const longo = await db
        .collection("restricoes")
        .findOne({ _id: legadoLongo.insertedId });
      expect(longo?.observacao).toBe("x".repeat(800));
      expect(longo?.diaSemana).toBe(4);

      const validatorDepoisUp = await db.command({
        listCollections: 1,
        filter: { name: "restricoes" },
        cursor: {},
      });
      const schemaDepoisUp =
        validatorDepoisUp.cursor.firstBatch[0].options.validator;
      expect(schemaDepoisUp.$jsonSchema.properties).toHaveProperty("turno");
      expect(schemaDepoisUp).not.toEqual(schemaAntes);

      await aplicarMigrations(banco.uri, "up", arquivo00009);
      const idempotente = await db
        .collection("restricoes")
        .findOne({ _id: legadoComCampos.insertedId });
      expect(idempotente).toMatchObject({
        turno: "noturno",
        motivo: "evento familiar",
        observacao: "arquivo antigo preservado",
      });
    } finally {
      await client.close();
      await banco.parar();
    }
  });

  it("00009: down() restaura o schema legado sem destruir dados e compara o validador antes/depois do rollback", async () => {
    const arquivo00009 = "20261101000009-restricoes-campos-estruturados.js";
    const { banco, client, db } = await criarBancoParaMigracao00009();

    try {
      const legado = await db.collection("restricoes").insertOne({
        profissionalId: new mongoose.Types.ObjectId(),
        tipo: "ferias",
        inicio: new Date("2026-10-10T00:00:00.000Z"),
        fim: new Date("2026-10-15T23:59:59.999Z"),
        diaSemana: new mongoose.mongo.Double(5),
        turno: "diurno",
        motivo: "evento familiar",
        observacao: "trecho legado para preservar",
        instituicao: "Hospital Central",
        tipoVinculo: "rpa",
      });

      const validatorAntes = await db.command({
        listCollections: 1,
        filter: { name: "restricoes" },
        cursor: {},
      });
      const schemaAntes = validatorAntes.cursor.firstBatch[0].options.validator;
      expect(schemaAntes.$jsonSchema.properties).not.toHaveProperty("turno");

      await aplicarMigrations(banco.uri, "up", arquivo00009);
      const documentoAntesDoRollback = await db
        .collection("restricoes")
        .findOne({ _id: legado.insertedId });
      expect(documentoAntesDoRollback).toMatchObject({
        diaSemana: 5,
        turno: "diurno",
        motivo: "evento familiar",
        observacao: "trecho legado para preservar",
        instituicao: "Hospital Central",
        tipoVinculo: "rpa",
      });

      const validatorDepoisDoUp = await db.command({
        listCollections: 1,
        filter: { name: "restricoes" },
        cursor: {},
      });
      const schemaDepoisDoUp =
        validatorDepoisDoUp.cursor.firstBatch[0].options.validator;
      expect(schemaDepoisDoUp.$jsonSchema.properties).toHaveProperty("turno");

      await aplicarMigrations(banco.uri, "down", arquivo00009);

      const validatorDepoisDoRollback = await db.command({
        listCollections: 1,
        filter: { name: "restricoes" },
        cursor: {},
      });
      const schemaDepoisDoRollback =
        validatorDepoisDoRollback.cursor.firstBatch[0].options.validator;

      expect(schemaDepoisDoRollback.$jsonSchema.properties).not.toHaveProperty(
        "turno",
      );
      expect(schemaDepoisDoRollback.$jsonSchema.properties.diaSemana).toEqual(
        schemaAntes.$jsonSchema.properties.diaSemana,
      );
      expect(schemaDepoisDoRollback.$jsonSchema.properties.observacao).toEqual({
        bsonType: ["string", "null"],
      });
      expect(schemaAntes.$jsonSchema.properties.observacao).toEqual({
        bsonType: "string",
      });

      const documento = await db
        .collection("restricoes")
        .findOne({ _id: legado.insertedId });
      expect(documento).toMatchObject({
        diaSemana: 5,
        turno: "diurno",
        motivo: "evento familiar",
        observacao: "trecho legado para preservar",
        instituicao: "Hospital Central",
        tipoVinculo: "rpa",
      });

      const tipoPersistido = await db
        .collection("restricoes")
        .aggregate([
          { $match: { _id: legado.insertedId } },
          { $project: { tipoDiaSemana: { $type: "$diaSemana" } } },
        ])
        .next();
      expect(tipoPersistido?.tipoDiaSemana).toBe("double");

      await expect(
        db.collection("restricoes").insertOne({
          profissionalId: new mongoose.Types.ObjectId(),
          tipo: "ausencia",
          inicio: new Date("2026-10-20T00:00:00.000Z"),
          fim: new Date("2026-10-22T23:59:59.999Z"),
          diaSemana: "seis",
        }),
      ).rejects.toThrow(/validation/i);
    } finally {
      await client.close();
      await banco.parar();
    }
  });

  it("up: migra escalas antigas e preserva snapshot das publicadas", async () => {
    await aplicarMigrations(banco.uri, "up");

    const escala = await db
      .collection("escalas")
      .findOne({ ano: 2026, mes: 10 });
    expect(escala).toMatchObject({
      status: "publicada",
      revisao: 1,
      versaoPublicada: 1,
    });
    const versao = await db
      .collection("versoesEscala")
      .findOne({ escalaId: escala?._id, numero: 1 });
    expect(versao).toMatchObject({
      ano: 2026,
      mes: 10,
      publicadoPor: escala?.administradorId,
      snapshot: {
        plantoes: [{ duracaoHoras: 24 }],
        profissionaisRelacionados: [{ funcao: "enfermeiro" }],
      },
    });
  });

  it("up: impede duplicar eventos de notificação do mesmo destinatário", async () => {
    await aplicarMigrations(banco.uri, "up");

    const escala = await db
      .collection("escalas")
      .findOne({ ano: 2026, mes: 10 });
    const base = {
      escalaId: escala?._id,
      versao: 1,
      destinatarioId: new mongoose.Types.ObjectId(),
      eventKey: "escala:2026-10:v1",
      titulo: "Escala publicada",
      mensagem: "A escala foi publicada.",
    };
    await db.collection("notificacoesEscala").insertOne(base);
    await expect(
      db.collection("notificacoesEscala").insertOne(base),
    ).rejects.toThrow(/duplicate key/i);
  });

  it("suporta transações confirmadas e rollback no banco de integração", async () => {
    const session = client.startSession();
    try {
      session.startTransaction();
      await db
        .collection("testeTransacao")
        .insertOne({ estado: "confirmado" }, { session });
      await session.commitTransaction();

      expect(
        await db
          .collection("testeTransacao")
          .countDocuments({ estado: "confirmado" }),
      ).toBe(1);

      session.startTransaction();
      await db
        .collection("testeTransacao")
        .insertOne({ estado: "revertido" }, { session });
      await session.abortTransaction();

      expect(
        await db
          .collection("testeTransacao")
          .countDocuments({ estado: "revertido" }),
      ).toBe(0);
    } finally {
      await session.endSession();
    }
  });

  it("é idempotente (pode ser reaplicada)", async () => {
    await expect(aplicarMigrations(banco.uri, "up")).resolves.toBeUndefined();
  });

  it("down: restaura o modelo anterior sem perder dados", async () => {
    await aplicarMigrations(banco.uri, "down");
    const setor = await db.collection("setores").findOne({ nome: "Bloco A" });
    expect(setor).toMatchObject({ quantMinEnf: 2, quantMinTec: 3 });
    expect(setor).not.toHaveProperty("turnos");
    const profissional = await db
      .collection("profissionaisDaSaude")
      .findOne({ coren: "COREN-CE 1" });
    expect(profissional?.status).toBe("desligado");
  });
});
