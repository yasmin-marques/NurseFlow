const { ensureCollection, setValidator, replaceIndex } = require('./lib');

const escalaValidator = {
  bsonType: 'object',
  required: ['administradorId', 'mes', 'ano', 'status', 'revisao', 'versaoPublicada'],
  properties: {
    administradorId: { bsonType: 'objectId' },
    mes: { bsonType: 'number', minimum: 1, maximum: 12 },
    ano: { bsonType: 'number', minimum: 2020 },
    status: { enum: ['rascunho', 'em_revisao', 'validada', 'publicada', 'finalizada'] },
    revisao: { bsonType: 'number', minimum: 1 },
    versaoPublicada: { bsonType: 'number', minimum: 0 },
    validacao: { bsonType: 'object' },
    dataCriacao: { bsonType: 'date' },
    geracao: { bsonType: 'object' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const versaoValidator = {
  bsonType: 'object',
  required: ['escalaId', 'numero', 'mes', 'ano', 'publicadoPor', 'publicadoEm', 'snapshot', 'pendenciasConfirmadas'],
  properties: {
    escalaId: { bsonType: 'objectId' },
    numero: { bsonType: 'number', minimum: 1 },
    mes: { bsonType: 'number', minimum: 1, maximum: 12 },
    ano: { bsonType: 'number', minimum: 2020 },
    publicadoPor: { bsonType: 'objectId' },
    publicadoEm: { bsonType: 'date' },
    snapshot: { bsonType: 'object' },
    pendenciasConfirmadas: { bsonType: 'bool' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const auditoriaValidator = {
  bsonType: 'object',
  required: ['escalaId', 'revisao', 'acao', 'usuarioId', 'ocorridoEm'],
  properties: {
    escalaId: { bsonType: 'objectId' },
    revisao: { bsonType: 'number', minimum: 1 },
    acao: { bsonType: 'string' },
    usuarioId: { bsonType: 'objectId' },
    ocorridoEm: { bsonType: 'date' },
    detalhes: { bsonType: 'object' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const notificacaoValidator = {
  bsonType: 'object',
  required: ['escalaId', 'versao', 'destinatarioId', 'eventKey', 'titulo', 'mensagem'],
  properties: {
    escalaId: { bsonType: 'objectId' },
    versao: { bsonType: 'number', minimum: 1 },
    destinatarioId: { bsonType: 'objectId' },
    eventKey: { bsonType: 'string' },
    titulo: { bsonType: 'string' },
    mensagem: { bsonType: 'string' },
    lidaEm: { bsonType: ['date', 'null'] },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

module.exports = {
  async up(db) {
    await db.collection('escalas').updateMany(
      { revisao: { $exists: false } },
      [
        {
          $set: {
            revisao: 1,
            versaoPublicada: {
              $cond: [{ $in: ['$status', ['publicada', 'finalizada']] }, 1, 0],
            },
          },
        },
      ],
    );

    await ensureCollection(db, 'versoesEscala');
    const publicadas = await db.collection('escalas')
      .find({ status: { $in: ['publicada', 'finalizada'] } })
      .toArray();
    for (const escala of publicadas) {
      const existe = await db.collection('versoesEscala').findOne({ escalaId: escala._id, numero: 1 });
      if (existe) continue;

      const plantoes = await db.collection('plantoes').find({ escalaId: escala._id }).toArray();
      const profissionaisRelacionados = plantoes.length
        ? await db.collection('profissionaisRelacionados')
          .find({ plantaoId: { $in: plantoes.map((plantao) => plantao._id) } })
          .toArray()
        : [];
      const data = escala.dataCriacao || escala.updatedAt || new Date();
      await db.collection('versoesEscala').insertOne({
        escalaId: escala._id,
        numero: 1,
        mes: escala.mes,
        ano: escala.ano,
        publicadoPor: escala.administradorId,
        publicadoEm: data,
        pendenciasConfirmadas: false,
        snapshot: {
          escala,
          plantoes,
          profissionaisRelacionados,
          pendencias: escala.geracao?.pendencias ?? [],
          conflitos: escala.geracao?.conflitos ?? [],
          avisos: escala.geracao?.avisos ?? [],
          cargas: escala.geracao?.cargas ?? [],
        },
        createdAt: data,
        updatedAt: data,
      });
    }

    await setValidator(db, 'escalas', escalaValidator);
    await setValidator(db, 'versoesEscala', versaoValidator);
    await setValidator(db, 'auditoriaEscalas', auditoriaValidator);
    await setValidator(db, 'notificacoesEscala', notificacaoValidator);
    await replaceIndex(db, 'versoesEscala', 'escalaId_1_numero_1', { escalaId: 1, numero: 1 }, { unique: true });
    await replaceIndex(db, 'versoesEscala', 'ano_1_mes_1_numero_1', { ano: 1, mes: 1, numero: 1 }, {});
    await replaceIndex(db, 'auditoriaEscalas', 'escalaId_1_ocorridoEm_-1', { escalaId: 1, ocorridoEm: -1 }, {});
    await replaceIndex(db, 'notificacoesEscala', 'destinatarioId_1_createdAt_-1', { destinatarioId: 1, createdAt: -1 }, {});
    await replaceIndex(
      db,
      'notificacoesEscala',
      'eventKey_1_destinatarioId_1',
      { eventKey: 1, destinatarioId: 1 },
      { unique: true },
    );
  },

  async down(db) {
    await db.collection('escalas').updateMany(
      { status: { $in: ['em_revisao', 'validada'] } },
      { $set: { status: 'rascunho' } },
    );
    await setValidator(db, 'escalas', {
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
    });
  },
};
