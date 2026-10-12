import { readdirSync } from 'fs';
import { join } from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

interface Migration {
  up: (db: mongoose.mongo.Db) => Promise<void>;
  down: (db: mongoose.mongo.Db) => Promise<void>;
}

export function listarMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((arquivo) => /^\d+-.*\.js$/.test(arquivo))
    .sort();
}

function carregar(arquivo: string): Migration {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(join(MIGRATIONS_DIR, arquivo)) as Migration;
}

export async function aplicarMigrations(uri: string, sentido: 'up' | 'down' = 'up'): Promise<void> {
  const client = new mongoose.mongo.MongoClient(uri);
  try {
    const db = client.db();
    const arquivos = sentido === 'up' ? listarMigrations() : listarMigrations().reverse();
    for (const arquivo of arquivos) await carregar(arquivo)[sentido](db);
  } finally {
    await client.close();
  }
}

export interface BancoDeTeste {
  uri: string;
  parar: () => Promise<void>;
}

export async function iniciarBanco(nome = 'nurseflow_test'): Promise<BancoDeTeste> {
  const servidor = await MongoMemoryServer.create();
  return { uri: servidor.getUri(nome), parar: async () => void (await servidor.stop()) };
}
