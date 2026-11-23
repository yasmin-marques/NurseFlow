const { setValidator, replaceIndex } = require('./lib');

/**
 * Setor fixo do profissional (etapa 1 de 2).
 *
 * Adiciona `setorId` (referência a `setores._id`) ao cadastro de profissionais. Cada profissional tem um
 * único setor; um setor pode ter vários profissionais. Nesta etapa o campo é aceito como `null` porque
 * NÃO existia, no modelo anterior, nenhum vínculo cadastral entre profissional e setor (a escala não é fonte
 * do setor do profissional). Por isso nenhum setor é inferido: cadastros legados ficam pendentes (`setorId: null`),
 * não entram na geração de escalas e devem receber o setor pelo cadastro (PATCH /profissionais/:id).
 *
 * Etapa 2 (manual, só depois de zerar as pendências): `npm run db:setor-fixo:exigir`, que torna o campo
 * obrigatório no validator do banco. Ver README.
 */
const properties = (comSetor) => ({
  usuarioId: { bsonType: 'objectId' },
  coren: { bsonType: 'string' },
  status: { bsonType: 'string', enum: ['ativo', 'desativado', 'afastado', 'ferias'] },
  tipoVinculo: { bsonType: 'string', enum: ['concursado', 'clt', 'rpa'] },
  formacao: { bsonType: 'string', enum: ['tecnico', 'enfermeiro'] },
  sincronizaAgenda: { bsonType: 'bool' },
  desativadoEm: { bsonType: ['date', 'null'] },
  createdAt: { bsonType: 'date' },
  updatedAt: { bsonType: 'date' },
  ...(comSetor ? { setorId: { bsonType: ['objectId', 'null'] } } : {}),
});

const required = ['usuarioId', 'coren', 'tipoVinculo', 'status', 'formacao', 'sincronizaAgenda'];

module.exports = {
  async up(db) {
    await setValidator(db, 'profissionaisDaSaude', { bsonType: 'object', required, properties: properties(true) });
    await replaceIndex(db, 'profissionaisDaSaude', 'setorId_1', { setorId: 1 }, {});
  },

  async down(db) {
    // Preserva os dados já gravados: apenas remove a exigência do validator e o índice.
    await setValidator(db, 'profissionaisDaSaude', { bsonType: 'object', required, properties: properties(false) });
    const col = db.collection('profissionaisDaSaude');
    if ((await col.indexes()).some((i) => i.name === 'setorId_1')) await col.dropIndex('setorId_1');
  },
};
