const { setValidator } = require('./lib');

// Substitui os validadores de período das migrations anteriores sem editá-las.
const escalaValidator = (minimum) => ({
  bsonType: 'object',
  required: ['administradorId', 'mes', 'ano', 'status', 'revisao', 'versaoPublicada'],
  properties: {
    administradorId: { bsonType: 'objectId' },
    mes: { bsonType: 'number', minimum: 1, maximum: 12 },
    ano: { bsonType: 'number', minimum, maximum: 9999 },
    status: { enum: ['rascunho', 'em_revisao', 'validada', 'publicada', 'finalizada'] },
    revisao: { bsonType: 'number', minimum: 1 },
    versaoPublicada: { bsonType: 'number', minimum: 0 },
    validacao: { bsonType: 'object' },
    dataCriacao: { bsonType: 'date' },
    geracao: { bsonType: 'object' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
});

const versaoValidator = (minimum) => ({
  bsonType: 'object',
  required: ['escalaId', 'numero', 'mes', 'ano', 'publicadoPor', 'publicadoEm', 'snapshot', 'pendenciasConfirmadas'],
  properties: {
    escalaId: { bsonType: 'objectId' },
    numero: { bsonType: 'number', minimum: 1 },
    mes: { bsonType: 'number', minimum: 1, maximum: 12 },
    ano: { bsonType: 'number', minimum, maximum: 9999 },
    publicadoPor: { bsonType: 'objectId' },
    publicadoEm: { bsonType: 'date' },
    snapshot: { bsonType: 'object' },
    pendenciasConfirmadas: { bsonType: 'bool' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
});

module.exports = {
  async up(db) {
    await setValidator(db, 'escalas', escalaValidator(1));
    await setValidator(db, 'versoesEscala', versaoValidator(1));
  },

  async down(db) {
    await setValidator(db, 'escalas', escalaValidator(2020));
    await setValidator(db, 'versoesEscala', versaoValidator(2020));
  },
};
