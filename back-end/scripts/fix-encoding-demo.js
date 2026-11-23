const { MongoClient } = require('mongodb');

async function main() {
  require('dotenv').config();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente.');
  const confirmUpdate = process.argv.includes('--confirm');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('/')[0]));
    const replacement = String.fromCodePoint(0xfffd);
    const corrupted = (text) => text.replaceAll('{replacement}', replacement);
    const updates = [
      { collection: 'setores', filter: { nome: corrupted('Emerg{replacement}ncia') }, $set: { nome: 'Emergência' } },
      { collection: 'setores', filter: { nome: corrupted('Cl{replacement}nica M{replacement}dica') }, $set: { nome: 'Clínica Médica', descricao: 'Internação clínica' } },
      { collection: 'usuarios', filter: { nome: corrupted('Coordena{replacement}{replacement}o Demo') }, $set: { nome: 'Coordenação Demo' } },
      { collection: 'restricoes', filter: { observacao: corrupted('Indispon{replacement}vel na quarta-feira') }, $set: { observacao: 'Indisponível na quarta-feira' } },
      { collection: 'restricoes', filter: { observacao: corrupted('Outro v{replacement}nculo {replacement}s ter{replacement}as (sem hor{replacement}rio espec{replacement}fico)') }, $set: { observacao: 'Outro vínculo às terças (sem horário específico)' } },
      { collection: 'restricoes', filter: { observacao: corrupted('Aus{replacement}ncia informada') }, $set: { observacao: 'Ausência informada' } },
      { collection: 'restricoes', filter: { observacao: corrupted('Outro v{replacement}nculo {replacement}s sextas') }, $set: { observacao: 'Outro vínculo às sextas' } },
      { collection: 'restricoes', filter: { observacao: corrupted('F{replacement}rias programadas') }, $set: { observacao: 'Férias programadas' } },
      { collection: 'restricoes', filter: { observacao: corrupted('Dispon{replacement}vel neste domingo') }, $set: { observacao: 'Disponível neste domingo' } },
    ];

    const counts = [];
    for (const update of updates) {
      counts.push({
        collection: update.collection,
        filter: update.filter,
        count: await db.collection(update.collection).countDocuments(update.filter),
      });
    }
    console.log('Contagem exata dos documentos corrompidos (nenhuma atualização realizada):');
    console.log(JSON.stringify(counts, null, 2));
    console.log(`Total por filtros: ${counts.reduce((sum, item) => sum + item.count, 0)} documentos.`);

    if (!confirmUpdate) {
      console.log('Modo seguro: use --confirm somente após conferir a contagem acima.');
      return;
    }

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        for (const update of updates) {
          await db.collection(update.collection).updateMany(update.filter, { $set: update.$set }, { session });
        }
      });
      console.log('Atualização de encoding concluída.');
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
