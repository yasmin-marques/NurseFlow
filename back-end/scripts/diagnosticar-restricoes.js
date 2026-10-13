/** Apenas leitura. Executar dentro do container backend: node scripts/diagnosticar-restricoes.js */
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não configurada');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db();
    const [collection] = await db.listCollections({ name: 'restricoes' }).toArray();
    console.log('Banco:', db.databaseName);
    if (!collection) {
      console.error('A coleção restricoes ainda não existe. Verifique as migrations.');
      process.exitCode = 1;
      return;
    }
    const schema = collection.options?.validator?.$jsonSchema;
    const required = schema?.required || [];
    console.log('Campos obrigatórios:', JSON.stringify(required));
    console.log('Regra diaSemana:', JSON.stringify(schema?.properties?.diaSemana ?? null));
    console.log('Ação de validação:', collection.options?.validationAction ?? '(padrão)');
    console.log('Nível de validação:', collection.options?.validationLevel ?? '(padrão)');
    const obsolete = ['administradorCriadorId', 'horarioInicio', 'horarioFim'].filter((field) => required.includes(field));
    if (obsolete.length) {
      console.error('ERRO: schema legado ativo. Campos incompatíveis:', obsolete.join(', '));
      process.exitCode = 2;
    } else if (!['profissionalId', 'tipo', 'inicio', 'fim'].every((field) => required.includes(field))) {
      console.warn('ATENÇÃO: schema não corresponde ao contrato esperado.');
      process.exitCode = 2;
    } else {
      console.log('OK: campos obrigatórios correspondem ao backend atual.');
    }
    const history = await db.collection('migracoes')
      .find({}, { projection: { fileName: 1, _id: 0 } }).sort({ fileName: 1 }).toArray();
    console.log('Migrations registradas:', history.map((entry) => entry.fileName).join(', ') || '(nenhuma)');
  } finally {
    await client.close();
  }
}
main().catch((error) => {
  console.error('Falha ao diagnosticar:', error.message);
  process.exitCode = 1;
});
