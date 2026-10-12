const { setValidator, replaceIndex } = require('./lib');

/**
 * DA07 / DA08: o quantitativo mínimo é definido por turno (diurno e noturno).
 * O modelo anterior tinha apenas `quantMinEnf` / `quantMinTec` por setor.
 *
 *  - `turnos.{diurno,noturno}.{enfermeiros,tecnicos}` substitui os campos planos
 *    (valores existentes são copiados para os dois turnos).
 *  - `ativo` permite a inativação do setor sem exclusão.
 *  - O índice único de `nome` passa a ignorar maiúsculas/acentos (collation strength 1).
 */
const quantitativo = {
  bsonType: 'object',
  required: ['enfermeiros', 'tecnicos'],
  properties: {
    enfermeiros: { bsonType: 'number', minimum: 0 },
    tecnicos: { bsonType: 'number', minimum: 0 },
  },
};

module.exports = {
  async up(db) {
    const col = db.collection('setores');
    await setValidator(db, 'setores', { bsonType: 'object' }); // libera durante a conversão

    await col.updateMany({ turnos: { $exists: false } }, [
      {
        $set: {
          turnos: {
            diurno: { enfermeiros: { $ifNull: ['$quantMinEnf', 0] }, tecnicos: { $ifNull: ['$quantMinTec', 0] } },
            noturno: { enfermeiros: { $ifNull: ['$quantMinEnf', 0] }, tecnicos: { $ifNull: ['$quantMinTec', 0] } },
          },
          ativo: { $ifNull: ['$ativo', true] },
          createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
          updatedAt: '$$NOW',
        },
      },
      { $unset: ['quantMinEnf', 'quantMinTec'] },
    ]);

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

    await replaceIndex(db, 'setores', 'nome_1', { nome: 1 }, { unique: true, collation: { locale: 'pt', strength: 1 } });
  },

  async down(db) {
    const col = db.collection('setores');
    await setValidator(db, 'setores', { bsonType: 'object' });
    // O modelo antigo não distingue turnos: preserva o maior valor entre diurno e noturno.
    await col.updateMany({ turnos: { $exists: true } }, [
      {
        $set: {
          quantMinEnf: { $max: ['$turnos.diurno.enfermeiros', '$turnos.noturno.enfermeiros'] },
          quantMinTec: { $max: ['$turnos.diurno.tecnicos', '$turnos.noturno.tecnicos'] },
        },
      },
      { $unset: ['turnos', 'ativo', 'createdAt', 'updatedAt'] },
    ]);
    await setValidator(db, 'setores', {
      bsonType: 'object',
      required: ['nome', 'quantMinEnf', 'quantMinTec'],
      properties: {
        nome: { bsonType: 'string' },
        quantMinEnf: { bsonType: 'int' },
        quantMinTec: { bsonType: 'int' },
        descricao: { bsonType: 'string' },
      },
    });
    await replaceIndex(db, 'setores', 'nome_1', { nome: 1 }, { unique: true });
  },
};
