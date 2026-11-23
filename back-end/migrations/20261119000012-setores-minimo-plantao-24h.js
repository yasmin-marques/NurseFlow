const { setValidator } = require('./lib');

const quantitativo = {
  bsonType: 'object',
  required: ['enfermeiros', 'tecnicos'],
  properties: {
    enfermeiros: { bsonType: 'number', minimum: 0 },
    tecnicos: { bsonType: 'number', minimum: 0 },
  },
};

const validator = {
  bsonType: 'object',
  required: ['nome', 'plantao24h', 'ativo'],
  properties: {
    nome: { bsonType: 'string' },
    descricao: { bsonType: 'string' },
    ativo: { bsonType: 'bool' },
    plantao24h: quantitativo,
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

module.exports = {
  async up(db) {
    const col = db.collection('setores');
    await setValidator(db, 'setores', { bsonType: 'object' });
    await col.updateMany(
      { turnos: { $exists: true } },
      [
        {
          $set: {
            plantao24h: {
              enfermeiros: {
                $ifNull: [
                  '$plantao24h.enfermeiros',
                  { $max: [{ $ifNull: ['$turnos.diurno.enfermeiros', 0] }, { $ifNull: ['$turnos.noturno.enfermeiros', 0] }] },
                ],
              },
              tecnicos: {
                $ifNull: [
                  '$plantao24h.tecnicos',
                  { $max: [{ $ifNull: ['$turnos.diurno.tecnicos', 0] }, { $ifNull: ['$turnos.noturno.tecnicos', 0] }] },
                ],
              },
            },
            updatedAt: '$$NOW',
          },
        },
        { $unset: 'turnos' },
      ],
    );
    await setValidator(db, 'setores', validator);
  },

  async down(db) {
    const col = db.collection('setores');
    await setValidator(db, 'setores', { bsonType: 'object' });
    await col.updateMany(
      { plantao24h: { $exists: true } },
      [
        {
          $set: {
            turnos: {
              diurno: '$plantao24h',
              noturno: '$plantao24h',
            },
          },
        },
        { $unset: 'plantao24h' },
      ],
    );
    await setValidator(db, 'setores', {
      bsonType: 'object',
      required: ['nome', 'turnos', 'ativo'],
      properties: {
        nome: { bsonType: 'string' },
        descricao: { bsonType: 'string' },
        ativo: { bsonType: 'bool' },
        turnos: {
          bsonType: 'object',
          required: ['diurno', 'noturno'],
          properties: { diurno: quantitativo, noturno: quantitativo },
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    });
  },
};
