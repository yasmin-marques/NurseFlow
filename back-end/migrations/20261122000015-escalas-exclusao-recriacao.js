const { replaceIndex } = require('./lib');

const estadosAtivos = ['rascunho', 'em_revisao', 'validada', 'publicada', 'finalizada'];

async function atualizarStatusExcluida(db) {
  const [colecao] = await db.listCollections({ name: 'escalas' }).toArray();
  const esquema = colecao?.options?.validator?.$jsonSchema;
  const status = esquema?.properties?.status;
  if (!esquema || !Array.isArray(status?.enum)) {
    throw new Error('O validator da coleção escalas não possui o enum de status esperado.');
  }

  const esquemaAtualizado = {
    ...esquema,
    properties: {
      ...esquema.properties,
      status: { ...status, enum: [...new Set([...status.enum, 'excluida'])] },
    },
  };
  await db.command({
    collMod: 'escalas',
    validator: { $jsonSchema: esquemaAtualizado },
    validationLevel: 'strict',
    validationAction: 'error',
  });
}

module.exports = {
  async up(db) {
    await atualizarStatusExcluida(db);
    await replaceIndex(
      db,
      'escalas',
      'ano_1_mes_1',
      { ano: 1, mes: 1 },
      { unique: true, partialFilterExpression: { status: { $in: estadosAtivos } } },
    );
  },

  async down(db) {
    const duplicadas = await db.collection('escalas').aggregate([
      { $group: { _id: { ano: '$ano', mes: '$mes' }, total: { $sum: 1 } } },
      { $match: { total: { $gt: 1 } } },
      { $limit: 1 },
    ]).toArray();
    if (duplicadas.length > 0) {
      throw new Error('Não é possível reverter o índice: existem períodos com escalas excluídas e ativas.');
    }

    await replaceIndex(db, 'escalas', 'ano_1_mes_1', { ano: 1, mes: 1 }, { unique: true });
  },
};
