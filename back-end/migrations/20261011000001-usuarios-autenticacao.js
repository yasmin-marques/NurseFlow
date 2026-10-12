const { setValidator, replaceIndex } = require('./lib');

/**
 * DA01 — autenticação.
 *  - `telefone` deixa de ser obrigatório (a tela de cadastro de profissional não o coleta).
 *  - Novos campos opcionais: controle de bloqueio por tentativas inválidas, último login,
 *    token de redefinição de senha (somente o hash) e flag de senha temporária.
 *  - Timestamps de criação/atualização.
 */
const baseProperties = {
  nome: { bsonType: 'string' },
  email: { bsonType: 'string', pattern: '^.+@.+\\..+$' },
  senha: { bsonType: 'string' },
  cpf: { bsonType: 'string', pattern: '^[0-9]{11}$' },
  telefone: { bsonType: 'string' },
  tipoUsuario: { bsonType: 'string', enum: ['administrador', 'profissionalDaSaude'] },
};

module.exports = {
  async up(db) {
    await setValidator(db, 'usuarios', {
      bsonType: 'object',
      required: ['nome', 'email', 'senha', 'cpf', 'tipoUsuario'],
      properties: {
        ...baseProperties,
        senhaTemporaria: { bsonType: 'bool' },
        tentativasFalhasLogin: { bsonType: 'number', minimum: 0 },
        bloqueadoAte: { bsonType: ['date', 'null'] },
        ultimoLoginEm: { bsonType: ['date', 'null'] },
        redefinicaoSenha: {
          bsonType: ['object', 'null'],
          properties: {
            tokenHash: { bsonType: 'string' },
            expiraEm: { bsonType: 'date' },
          },
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    });

    await db.collection('usuarios').createIndex({ email: 1 }, { unique: true });
    await db.collection('usuarios').createIndex({ cpf: 1 }, { unique: true });
    await db.collection('administradores').createIndex({ usuarioId: 1 }, { unique: true });
    await replaceIndex(db, 'usuarios', 'redefinicaoSenha.tokenHash_1', { 'redefinicaoSenha.tokenHash': 1 }, { sparse: true });
  },

  async down(db) {
    await db.collection('usuarios').dropIndex('redefinicaoSenha.tokenHash_1').catch(() => undefined);
    await setValidator(db, 'usuarios', {
      bsonType: 'object',
      required: ['nome', 'email', 'senha', 'cpf', 'telefone', 'tipoUsuario'],
      properties: baseProperties,
    });
  },
};
