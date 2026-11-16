const { ensureCollection, setValidator, replaceIndex } = require('./lib');

const validator = {
  bsonType: 'object',
  required: ['status', 'mes', 'ano', 'solicitanteProfissionalId', 'profissionalSolicitadoId', 'vinculoSolicitanteId', 'vinculoSolicitadoId', 'criadaEm'],
  properties: {
    status: { enum: ['aguardando_resposta', 'aguardando_coordenacao', 'recusada_pelo_profissional', 'aprovada', 'recusada_pela_coordenacao'] },
    mes: { bsonType: 'number', minimum: 1, maximum: 12 },
    ano: { bsonType: 'number', minimum: 1, maximum: 9999 },
    solicitanteProfissionalId: { bsonType: 'objectId' },
    profissionalSolicitadoId: { bsonType: 'objectId' },
    vinculoSolicitanteId: { bsonType: 'objectId' },
    vinculoSolicitadoId: { bsonType: 'objectId' },
    criadaEm: { bsonType: 'date' },
    aceite: { bsonType: ['object', 'null'] },
    decisaoCoordenacao: { bsonType: ['object', 'null'] },
    chaveIdempotencia: { bsonType: ['string', 'null'] },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};
const auditValidator = {
  bsonType: 'object',
  required: ['solicitacaoId', 'usuarioId', 'resultado', 'decididaEm', 'operacaoId'],
  properties: {
    solicitacaoId: { bsonType: 'objectId' }, usuarioId: { bsonType: 'objectId' },
    resultado: { enum: ['aprovada', 'recusada'] }, decididaEm: { bsonType: 'date' },
    justificativa: { bsonType: 'string' }, vinculos: { bsonType: 'array' },
    versoesEscala: { bsonType: 'array' }, excecaoLimite: { bsonType: 'bool' }, operacaoId: { bsonType: 'string' },
    createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
  },
};
const notificationValidator = {
  bsonType: 'object', required: ['solicitacaoId', 'destinatarioId', 'eventKey', 'titulo', 'mensagem'],
  properties: { solicitacaoId: { bsonType: 'objectId' }, destinatarioId: { bsonType: 'objectId' }, eventKey: { bsonType: 'string' },
    titulo: { bsonType: 'string' }, mensagem: { bsonType: 'string' }, lidaEm: { bsonType: ['date', 'null'] },
    createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' } },
};

module.exports = {
  async up(db) {
    await ensureCollection(db, 'solicitacoesTroca');
    await setValidator(db, 'solicitacoesTroca', validator);
    await replaceIndex(db, 'solicitacoesTroca', 'status_1_criadaEm_-1__id_-1', { status: 1, criadaEm: -1, _id: -1 }, {});
    await replaceIndex(db, 'solicitacoesTroca', 'status_1_ano_1_mes_1_criadaEm_-1', { status: 1, ano: 1, mes: 1, criadaEm: -1 }, {});
    await replaceIndex(db, 'solicitacoesTroca', 'vinculoSolicitanteId_1_status_1', { vinculoSolicitanteId: 1, status: 1 }, {});
    await replaceIndex(db, 'solicitacoesTroca', 'vinculoSolicitadoId_1_status_1', { vinculoSolicitadoId: 1, status: 1 }, {});
    await replaceIndex(db, 'solicitacoesTroca', 'chaveIdempotencia_1', { chaveIdempotencia: 1 }, { unique: true, sparse: true });
    await ensureCollection(db, 'auditoriaTrocas');
    await setValidator(db, 'auditoriaTrocas', auditValidator);
    await replaceIndex(db, 'auditoriaTrocas', 'solicitacaoId_1_createdAt_-1', { solicitacaoId: 1, createdAt: -1 }, {});
    await replaceIndex(db, 'auditoriaTrocas', 'operacaoId_1', { operacaoId: 1 }, { unique: true });
    await ensureCollection(db, 'notificacoesTroca');
    await setValidator(db, 'notificacoesTroca', notificationValidator);
    await replaceIndex(db, 'notificacoesTroca', 'eventKey_1_destinatarioId_1', { eventKey: 1, destinatarioId: 1 }, { unique: true });
    await replaceIndex(db, 'notificacoesTroca', 'destinatarioId_1_createdAt_-1', { destinatarioId: 1, createdAt: -1 }, {});
  },

  async down(db) {
    // Rollback removes validation pressure but preserves solicitudes, decisions,
    // audit records, events and uniqueness indexes already written.
    for (const name of ['solicitacoesTroca', 'auditoriaTrocas', 'notificacoesTroca']) {
      const existing = await db.listCollections({ name }).toArray();
      if (existing.length) await db.command({ collMod: name, validator: { $jsonSchema: { bsonType: 'object' } }, validationLevel: 'strict', validationAction: 'error' });
    }
  },
};
