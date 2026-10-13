/**
 * Corrige a validação da coleção restricoes em bancos já existentes.
 * Não recria a coleção, não exclui índices e não altera documentos.
 *
 * O antigo db/mongo/script.js exigia administradorCriadorId/horarioInicio/horarioFim,
 * enquanto o NestJS atual grava tipo/inicio/fim.
 *
 * A migration 00004 já faz a transição; esta migration reaplica explicitamente
 * o contrato mais recente e aceita qualquer representação BSON numérica inteira
 * para diaSemana (o cliente MongoDB pode serializar Number como int ou double).
 */
const { setValidator } = require('./lib');

const base = {
  bsonType: 'object',
  required: ['profissionalId', 'tipo', 'inicio', 'fim'],
  properties: {
    profissionalId: { bsonType: 'objectId' },
    tipo: {
      bsonType: 'string',
      enum: ['disponivel', 'indisponivel', 'ferias', 'ausencia', 'vinculo_externo'],
    },
    inicio: { bsonType: 'date' },
    fim: { bsonType: 'date' },
    diaSemana: { bsonType: ['number', 'null'], minimum: 0, maximum: 6, multipleOf: 1 },
    observacao: { bsonType: 'string' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const anterior = {
  ...base,
  properties: {
    ...base.properties,
    // Representação usada pela migration 00004.
    diaSemana: { bsonType: ['int', 'null'], minimum: 0, maximum: 6 },
  },
};

module.exports = {
  async up(db) {
    await setValidator(db, 'restricoes', base);
  },
  async down(db) {
    // Rollback sem destruir a coleção nem os dados.
    await setValidator(db, 'restricoes', anterior);
  },
};
