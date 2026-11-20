const { setValidator, replaceIndex } = require('./lib');

// Integração com o Google Agenda (RU015, RU022, RF013, US17, RNF008, DA27).
// Os tokens ficam cifrados (AES-256-GCM) em `refreshTokenCifrado`; nunca em claro.

const integracoes = {
  bsonType: 'object',
  required: ['profissionalId', 'status', 'conectadaEm'],
  properties: {
    profissionalId: { bsonType: 'objectId' },
    status: { enum: ['conectada', 'desativada', 'reconexao_necessaria'] },
    refreshTokenCifrado: { bsonType: ['string', 'null'] },
    escopo: { bsonType: 'string' },
    calendarId: { bsonType: 'string' },
    conectadaEm: { bsonType: 'date' },
    desativadaEm: { bsonType: ['date', 'null'] },
    ultimaSincronizacaoEm: { bsonType: ['date', 'null'] },
    ultimoResultado: { bsonType: ['object', 'null'] },
    lockToken: { bsonType: ['string', 'null'] },
    lockExpiraEm: { bsonType: ['date', 'null'] },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const eventos = {
  bsonType: 'object',
  required: ['profissionalId', 'plantaoId', 'googleEventId', 'status', 'inicio', 'fim', 'sincronizadoEm'],
  properties: {
    profissionalId: { bsonType: 'objectId' },
    plantaoId: { bsonType: 'objectId' },
    googleEventId: { bsonType: 'string' },
    status: { enum: ['sincronizado', 'removido'] },
    hashConteudo: { bsonType: 'string' },
    inicio: { bsonType: 'date' },
    fim: { bsonType: 'date' },
    sincronizadoEm: { bsonType: 'date' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const tarefas = {
  bsonType: 'object',
  required: ['profissionalId', 'origem', 'status', 'tentativas', 'proximaTentativaEm', 'criadaEm'],
  properties: {
    profissionalId: { bsonType: 'objectId' },
    origem: { enum: ['publicacao', 'troca', 'conexao'] },
    status: { enum: ['pendente', 'processando', 'concluida', 'falha', 'cancelada'] },
    tentativas: { bsonType: ['int', 'long', 'double'], minimum: 0 },
    proximaTentativaEm: { bsonType: 'date' },
    bloqueadaAte: { bsonType: ['date', 'null'] },
    ultimoErro: { bsonType: ['string', 'null'] },
    criadaEm: { bsonType: 'date' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const estados = {
  bsonType: 'object',
  required: ['stateHash', 'profissionalId', 'expiraEm'],
  properties: {
    stateHash: { bsonType: 'string' },
    profissionalId: { bsonType: 'objectId' },
    expiraEm: { bsonType: 'date' },
    usadoEm: { bsonType: ['date', 'null'] },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

module.exports = {
  async up(db) {
    await setValidator(db, 'integracoesGoogleAgenda', integracoes);
    await replaceIndex(db, 'integracoesGoogleAgenda', 'profissionalId_1', { profissionalId: 1 }, { unique: true });

    await setValidator(db, 'eventosGoogleAgenda', eventos);
    await replaceIndex(db, 'eventosGoogleAgenda', 'profissionalId_1_plantaoId_1', { profissionalId: 1, plantaoId: 1 }, { unique: true });

    await setValidator(db, 'tarefasGoogleAgenda', tarefas);
    await replaceIndex(db, 'tarefasGoogleAgenda', 'status_1_proximaTentativaEm_1', { status: 1, proximaTentativaEm: 1 }, {});
    await replaceIndex(db, 'tarefasGoogleAgenda', 'profissionalId_1_status_1', { profissionalId: 1, status: 1 }, {});

    await setValidator(db, 'estadosOauthGoogle', estados);
    await replaceIndex(db, 'estadosOauthGoogle', 'stateHash_1', { stateHash: 1 }, { unique: true });
    // O `state` expira sozinho (TTL) logo após `expiraEm`.
    await replaceIndex(db, 'estadosOauthGoogle', 'expiraEm_1', { expiraEm: 1 }, { expireAfterSeconds: 0 });
  },

  async down(db) {
    // Preserva os dados (conexões, eventos exportados e fila) e apenas remove a pressão de validação,
    // para que um rollback do código não apague vínculos já criados no Google Agenda.
    for (const name of ['integracoesGoogleAgenda', 'eventosGoogleAgenda', 'tarefasGoogleAgenda', 'estadosOauthGoogle']) {
      const existing = await db.listCollections({ name }).toArray();
      if (existing.length) {
        await db.command({ collMod: name, validator: { $jsonSchema: { bsonType: 'object' } }, validationLevel: 'strict', validationAction: 'error' });
      }
    }
  },
};
