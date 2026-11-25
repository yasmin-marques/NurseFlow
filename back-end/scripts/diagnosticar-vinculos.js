// Lista os profissionais cujo vínculo setor/subsetor precisa de adequação manual (somente leitura; nada é alterado).
//
// Regras verificadas:
//   1. profissional sem setor (ou com setor inexistente);
//   2. técnico com subsetor em setor SEM subsetores;
//   3. enfermeiro com subsetor (enfermeiro é vinculado só ao setor);
//   4. subsetor inexistente, inativo ou pertencente a OUTRO setor.
//
// Também alerta sobre setores com subsetores cujo mínimo derivado (plantao24h.tecnicos) diverge da soma dos subsetores ativos.
// Uso: npm run vinculos:pendencias   (termina com código 1 se houver pendências)
require('dotenv').config();
const { MongoClient } = require('mongodb');

/** Núcleo puro (testável): recebe os documentos e devolve as pendências. */
function diagnosticar({ setores, subsetores, profissionais, nomes = new Map() }) {
  const setorPorId = new Map(setores.map((s) => [String(s._id), s]));
  const subsetorPorId = new Map(subsetores.map((s) => [String(s._id), s]));
  const pendencias = [];
  const adicionar = (p, motivo) =>
    pendencias.push({ id: String(p._id), nome: nomes.get(String(p.usuarioId)) ?? '(sem usuário)', coren: p.coren, status: p.status, motivo });

  for (const p of profissionais) {
    const setor = p.setorId ? setorPorId.get(String(p.setorId)) : undefined;
    if (!setor) {
      adicionar(p, 'sem setor válido');
      continue;
    }
    const subsetor = p.subsetorId ? subsetorPorId.get(String(p.subsetorId)) : undefined;
    if (p.subsetorId && !subsetor) adicionar(p, 'subsetor inexistente');
    else if (subsetor && String(subsetor.setorId) !== String(setor._id)) adicionar(p, `subsetor "${subsetor.nome}" pertence a outro setor`);
    else if (subsetor && !subsetor.ativo) adicionar(p, `subsetor "${subsetor.nome}" inativo`);
    else if (p.formacao === 'enfermeiro' && p.subsetorId) adicionar(p, 'enfermeiro não deve ter subsetor');
    else if (p.formacao === 'tecnico' && !setor.possuiSubsetores && p.subsetorId) adicionar(p, `setor "${setor.nome}" não possui subsetores`);
  }

  const divergencias = [];
  for (const setor of setores.filter((s) => s.possuiSubsetores)) {
    const soma = subsetores
      .filter((s) => String(s.setorId) === String(setor._id) && s.ativo)
      .reduce((total, s) => total + s.plantao24h.tecnicos, 0);
    if (setor.plantao24h?.tecnicos !== soma) {
      divergencias.push({ setor: setor.nome, armazenado: setor.plantao24h?.tecnicos, esperado: soma });
    }
  }
  return { pendencias, divergencias };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const [setores, subsetores, profissionais] = await Promise.all([
      db.collection('setores').find({}).toArray(),
      db.collection('subsetores').find({}).toArray(),
      db.collection('profissionaisDaSaude').find({}).toArray(),
    ]);
    const usuarios = await db
      .collection('usuarios')
      .find({ _id: { $in: profissionais.map((p) => p.usuarioId) } }, { projection: { nome: 1 } })
      .toArray();
    const nomes = new Map(usuarios.map((u) => [String(u._id), u.nome]));
    const { pendencias, divergencias } = diagnosticar({ setores, subsetores, profissionais, nomes });

    for (const d of divergencias) {
      console.error(`Setor "${d.setor}": mínimo derivado de técnicos (${d.armazenado}) difere da soma dos subsetores ativos (${d.esperado}).`);
    }
    if (pendencias.length === 0 && divergencias.length === 0) {
      console.log(`Nenhuma pendência: ${profissionais.length} profissional(is) com vínculo setor/subsetor consistente.`);
      return;
    }
    if (pendencias.length > 0) {
      console.error(`${pendencias.length} de ${profissionais.length} profissional(is) precisam de adequação manual:`);
      for (const p of pendencias) console.error(` - ${p.id}  ${p.nome}  COREN ${p.coren}  [${p.status}]  ${p.motivo}`);
      console.error('Ajuste pela tela de Profissionais ou PATCH /profissionais/:id ({ "setorId": "...", "subsetorId": "..." }).');
    }
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

module.exports = { diagnosticar };

if (require.main === module) {
  main().catch((erro) => {
    console.error(erro.message);
    process.exit(1);
  });
}
