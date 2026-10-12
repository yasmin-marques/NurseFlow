const { ensureCollection, setValidator, replaceIndex } = require('./lib');
module.exports = {
 async up(db) {
  await ensureCollection(db, 'configuracoes'); await ensureCollection(db, 'restricoes');
  await setValidator(db, 'configuracoes', { bsonType: 'object', required: ['chave'], properties: {
   chave: { bsonType: 'string' }, limiteTrocas: { bsonType: 'number', minimum: 0 },
   maxExtras: { bsonType: 'number', minimum: 0 }, limitePlantoes: { bsonType: 'number', minimum: 0 },
   cargas: { bsonType: 'object' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' } } });
  await setValidator(db, 'restricoes', { bsonType: 'object', required: ['profissionalId', 'tipo', 'inicio', 'fim'], properties: {
   profissionalId: { bsonType: 'objectId' }, tipo: { enum: ['disponivel', 'indisponivel', 'ferias', 'ausencia', 'vinculo_externo'] },
   inicio: { bsonType: 'date' }, fim: { bsonType: 'date' }, diaSemana: { bsonType: ['int', 'null'], minimum: 0, maximum: 6 },
   observacao: { bsonType: 'string' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' } } });
  await replaceIndex(db, 'configuracoes', 'chave_1', { chave: 1 }, { unique: true });
  await replaceIndex(db, 'restricoes', 'profissionalId_1_inicio_1', { profissionalId: 1, inicio: 1 }, {});
 },
 async down(db) { await db.collection('restricoes').drop(); await db.collection('configuracoes').drop(); }
};
