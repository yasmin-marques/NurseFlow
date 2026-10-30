const { ensureCollection, setValidator, replaceIndex } = require('./lib');

/**
 * RF005/US07 — geração automática de escalas.
 *
 * Reconcilia as coleções escalas, plantoes e profissionaisRelacionados (criadas pelo antigo
 * db/mongo/script.js) com o que a API grava. O validator legado de profissionaisRelacionados exigia
 * `profissionalID` (typo) enquanto a propriedade declarada era `profissionalId`, o que rejeitaria
 * qualquer inserção. Números usam `bsonType: 'number'` (o driver pode serializar inteiros como int ou double).
 *
 * Não apaga dados nem índices existentes. O índice único (ano, mes) impede escalas duplicadas no período.
 */
const escala = {
  bsonType: 'object',
  required: ['administradorId', 'mes', 'ano', 'status'],
  properties: {
    administradorId: { bsonType: 'objectId' },
    mes: { bsonType: 'number', minimum: 1, maximum: 12 },
    ano: { bsonType: 'number', minimum: 2020 },
    status: { bsonType: 'string', enum: ['rascunho', 'publicada', 'finalizada'] },
    dataCriacao: { bsonType: 'date' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const plantao = {
  bsonType: 'object',
  required: ['escalaId', 'setorId', 'data', 'horarioInicio', 'horarioFim', 'tipo'],
  properties: {
    escalaId: { bsonType: 'objectId' },
    setorId: { bsonType: 'objectId' },
    data: { bsonType: 'date' },
    horarioInicio: { bsonType: 'string' },
    horarioFim: { bsonType: 'string' },
    duracaoHoras: { bsonType: 'number', minimum: 1 },
    tipo: { bsonType: 'string', enum: ['regular', 'extra'] },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const profissionalRelacionado = {
  bsonType: 'object',
  required: ['plantaoId', 'profissionalId'],
  properties: {
    plantaoId: { bsonType: 'objectId' },
    profissionalId: { bsonType: 'objectId' },
    funcao: { bsonType: 'string', enum: ['enfermeiro', 'tecnico'] },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

module.exports = {
  async up(db) {
    await setValidator(db, 'escalas', escala);
    await setValidator(db, 'plantoes', plantao);
    await setValidator(db, 'profissionaisRelacionados', profissionalRelacionado);

    await replaceIndex(db, 'escalas', 'ano_1_mes_1', { ano: 1, mes: 1 }, { unique: true });
    await replaceIndex(db, 'plantoes', 'escalaId_1_data_1', { escalaId: 1, data: 1 }, {});
    await replaceIndex(db, 'profissionaisRelacionados', 'plantaoId_1_profissionalId_1', { plantaoId: 1, profissionalId: 1 }, { unique: true });
  },

  async down(db) {
    await ensureCollection(db, 'escalas');
    await db.collection('escalas').dropIndex('ano_1_mes_1').catch(() => undefined);
    await db.collection('plantoes').dropIndex('escalaId_1_data_1').catch(() => undefined);
  },
};
