const { setValidator } = require('./lib');

/**
 * DA04 / diagrama de classes: o status final do profissional é "Desativado" (e não "desligado").
 * Migra os registros existentes, troca o enum do validator e adiciona `desativadoEm` e timestamps.
 */
const properties = (statusEnum) => ({
  usuarioId: { bsonType: 'objectId' },
  coren: { bsonType: 'string' },
  status: { bsonType: 'string', enum: statusEnum },
  tipoVinculo: { bsonType: 'string', enum: ['concursado', 'clt', 'rpa'] },
  formacao: { bsonType: 'string', enum: ['tecnico', 'enfermeiro'] },
  sincronizaAgenda: { bsonType: 'bool' },
  desativadoEm: { bsonType: ['date', 'null'] },
  createdAt: { bsonType: 'date' },
  updatedAt: { bsonType: 'date' },
});

const required = ['usuarioId', 'coren', 'tipoVinculo', 'status', 'formacao', 'sincronizaAgenda'];

module.exports = {
  async up(db) {
    const col = db.collection('profissionaisDaSaude');
    // Aceita os dois valores durante a conversão dos dados e aperta o enum depois.
    await setValidator(db, 'profissionaisDaSaude', {
      bsonType: 'object',
      required,
      properties: properties(['ativo', 'afastado', 'ferias', 'desligado', 'desativado']),
    });
    await col.updateMany({ status: 'desligado' }, { $set: { status: 'desativado', desativadoEm: new Date() } });
    await setValidator(db, 'profissionaisDaSaude', {
      bsonType: 'object',
      required,
      properties: properties(['ativo', 'desativado', 'afastado', 'ferias']),
    });
    await col.createIndex({ coren: 1 }, { unique: true });
    await col.createIndex({ usuarioId: 1 }, { unique: true });
    await col.createIndex({ status: 1 });
  },

  async down(db) {
    const col = db.collection('profissionaisDaSaude');
    await setValidator(db, 'profissionaisDaSaude', {
      bsonType: 'object',
      required,
      properties: properties(['ativo', 'afastado', 'ferias', 'desligado', 'desativado']),
    });
    await col.updateMany({ status: 'desativado' }, { $set: { status: 'desligado' } });
    await setValidator(db, 'profissionaisDaSaude', {
      bsonType: 'object',
      required,
      properties: properties(['ativo', 'afastado', 'ferias', 'desligado']),
    });
  },
};
