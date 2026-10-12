// Cria a primeira conta de Coordenação (não há outro meio de obter um login inicial).
// Uso: npm run seed:coordenacao   (lê SEED_COORDENACAO_* e MONGODB_URI do .env)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

function exigir(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} no .env`);
  return valor;
}

async function main() {
  const nome = exigir('SEED_COORDENACAO_NOME');
  const email = exigir('SEED_COORDENACAO_EMAIL').trim().toLowerCase();
  const cpf = exigir('SEED_COORDENACAO_CPF').replace(/\D/g, '');
  const senha = exigir('SEED_COORDENACAO_SENHA');
  if (senha.length < 8 || senha.length > 72) throw new Error('SEED_COORDENACAO_SENHA deve ter de 8 a 72 caracteres.');

  const client = new MongoClient(exigir('MONGODB_URI'));
  await client.connect();
  try {
    const db = client.db();
    if (await db.collection('usuarios').findOne({ $or: [{ email }, { cpf }] })) {
      console.log(`Já existe um usuário com o e-mail ${email} ou o CPF informado. Nada foi alterado.`);
      return;
    }
    const agora = new Date();
    const { insertedId } = await db.collection('usuarios').insertOne({
      nome,
      email,
      cpf,
      senha: await bcrypt.hash(senha, 10),
      tipoUsuario: 'administrador',
      senhaTemporaria: false,
      tentativasFalhasLogin: 0,
      bloqueadoAte: null,
      ultimoLoginEm: null,
      createdAt: agora,
      updatedAt: agora,
    });
    await db.collection('administradores').insertOne({ usuarioId: insertedId });
    console.log(`Coordenação criada: ${email}`);
  } finally {
    await client.close();
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
