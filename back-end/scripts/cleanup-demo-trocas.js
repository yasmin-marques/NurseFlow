const { MongoClient, ObjectId } = require('mongodb');

const TAG = 'demo-trocas-2027-01-v1';
const PREFIX = '6ff000000000000000000';
const id = (n) => new ObjectId(`${PREFIX}${String(n).padStart(3, '0')}`);

async function main() {
  require('dotenv').config();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente.');
  const confirmDelete = process.argv.includes('--confirm');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('/')[0]));
    const requestIds = Array.from({ length: 7 }, (_, index) => id(50 + index));
    const filters = {
      solicitacoesTroca: { _id: { $in: requestIds }, origemDemo: TAG, ano: 2027, mes: 1 },
      auditoriaTrocas: { solicitacaoId: { $in: requestIds }, operacaoId: { $regex: /^demo-/ } },
      notificacoesTroca: { solicitacaoId: { $in: requestIds }, eventKey: { $regex: /^troca:/ } },
      escalas: { _id: id(1), ano: 2027, mes: 1, 'geracao.origemDemo': TAG },
      configuracoes: { _id: id(2), chave: '2027-01' },
      plantoes: { _id: { $in: Array.from({ length: 14 }, (_, index) => id(10 + index)) }, escalaId: id(1) },
      profissionaisRelacionados: { _id: { $in: Array.from({ length: 14 }, (_, index) => id(30 + index)) }, plantaoId: { $in: Array.from({ length: 14 }, (_, index) => id(10 + index)) } },
      versoesEscala: { _id: { $in: [id(3), id(5), id(6)] }, escalaId: id(1) },
      auditoriaEscalas: { _id: { $in: [id(4), id(8), id(9), id(12), id(13)] }, escalaId: id(1), 'detalhes.origemDemo': TAG },
    };

    const counts = {};
    for (const [name, filter] of Object.entries(filters)) {
      counts[name] = await db.collection(name).countDocuments(filter);
    }
    console.log('Contagem exata dos documentos do cenário demo (nenhuma exclusão realizada):');
    console.log(JSON.stringify(counts, null, 2));
    console.log(`Solicitações: ${counts.solicitacoesTroca}/7`);

    if (!confirmDelete) {
      console.log('Modo seguro: use --confirm somente após conferir a contagem acima.');
      return;
    }
    if (counts.solicitacoesTroca !== 7) {
      throw new Error(`A exclusão foi cancelada: esperadas 7 solicitações, encontradas ${counts.solicitacoesTroca}.`);
    }

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        for (const [name, filter] of Object.entries(filters)) {
          await db.collection(name).deleteMany(filter, { session });
        }
      });
      console.log('Cenário demo removido com os filtros exatos acima.');
    } finally {
      await session.endSession();
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
