/**
 * Seed independente: exatamente 40 profissionais fictícios, cada um com UM setor fixo (setor já cadastrado).
 *
 * - Só cria cadastro profissional (usuário de acesso + profissionaisDaSaude). Não gera escalas, plantões,
 *   restrições, trocas, extras nem qualquer outro dado de demonstração. Não cria setores.
 * - Distribui os 40 entre os setores ATIVOS existentes, proporcionalmente ao quantitativo exigido por setor
 *   para cada categoria (enfermeiros/técnicos). Sem setor ativo, interrompe sem gravar nada.
 * - Idempotente: os registros são identificados por e-mail/CPF/COREN estáveis (prof.seed.NN). Executar de novo
 *   não duplica nem altera nada, e profissionais que não pertencem à seed nunca são tocados.
 * - Tudo-ou-nada: pré-validação de conflitos + transação (replica set) ou desfazer compensatório.
 *
 * Uso: npm run seed:profissionais   (lê MONGODB_URI do .env)
 */
require('dotenv').config();
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

const TOTAL = 40;
const ENFERMEIROS = 16; // os 24 restantes são técnicos
const DOMINIO = 'nurseflow.test';

const PRIMEIROS = [
  'Alice', 'Bernardo', 'Clara', 'Davi', 'Eloisa', 'Felipe', 'Giovana', 'Heitor', 'Ines', 'Joaquim',
  'Lara', 'Matheus', 'Nina', 'Otavia', 'Pedro', 'Rebeca', 'Samuel', 'Tereza', 'Vitor', 'Yasmin',
];
const SOBRENOMES = [
  'Albuquerque Neto', 'Barros Lins', 'Cavalcanti Rego', 'Dias Pimentel', 'Esteves Moura', 'Furtado Leal',
  'Garcia Brandao', 'Holanda Cruz', 'Ibiapina Sales', 'Jardim Torres',
];

function cpf(base9) {
  const digits = String(base9).padStart(9, '0').split('').map(Number);
  for (let len = 9; len < 11; len++) {
    let n = 0;
    for (let i = 0; i < len; i++) n += digits[i] * (len + 1 - i);
    const r = (n * 10) % 11;
    digits.push(r === 10 ? 0 : r);
  }
  return digits.join('');
}

/** Os 40 registros fictícios, com identificadores estáveis derivados do número de ordem. */
function planoDeProfissionais() {
  return Array.from({ length: TOTAL }, (_, i) => {
    const n = i + 1;
    const num = String(n).padStart(2, '0');
    // Alterna formação e vínculo de forma determinística (16 enfermeiros / 24 técnicos; concursado/CLT).
    const formacao = i % 5 < 2 ? 'enfermeiro' : 'tecnico';
    return {
      n,
      nome: `${PRIMEIROS[i % PRIMEIROS.length]} ${SOBRENOMES[Math.floor(i / 4) % SOBRENOMES.length]}`,
      email: `prof.seed.${num}@${DOMINIO}`,
      cpf: cpf(940000000 + n),
      coren: `CE-${20000 + n}`,
      formacao,
      tipoVinculo: i % 2 === 0 ? 'concursado' : 'clt',
    };
  });
}

/** Maior resto: reparte `total` itens proporcionalmente aos pesos; desempate pela ordem dos setores. */
function repartir(total, pesos) {
  const soma = pesos.reduce((a, b) => a + b, 0);
  const normalizados = soma > 0 ? pesos : pesos.map(() => 1);
  const base = normalizados.reduce((a, b) => a + b, 0);
  const quotas = normalizados.map((p) => (p * total) / base);
  const cotas = quotas.map(Math.floor);
  let faltam = total - cotas.reduce((a, b) => a + b, 0);
  const ordem = quotas
    .map((q, idx) => ({ idx, resto: q - Math.floor(q) }))
    .sort((a, b) => b.resto - a.resto || a.idx - b.idx);
  for (let k = 0; faltam > 0; k = (k + 1) % ordem.length, faltam--) cotas[ordem[k].idx] += 1;
  return cotas;
}

/** Atribui um setor a cada profissional do plano conforme a demanda de cada categoria por setor. */
function distribuir(plano, setores) {
  const porSetor = new Map(setores.map((s) => [String(s._id), 0]));
  for (const [formacao, funcao] of [['enfermeiro', 'enfermeiros'], ['tecnico', 'tecnicos']]) {
    const grupo = plano.filter((p) => p.formacao === formacao);
    const pesos = setores.map((s) => (s.turnos?.diurno?.[funcao] ?? 0) + (s.turnos?.noturno?.[funcao] ?? 0));
    const cotas = repartir(grupo.length, pesos);
    let cursor = 0;
    setores.forEach((setor, idx) => {
      for (let k = 0; k < cotas[idx]; k++) grupo[cursor++].setorId = setor._id;
      porSetor.set(String(setor._id), porSetor.get(String(setor._id)) + cotas[idx]);
    });
  }
  return porSetor;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'true') {
    throw new Error('Seed de profissionais fictícios recusada em NODE_ENV=production sem ALLOW_DEMO_IN_PRODUCTION=true.');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente');

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const usuarios = db.collection('usuarios');
    const profissionais = db.collection('profissionaisDaSaude');

    // Pré-requisito: setores já cadastrados (a seed nunca cria setores).
    const setores = await db.collection('setores').find({ ativo: true }).sort({ nome: 1 }).toArray();
    if (setores.length === 0) {
      throw new Error(
        'Pré-requisito não atendido: não há setores ativos cadastrados. Cadastre os setores (tela de Setores) ' +
          'ou execute "npm run db:setup" (que cria os setores de demonstração) e rode a seed novamente. Nada foi gravado.',
      );
    }

    const plano = planoDeProfissionais();
    const porSetor = distribuir(plano, setores);

    // Pré-validação (tudo-ou-nada): detecta conflitos com registros que NÃO são da seed antes de gravar.
    const existentes = new Map();
    for (const item of plano) {
      const porEmail = await usuarios.findOne({ email: item.email });
      if (porEmail) {
        const prof = await profissionais.findOne({ usuarioId: porEmail._id });
        if (porEmail.tipoUsuario !== 'profissionalDaSaude' || !prof || prof.coren !== item.coren || porEmail.cpf !== item.cpf) {
          throw new Error(`Conflito: o e-mail ${item.email} já existe com dados diferentes dos da seed. Nada foi alterado.`);
        }
        existentes.set(item.n, { usuario: porEmail, profissional: prof });
        continue;
      }
      const cpfEmUso = await usuarios.findOne({ cpf: item.cpf });
      const corenEmUso = await profissionais.findOne({ coren: item.coren });
      if (cpfEmUso || corenEmUso) {
        throw new Error(`Conflito: CPF ${item.cpf} ou COREN ${item.coren} da seed já pertence a outro cadastro. Nada foi alterado.`);
      }
    }

    const novos = plano.filter((p) => !existentes.has(p.n));
    if (novos.length === 0) {
      console.log(`Seed já aplicada: os ${TOTAL} profissionais existem. Nada foi alterado.`);
      return;
    }

    const agora = new Date();
    // Senha aleatória e descartada: a seed não cria logins utilizáveis (o acesso é definido via recuperação de senha).
    const senhaDescartavel = await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10);
    const hello = await db.admin().command({ hello: 1 });
    const criados = [];

    const gravar = async (session) => {
      for (const item of novos) {
        const { insertedId: usuarioId } = await usuarios.insertOne({
          nome: item.nome, email: item.email, cpf: item.cpf, senha: senhaDescartavel, tipoUsuario: 'profissionalDaSaude',
          senhaTemporaria: true, tentativasFalhasLogin: 0, bloqueadoAte: null, ultimoLoginEm: null,
          createdAt: agora, updatedAt: agora,
        }, { session });
        const { insertedId } = await profissionais.insertOne({
          usuarioId, coren: item.coren, formacao: item.formacao, tipoVinculo: item.tipoVinculo, status: 'ativo',
          setorId: item.setorId, sincronizaAgenda: false, desativadoEm: null, createdAt: agora, updatedAt: agora,
        }, { session });
        criados.push({ usuarioId, profissionalId: insertedId });
      }
    };

    if (hello.setName) {
      const session = client.startSession();
      try {
        await session.withTransaction(() => gravar(session));
      } finally {
        await session.endSession();
      }
    } else {
      try {
        await gravar(undefined);
      } catch (erro) {
        // Sem replica set não há transação: desfaz o que foi inserido nesta execução.
        await profissionais.deleteMany({ _id: { $in: criados.map((c) => c.profissionalId) } });
        await usuarios.deleteMany({ _id: { $in: criados.map((c) => c.usuarioId) } });
        throw erro;
      }
    }

    const total = await usuarios.countDocuments({ email: { $in: plano.map((p) => p.email) } });
    console.log(`Seed de profissionais concluída: ${novos.length} criado(s), ${existentes.size} já existente(s); total da seed = ${total}/${TOTAL}.`);
    for (const setor of setores) console.log(` - ${setor.nome}: ${porSetor.get(String(setor._id))} profissional(is)`);
  } finally {
    await client.close();
  }
}

module.exports = { main, planoDeProfissionais, distribuir, TOTAL };

if (require.main === module) {
  main().catch((erro) => {
    console.error(erro.message);
    process.exit(1);
  });
}
