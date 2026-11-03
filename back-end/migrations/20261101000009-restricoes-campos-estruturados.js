const { setValidator } = require("./lib");

const schema = {
  bsonType: "object",
  required: ["profissionalId", "tipo", "inicio", "fim"],
  properties: {
    profissionalId: { bsonType: "objectId" },
    tipo: {
      bsonType: "string",
      enum: [
        "disponivel",
        "indisponivel",
        "ferias",
        "ausencia",
        "vinculo_externo",
      ],
    },
    inicio: { bsonType: "date" },
    fim: { bsonType: "date" },
    diaSemana: {
      bsonType: ["number", "null"],
      minimum: 0,
      maximum: 6,
      multipleOf: 1,
    },
    turno: { bsonType: ["string", "null"] },
    motivo: { bsonType: ["string", "null"], maxLength: 120 },
    observacao: { bsonType: ["string", "null"] },
    instituicao: { bsonType: ["string", "null"], maxLength: 120 },
    tipoVinculo: { bsonType: ["string", "null"], maxLength: 120 },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
  },
};

module.exports = {
  async up(db) {
    await setValidator(db, "restricoes", schema);

    const campos = [
      "diaSemana",
      "turno",
      "motivo",
      "observacao",
      "instituicao",
      "tipoVinculo",
    ];
    await db
      .collection("restricoes")
      .updateMany(
        { $or: campos.map((campo) => ({ [campo]: { $exists: false } })) },
        [
          {
            $set: Object.fromEntries(
              campos.map((campo) => [campo, { $ifNull: [`$${campo}`, null] }]),
            ),
          },
        ],
      );
  },

  async down(db) {
    // Rollback seguro: restaura o contrato anterior à migração 00009 sem
    // remover campos ou documentos. A coleção já tinha os campos de negócio
    // antigos e o novo schema era apenas um enriquecimento de validação.
    const legacySchema = {
      bsonType: "object",
      required: ["profissionalId", "tipo", "inicio", "fim"],
      properties: {
        profissionalId: { bsonType: "objectId" },
        tipo: {
          bsonType: "string",
          enum: [
            "disponivel",
            "indisponivel",
            "ferias",
            "ausencia",
            "vinculo_externo",
          ],
        },
        inicio: { bsonType: "date" },
        fim: { bsonType: "date" },
        diaSemana: {
          bsonType: ["number", "null"],
          minimum: 0,
          maximum: 6,
          multipleOf: 1,
        },
        observacao: { bsonType: ["string", "null"] },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    };

    await setValidator(db, "restricoes", legacySchema);
  },
};
