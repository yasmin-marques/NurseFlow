/* eslint-disable no-console */
const { MongoClient } = require('mongodb');

function fail(message) { throw new Error(message); }
const uri = process.env.EXTRAS_HOMOLOG_MONGODB_URI;
if (process.env.NODE_ENV === 'production') fail('Limpeza recusada em NODE_ENV=production.');
if (process.env.EXTRAS_HOMOLOG_CONFIRM !== 'DELETE_EXCLUSIVE_DATABASE') fail('Defina EXTRAS_HOMOLOG_CONFIRM=DELETE_EXCLUSIVE_DATABASE para confirmar.');
if (!uri) fail('EXTRAS_HOMOLOG_MONGODB_URI é obrigatório.');
const parsed = new URL(uri);
const dbName = parsed.pathname.replace(/^\//, '');
if (!/^nurseflow_extras_homolog_[a-z0-9_]+$/.test(dbName) || parsed.searchParams.get('replicaSet') !== 'rs0') {
  fail('A limpeza aceita apenas um banco nurseflow_extras_homolog_<identificador> com replicaSet=rs0.');
}

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  await client.db(dbName).dropDatabase();
  await client.close();
  console.log(`Base exclusiva ${dbName} removida.`);
})().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
