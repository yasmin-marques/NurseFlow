const { ensureCollection, setValidator, replaceIndex } = require('./lib');

const professionalEventValidator = {
  bsonType: 'object',
  required: ['solicitacaoId', 'atorUsuarioId', 'atorProfissionalId', 'acao', 'estadoAnterior', 'estadoNovo', 'operacaoId', 'assinaturaOperacao', 'resumoSeguro', 'ocorridoEm'],
  properties: {
    solicitacaoId: { bsonType: 'objectId' }, atorUsuarioId: { bsonType: 'objectId' }, atorProfissionalId: { bsonType: 'objectId' },
    acao: { enum: ['solicitada', 'aceita', 'recusada_pelo_profissional', 'cancelada'] },
    estadoAnterior: { enum: ['nova', 'aguardando_resposta', 'aguardando_coordenacao', 'recusada_pelo_profissional', 'cancelada'] },
    estadoNovo: { enum: ['aguardando_resposta', 'aguardando_coordenacao', 'recusada_pelo_profissional', 'cancelada'] },
    operacaoId: { bsonType: 'string' }, assinaturaOperacao: { bsonType: 'string' }, resumoSeguro: { bsonType: 'object' }, ocorridoEm: { bsonType: 'date' },
    createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
  },
};

module.exports = {
  async up(db) {
    const swap = await db.collection('solicitacoesTroca');
    await db.command({ collMod: 'solicitacoesTroca', validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['status', 'mes', 'ano', 'solicitanteProfissionalId', 'profissionalSolicitadoId', 'vinculoSolicitanteId', 'vinculoSolicitadoId', 'criadaEm'],
      properties: {
        status: { enum: ['aguardando_resposta', 'aguardando_coordenacao', 'recusada_pelo_profissional', 'aprovada', 'recusada_pela_coordenacao', 'cancelada'] },
        mes: { bsonType: 'number', minimum: 1, maximum: 12 }, ano: { bsonType: 'number', minimum: 1, maximum: 9999 },
        solicitanteProfissionalId: { bsonType: 'objectId' }, profissionalSolicitadoId: { bsonType: 'objectId' },
        vinculoSolicitanteId: { bsonType: 'objectId' }, vinculoSolicitadoId: { bsonType: 'objectId' }, criadaEm: { bsonType: 'date' },
        aceite: { bsonType: ['object', 'null'] }, decisaoCoordenacao: { bsonType: ['object', 'null'] }, chaveIdempotencia: { bsonType: ['string', 'null'] },
        resumoOriginal: { bsonType: 'object' }, cancelamento: { bsonType: 'object' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
      },
    } }, validationLevel: 'strict', validationAction: 'error' });
    await replaceIndex(db, 'solicitacoesTroca', 'solicitanteProfissionalId_1_status_1_updatedAt_-1', { solicitanteProfissionalId: 1, status: 1, updatedAt: -1 }, {});
    await replaceIndex(db, 'solicitacoesTroca', 'profissionalSolicitadoId_1_status_1_updatedAt_-1', { profissionalSolicitadoId: 1, status: 1, updatedAt: -1 }, {});
    await ensureCollection(db, 'eventosTrocaProfissional');
    await setValidator(db, 'eventosTrocaProfissional', professionalEventValidator);
    await replaceIndex(db, 'eventosTrocaProfissional', 'atorUsuarioId_1_operacaoId_1', { atorUsuarioId: 1, operacaoId: 1 }, { unique: true });
    await replaceIndex(db, 'eventosTrocaProfissional', 'solicitacaoId_1_ocorridoEm_1', { solicitacaoId: 1, ocorridoEm: 1 }, {});
  },
  async down(db) {
    // Preserve all professional requests, events and notifications on rollback.
    const exists = await db.listCollections({ name: 'eventosTrocaProfissional' }).toArray();
    if (exists.length) await db.command({ collMod: 'eventosTrocaProfissional', validator: { $jsonSchema: { bsonType: 'object' } }, validationLevel: 'strict', validationAction: 'error' });
  },
};
