// Utilitários compartilhados pelas migrations. Fica em subpasta para que o
// migrate-mongo não o trate como uma migration.

/** Cria a coleção caso ainda não exista (db/mongo/script.js só roda no primeiro start do container). */
async function ensureCollection(db, name) {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) await db.createCollection(name);
}

/** Aplica (ou substitui) o $jsonSchema de uma coleção. */
async function setValidator(db, name, jsonSchema) {
  await ensureCollection(db, name);
  await db.command({
    collMod: name,
    validator: { $jsonSchema: jsonSchema },
    validationLevel: 'strict',
    validationAction: 'error',
  });
}

/** Recria um índice (derrubando o existente com o mesmo nome, se houver). */
async function replaceIndex(db, collection, name, keys, options) {
  await ensureCollection(db, collection);
  const col = db.collection(collection);
  const indexes = await col.indexes();
  if (indexes.some((i) => i.name === name)) await col.dropIndex(name);
  await col.createIndex(keys, { ...options, name });
}

module.exports = { ensureCollection, setValidator, replaceIndex };
