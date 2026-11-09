import { readdirSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

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

export async function aplicarMigrations(
  uri: string,
  sentido: "up" | "down" = "up",
  alvo?: string,
): Promise<void> {
  const client = new mongoose.mongo.MongoClient(uri);
  try {
    const db = client.db();
    const arquivos = listarMigrations();
    const selecionados = alvo
      ? arquivos.filter((arquivo) => arquivo === alvo)
      : sentido === "up"
        ? arquivos
        : arquivos.reverse();
    for (const arquivo of selecionados) await carregar(arquivo)[sentido](db);
  } finally {
    await client.close();
  }
}

export async function aplicarMigrationsAte(
  uri: string,
  ate: string,
): Promise<void> {
  const client = new mongoose.mongo.MongoClient(uri);
  try {
    const db = client.db();
    const arquivos = listarMigrations();
    const indice = arquivos.indexOf(ate);
    if (indice === -1) {
      throw new Error(`Migration alvo não encontrada: ${ate}`);
    }
    for (const arquivo of arquivos.slice(0, indice + 1)) {
      await carregar(arquivo).up(db);
    }
  } finally {
    await client.close();
  }
}

export interface BancoDeTeste {
  uri: string;
  parar: () => Promise<void>;
}

export async function iniciarBanco(
  nome = "nurseflow_test",
): Promise<BancoDeTeste> {
  const servidor = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  return {
    uri: servidor.getUri(nome),
    parar: async () => void (await servidor.stop()),
  };
}

/** Fixture exclusivamente para testes: cria uma solicitação cujo aceite já foi feito pelo destinatário. */
export async function criarSolicitacaoAceitaFixture(
  db: mongoose.mongo.Db,
  input: {
    status?: 'aguardando_coordenacao' | 'aprovada' | 'recusada_pela_coordenacao';
    ano: number;
    mes: number;
    solicitanteProfissionalId: mongoose.Types.ObjectId;
    profissionalSolicitadoId: mongoose.Types.ObjectId;
    vinculoSolicitanteId: mongoose.Types.ObjectId;
    vinculoSolicitadoId: mongoose.Types.ObjectId;
  },
) {
  const agora = new Date();
  const registro = {
    status: input.status ?? 'aguardando_coordenacao',
    ano: input.ano,
    mes: input.mes,
    solicitanteProfissionalId: input.solicitanteProfissionalId,
    profissionalSolicitadoId: input.profissionalSolicitadoId,
    vinculoSolicitanteId: input.vinculoSolicitanteId,
    vinculoSolicitadoId: input.vinculoSolicitadoId,
    criadaEm: agora,
    aceite: { profissionalId: input.profissionalSolicitadoId, aceitoEm: agora },
    decisaoCoordenacao: null,
    createdAt: agora,
    updatedAt: agora,
  };
  const { insertedId } = await db.collection('solicitacoesTroca').insertOne(registro);
  return { id: insertedId, ...registro };
}
