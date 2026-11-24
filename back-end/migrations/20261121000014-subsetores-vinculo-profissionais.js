const { ensureCollection, setValidator, replaceIndex } = require('./lib');

/**
 * Subsetores e vínculo de profissionais.
 *
 * - Nova coleção `subsetores` (setorId, nome, plantao24h.tecnicos, ativo) com nome único por setor.
 * - `setores.possuiSubsetores` (propriedade opcional no validator: ausente equivale a false). Setores existentes não tinham subsetores: recebem `false`,
 *   e o mínimo de técnicos continua sendo o próprio `plantao24h.tecnicos` (sem perda de dados).
 *   Em setor com subsetores, `plantao24h.tecnicos` passa a ser derivado (soma dos subsetores ativos) e é mantido
 *   pela API, para que o módulo de escalas continue lendo a demanda de técnicos do setor sem alterações.
 * - `profissionaisDaSaude.subsetorId` (opcional, nulo por padrão). NENHUM subsetor é atribuído na migração:
 *   como nenhum subsetor existia, todos os vínculos atuais (setor direto) permanecem válidos. Cadastros que já eram
 *   pendentes de setor (setorId nulo) continuam pendentes — a migration só os reporta no log.
 *
 * Pendências futuras (técnico em setor que ganhou subsetores, subsetor de outro setor etc.) são listadas por
 * `npm run vinculos:pendencias`.
 */
async function validatorAtual(db, nome) {
  const [info] = await db.listCollections({ name: nome }).toArray();
  return info?.options?.validator?.$jsonSchema ?? { bsonType: 'object' };
}

const validatorSubsetores = {
  bsonType: 'object',
  required: ['setorId', 'nome', 'plantao24h', 'ativo'],
  properties: {
    setorId: { bsonType: 'objectId' },
    nome: { bsonType: 'string' },
    descricao: { bsonType: 'string' },
    ativo: { bsonType: 'bool' },
    plantao24h: {
      bsonType: 'object',
      required: ['tecnicos'],
      properties: { tecnicos: { bsonType: 'number', minimum: 0 } },
    },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

module.exports = {
  async up(db) {
    // 1) subsetores
    await setValidator(db, 'subsetores', validatorSubsetores);
    await replaceIndex(
      db,
      'subsetores',
      'setorId_1_nome_1',
      { setorId: 1, nome: 1 },
      { unique: true, collation: { locale: 'pt', strength: 1 } },
    );

    // 2) setores.possuiSubsetores (sem subsetores existentes => false)
    const setores = db.collection('setores');
    await setValidator(db, 'setores', { bsonType: 'object' });
    await setores.updateMany({ possuiSubsetores: { $exists: false } }, { $set: { possuiSubsetores: false } });
    await setValidator(db, 'setores', {
      bsonType: 'object',
      required: ['nome', 'plantao24h', 'ativo'],
      properties: {
        nome: { bsonType: 'string' },
        descricao: { bsonType: 'string' },
        ativo: { bsonType: 'bool' },
        possuiSubsetores: { bsonType: 'bool' },
        plantao24h: {
          bsonType: 'object',
          required: ['enfermeiros', 'tecnicos'],
          properties: {
            enfermeiros: { bsonType: 'number', minimum: 0 },
            tecnicos: { bsonType: 'number', minimum: 0 },
          },
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    });

    // 3) profissionais.subsetorId (opcional). Preserva o validator vigente e só acrescenta a propriedade.
    const atual = await validatorAtual(db, 'profissionaisDaSaude');
    await setValidator(db, 'profissionaisDaSaude', {
      ...atual,
      properties: { ...(atual.properties ?? {}), subsetorId: { bsonType: ['objectId', 'null'] } },
    });
    await replaceIndex(db, 'profissionaisDaSaude', 'subsetorId_1', { subsetorId: 1 }, {});
    await db.collection('profissionaisDaSaude').updateMany({ subsetorId: { $exists: false } }, { $set: { subsetorId: null } });

    const semSetor = await db.collection('profissionaisDaSaude').countDocuments({ $or: [{ setorId: null }, { setorId: { $exists: false } }] });
    if (semSetor > 0) {
      console.warn(
        `[subsetores] ${semSetor} profissional(is) continuam sem setor (pendência anterior): defina o setor pelo cadastro. ` +
          'Use "npm run vinculos:pendencias" para listar.',
      );
    }
  },

  async down(db) {
    // Preserva os dados: remove apenas a exigência/índice do campo novo. A coleção `subsetores` é mantida
    // (descartá-la apagaria dados de negócio); o campo possuiSubsetores e o subsetorId ficam inertes nos documentos.
    const atual = await validatorAtual(db, 'profissionaisDaSaude');
    const { subsetorId: _subsetorId, ...propriedades } = atual.properties ?? {};
    await setValidator(db, 'profissionaisDaSaude', { ...atual, properties: propriedades });
    const col = db.collection('profissionaisDaSaude');
    if ((await col.indexes()).some((i) => i.name === 'subsetorId_1')) await col.dropIndex('subsetorId_1');

    await ensureCollection(db, 'setores');
    await setValidator(db, 'setores', {
      bsonType: 'object',
      required: ['nome', 'plantao24h', 'ativo'],
      properties: {
        nome: { bsonType: 'string' },
        descricao: { bsonType: 'string' },
        ativo: { bsonType: 'bool' },
        plantao24h: {
          bsonType: 'object',
          required: ['enfermeiros', 'tecnicos'],
          properties: {
            enfermeiros: { bsonType: 'number', minimum: 0 },
            tecnicos: { bsonType: 'number', minimum: 0 },
          },
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    });
  },
};
