// Etapa 2 da migração do setor fixo: torna `setorId` obrigatório no validator de profissionaisDaSaude.
// Só aplica se NÃO houver profissional sem setor (nem com setor inexistente); caso contrário lista as pendências
// e termina com código 1, sem alterar nada.  Uso: npm run db:setor-fixo:exigir   (--listar: só lista as pendências)
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { setValidator } = require('../migrations/lib');

const required = ['usuarioId', 'coren', 'tipoVinculo', 'status', 'formacao', 'sincronizaAgenda', 'setorId'];
const properties = {
  usuarioId: { bsonType: 'objectId' },
  coren: { bsonType: 'string' },
  status: { bsonType: 'string', enum: ['ativo', 'desativado', 'afastado', 'ferias'] },
  tipoVinculo: { bsonType: 'string', enum: ['concursado', 'clt', 'rpa'] },
  formacao: { bsonType: 'string', enum: ['tecnico', 'enfermeiro'] },
  sincronizaAgenda: { bsonType: 'bool' },
  desativadoEm: { bsonType: ['date', 'null'] },
  createdAt: { bsonType: 'date' },
  updatedAt: { bsonType: 'date' },
  setorId: { bsonType: 'objectId' },
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente');
  const somenteListar = process.argv.includes('--listar');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const setores = new Set((await db.collection('setores').find({}, { projection: { _id: 1 } }).toArray()).map((s) => String(s._id)));
    const profissionais = await db.collection('profissionaisDaSaude').find({}).toArray();
    const pendentes = profissionais.filter((p) => !p.setorId || !setores.has(String(p.setorId)));
    if (pendentes.length > 0) {
      const usuarios = await db.collection('usuarios')
        .find({ _id: { $in: pendentes.map((p) => p.usuarioId) } }, { projection: { nome: 1 } }).toArray();
      const nomes = new Map(usuarios.map((u) => [String(u._id), u.nome]));
      console.error(`${pendentes.length} de ${profissionais.length} profissional(is) sem setor fixo válido:`);
      for (const p of pendentes) console.error(` - ${p._id}  ${nomes.get(String(p.usuarioId)) ?? '(sem usuário)'}  COREN ${p.coren}  [${p.status}]`);
      console.error('Defina o setor de cada um (tela de Profissionais ou PATCH /profissionais/:id com { "setorId": "..." }) e execute novamente.');
      if (!somenteListar) process.exitCode = 1;
      return;
    }
    if (somenteListar) { console.log('Nenhuma pendência: todos os profissionais têm setor fixo válido.'); return; }
    await setValidator(db, 'profissionaisDaSaude', { bsonType: 'object', required, properties });
    console.log(`setorId agora é obrigatório no banco (${profissionais.length} profissional(is) verificados).`);
  } finally {
    await client.close();
  }
}

main().catch((erro) => { console.error(erro.message); process.exit(1); });
