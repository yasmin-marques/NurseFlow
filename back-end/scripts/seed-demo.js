/** Dados fictícios e idempotentes. Uso EXCLUSIVO em ambiente de desenvolvimento. */
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const PEOPLE = [
  ['ana', 'Ana Beatriz Lima', 'enfermeiro', 'concursado', 'ativo', 'CE-10001'],
  ['bruno', 'Bruno Henrique Costa', 'enfermeiro', 'clt', 'ativo', 'CE-10002'],
  ['carla', 'Carla Mendes Rocha', 'enfermeiro', 'rpa', 'ativo', 'CE-10003'],
  ['daniela', 'Daniela Ferreira Alves', 'tecnico', 'concursado', 'ativo', 'CE-10004'],
  ['eduardo', 'Eduardo Souza Martins', 'tecnico', 'clt', 'ativo', 'CE-10005'],
  ['fernanda', 'Fernanda Ribeiro Dias', 'tecnico', 'rpa', 'ativo', 'CE-10006'],
  ['gabriela', 'Gabriela Nunes Pinto', 'enfermeiro', 'concursado', 'ferias', 'CE-10007'],
  ['henrique', 'Henrique Oliveira Melo', 'tecnico', 'clt', 'afastado', 'CE-10008'],
  ['isabela', 'Isabela Castro Freitas', 'tecnico', 'concursado', 'ativo', 'CE-10009'],
  ['joao', 'João Pedro Barbosa', 'enfermeiro', 'concursado', 'ativo', 'CE-10010'],
  ['karina', 'Karina Azevedo Lopes', 'tecnico', 'clt', 'ativo', 'CE-10011'],
  ['leonardo', 'Leonardo Teixeira Gomes', 'tecnico', 'rpa', 'ativo', 'CE-10012'],
  ['mariana', 'Mariana Cardoso Braga', 'tecnico', 'clt', 'ferias', 'CE-10013'],
  ['nicolas', 'Nicolas Araujo Prado', 'tecnico', 'concursado', 'afastado', 'CE-10014'],
  ['olivia', 'Olivia Santana Reis', 'tecnico', 'rpa', 'afastado', 'CE-10015'],
  ['paulo', 'Paulo Vinicius Moreira', 'tecnico', 'clt', 'ativo', 'CE-10016'],
  ['quiteria', 'Quiteria Batista Neves', 'tecnico', 'concursado', 'desativado', 'CE-10017'],
  ['rafael', 'Rafael Monteiro Cunha', 'tecnico', 'concursado', 'ativo', 'CE-10018'],
  ['sandra', 'Sandra Vieira Campos', 'tecnico', 'concursado', 'ativo', 'CE-10019'],
  ['tiago', 'Tiago Carvalho Esteves', 'tecnico', 'clt', 'ativo', 'CE-10020'],
  ['ursula', 'Ursula Medeiros Farias', 'tecnico', 'rpa', 'ativo', 'CE-10021'],
  ['valter', 'Valter Domingos Peixoto', 'tecnico', 'clt', 'ferias', 'CE-10022'],
  ['wanessa', 'Wanessa Pacheco Ramos', 'tecnico', 'rpa', 'ativo', 'CE-10023'],
  ['xavier', 'Xavier Lacerda Siqueira', 'tecnico', 'concursado', 'ativo', 'CE-10024'],
  ['yara', 'Yara Fontenele Duarte', 'tecnico', 'concursado', 'ativo', 'CE-10025'],
  ['zenilda', 'Zenilda Guimarães Matos', 'tecnico', 'rpa', 'ativo', 'CE-10026'],
  ['otavio', 'Otavio Brandão Leite', 'tecnico', 'concursado', 'ativo', 'CE-10027'],
];

/**
 * Efetivo calculado para 31 dias: quatro postos diários com 5 profissionais cada e
 * a Emergência com 13 técnicos. Os 13 técnicos concursados usam no máximo 1 extra
 * cada para cobrir a demanda de 3 profissionais por dia.
 */
const EXTRA_ENFERMEIROS = [
  'Helena Rangel Moura', 'Igor Vasconcelos Assis', 'Julia Bezerra Tavares', 'Kleber Antunes Lobo',
  'Larissa Coutinho Vaz', 'Murilo Sampaio Noronha', 'Natalia Figueiredo Brito',
];
const EXTRA_TECNICOS = [
  'Gustavo Albuquerque Sa', 'Heloisa Barreto Viana', 'Ivan Camargo Rezende', 'Jessica Dornelas Maia',
  'Kaue Escobar Ventura', 'Lorena Faria Calado', 'Marcelo Gusmao Ibiapina', 'Nayara Holanda Bessa',
  'Orlando Itapemirim Sales', 'Priscila Jardim Nery', 'Ricardo Kruger Lyra', 'Silvia Linhares Macedo',
];
const slugOf = (name) => name.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const STAFFING_ASSIGNMENTS = new Map([
  ['ana', { setor: 'Internamento' }],
  ['bruno', { setor: 'Emergência' }],
  ['carla', { setor: 'Emergência' }],
  ['daniela', { setor: 'Internamento', subsetor: 'Setor A' }],
  ['eduardo', { setor: 'Internamento', subsetor: 'Setor A' }],
  ['fernanda', { setor: 'Emergência' }],
  ['gabriela', { setor: 'Internamento' }],
  ['henrique', { setor: 'Internamento', subsetor: 'Setor B' }],
  ['isabela', { setor: 'Internamento', subsetor: 'Setor A' }],
  ['joao', { setor: 'Internamento' }],
  ['karina', { setor: 'Internamento', subsetor: 'Setor A' }],
  ['leonardo', { setor: 'Emergência' }],
  ['mariana', { setor: 'Internamento', subsetor: 'Setor B' }],
  ['nicolas', { setor: 'Emergência' }],
  ['olivia', { setor: 'Emergência' }],
  ['paulo', { setor: 'Internamento', subsetor: 'Setor B' }],
  ['quiteria', { setor: 'Emergência' }],
  ['rafael', { setor: 'Internamento', subsetor: 'Setor B' }],
  ['sandra', { setor: 'Internamento', subsetor: 'Setor B' }],
  ['tiago', { setor: 'Internamento', subsetor: 'Setor B' }],
  ['ursula', { setor: 'Emergência' }],
  ['valter', { setor: 'Emergência' }],
  ['wanessa', { setor: 'Emergência' }],
  ['xavier', { setor: 'Emergência' }],
  ['yara', { setor: 'Emergência' }],
  ['zenilda', { setor: 'Emergência' }],
  ['otavio', { setor: 'Emergência' }],
]);
const EXTRA_ASSIGNMENTS = {
  enfermeiro: [
    { tipoVinculo: 'clt', setor: 'Internamento' },
    { tipoVinculo: 'clt', setor: 'Internamento' },
    { tipoVinculo: 'clt', setor: 'Internamento' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'clt', setor: 'Emergência' },
    { tipoVinculo: 'clt', setor: 'Emergência' },
  ],
  tecnico: [
    { tipoVinculo: 'clt', setor: 'Internamento', subsetor: 'Setor A' },
    { tipoVinculo: 'clt', setor: 'Internamento', subsetor: 'Setor B' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
    { tipoVinculo: 'concursado', setor: 'Emergência' },
  ],
};
for (const [lista, formacao] of [[EXTRA_ENFERMEIROS, 'enfermeiro'], [EXTRA_TECNICOS, 'tecnico']]) {
  lista.forEach((name, i) => {
    const slug = slugOf(name);
    const atribuicao = EXTRA_ASSIGNMENTS[formacao][i];
    PEOPLE.push([slug, name, formacao, atribuicao.tipoVinculo, 'ativo', `CE-${10028 + PEOPLE.length - 27}`]);
    STAFFING_ASSIGNMENTS.set(slug, atribuicao);
  });
}
const DEMO_CONFIGURATIONS = ['2026-10', '2026-11'];

function defaultLoads() {
  return Object.fromEntries(
    [28, 29, 30, 31].flatMap((days) => [
      [`concursado_${days}`, { plantoes24h: 6, plantoes12h: 1 }],
      [`clt_${days}`, { plantoes24h: 5, plantoes12h: 2 }],
    ]),
  );
}

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
function requirePassword(name) {
  const value = process.env[name];
  if (!value || value.length < 8 || value.length > 72) throw new Error(`${name}: forneça uma senha de 8 a 72 caracteres no .env`);
  return value;
}
function date(s) { return new Date(s); }
const now = () => new Date();

async function seed() {
  if (process.env.DEMO_SEED_ENABLED !== 'true') {
    console.log('Seed de demonstração desabilitado (DEMO_SEED_ENABLED true).');
    return;
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'true') {
    // A imagem Docker usa NODE_ENV=production mesmo em máquinas locais.
    // A autorização explícita é configurada exclusivamente no serviço de seed.
    throw new Error('Seed recusado em NODE_ENV=production sem ALLOW_DEMO_IN_PRODUCTION=true. Use somente numa instância local isolada.');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente');
  const adminPassword = requirePassword('DEMO_ADMIN_PASSWORD');
  const proPassword = requirePassword('DEMO_PRO_PASSWORD');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const usuarios = db.collection('usuarios');
    const profs = db.collection('profissionaisDaSaude');
    const admins = db.collection('administradores');
    const ts = now();
    const adminEmail = 'admin@nurseflow.test';
    const adminCpf = cpf('930000001');
    const admin = await usuarios.findOneAndUpdate({ email: adminEmail }, {
      $setOnInsert: {
        nome: 'Coordenação Demo', email: adminEmail, cpf: adminCpf,
        senha: await bcrypt.hash(adminPassword, 10), tipoUsuario: 'administrador',
        senhaTemporaria: false, tentativasFalhasLogin: 0, bloqueadoAte: null,
        ultimoLoginEm: null, createdAt: ts, updatedAt: ts,
      },
    }, { upsert: true, returnDocument: 'after' });
    if (admin.tipoUsuario !== 'administrador') throw new Error(`Conflito de perfil no usuário ${adminEmail}`);
    await admins.updateOne({ usuarioId: admin._id }, { $setOnInsert: { usuarioId: admin._id } }, { upsert: true });

    const identities = {};
    const seededUserIds = [];
    const proHash = await bcrypt.hash(proPassword, 10);
    for (let i = 0; i < PEOPLE.length; i++) {
      const [slug, name, formacao, tipoVinculo, status, coren] = PEOPLE[i];
      const email = `${slug}@nurseflow.test`;
      const usuario = await usuarios.findOneAndUpdate({ email }, {
        $setOnInsert: { nome: name, email, cpf: cpf(String(930000002 + i)), senha: proHash,
          tipoUsuario: 'profissionalDaSaude', senhaTemporaria: false,
          tentativasFalhasLogin: 0, bloqueadoAte: null, ultimoLoginEm: null, createdAt: ts, updatedAt: ts },
      }, { upsert: true, returnDocument: 'after' });
      if (usuario.tipoUsuario !== 'profissionalDaSaude') throw new Error(`Conflito de perfil para ${email}`);
      seededUserIds.push(usuario._id);
      const profissional = await profs.findOneAndUpdate({ usuarioId: usuario._id }, {
        $set: { coren, formacao, tipoVinculo, status, subsetorId: null,
          sincronizaAgenda: false },
        $setOnInsert: { usuarioId: usuario._id, desativadoEm: status === 'desativado' ? ts : null, createdAt: ts, updatedAt: ts },
      }, { upsert: true, returnDocument: 'after' });
      await profs.updateOne(
        { _id: profissional._id, desativadoEm: status === 'desativado' ? null : { $ne: null } },
        { $set: { desativadoEm: status === 'desativado' ? ts : null } },
      );
      identities[slug] = profissional._id;
    }

    // O mínimo é 1 técnico em cada sub-setor do Internamento e 3 na Emergência.
    const setores = [
      ['Internamento', 'Unidade de Terapia Intensiva', [1, 1], [1, 1], [['Setor A', 'Leitos de terapia intensiva adulto', 1], ['Setor B', 'Cuidados semi-intensivos', 1]]],
      ['Emergência', 'Pronto atendimento', [1, 3], [1, 3], []],
    ];
    for (const [nome, descricao, dia, noite, subsetores] of setores) {
      const possuiSubsetores = subsetores.length > 0;
      const tecnicos = possuiSubsetores
        ? subsetores.reduce((soma, [, , minimo]) => soma + minimo, 0)
        : Math.max(dia[1], noite[1]);
      await db.collection('setores').updateOne({ nome }, {
        $set: {
          nome, descricao, plantao24h: {
            enfermeiros: Math.max(dia[0], noite[0]),
            tecnicos,
          }, possuiSubsetores, ativo: true,
        },
        $setOnInsert: { createdAt: ts, updatedAt: ts },
      }, { upsert: true });
      if (possuiSubsetores) {
        const setorDoc = await db.collection('setores').findOne({ nome });
        for (const [nomeSubsetor, descricaoSubsetor, minimo] of subsetores) {
          await db.collection('subsetores').updateOne(
            { setorId: setorDoc._id, nome: nomeSubsetor },
            {
              $set: { setorId: setorDoc._id, nome: nomeSubsetor, descricao: descricaoSubsetor,
                plantao24h: { tecnicos: minimo }, ativo: true },
              $setOnInsert: { createdAt: ts, updatedAt: ts },
            },
            { upsert: true },
          );
        }
      }
    }

    const setorDocs = await db.collection('setores').find({ nome: { $in: setores.map(([nome]) => nome) } }).toArray();
    const setorPorNome = new Map(setorDocs.map((s) => [s.nome, s._id]));
    const subsetorDocs = await db.collection('subsetores')
      .find({ setorId: { $in: setorDocs.map((setor) => setor._id) } }).toArray();
    const subsetorPorChave = new Map(subsetorDocs.map((sub) => [`${String(sub.setorId)}:${sub.nome}`, sub._id]));
    for (const [slug] of PEOPLE) {
      const atribuicao = STAFFING_ASSIGNMENTS.get(slug);
      if (!atribuicao) throw new Error(`Seed sem setor definido para ${slug}.`);
      const setorId = setorPorNome.get(atribuicao.setor);
      const subsetorId = atribuicao.subsetor
        ? subsetorPorChave.get(`${String(setorId)}:${atribuicao.subsetor}`)
        : null;
      if (!setorId || (atribuicao.subsetor && !subsetorId)) {
        throw new Error(`Setor/sub-setor inválido para ${slug}.`);
      }
      await profs.updateOne(
        { _id: identities[slug] },
        { $set: { setorId, subsetorId } },
      );
    }

    // Desativa contas de profissionais de versões anteriores do seed, sem apagar seu histórico.
    const demosAntigos = await usuarios.find({
      _id: { $nin: seededUserIds },
      email: /@nurseflow\.test$/,
      tipoUsuario: 'profissionalDaSaude',
    })
      .project({ _id: 1 }).toArray();
    await profs.updateMany(
      { usuarioId: { $in: demosAntigos.map((usuario) => usuario._id) }, status: { $ne: 'desativado' } },
      { $set: { status: 'desativado', desativadoEm: ts } },
    );

    for (const chave of DEMO_CONFIGURATIONS) {
      await db.collection('configuracoes').updateOne({ chave }, {
        $set: {
          limiteTrocas: 3,
          maxExtras: 2,
          limitePlantoes: 12,
          maxExtrasConcursado: 1,
          maxExtrasClt: 1,
          cargas: defaultLoads(),
        },
        $setOnInsert: { chave, createdAt: ts, updatedAt: ts },
      }, { upsert: true });
    }

    const restrictions = [
      ['gabriela', 'ferias', '2026-10-12T00:00:00.000Z', '2026-10-26T23:59:59.999Z', null, 'Férias programadas'],
      ['henrique', 'ausencia', '2026-10-12T00:00:00.000Z', '2026-10-31T23:59:59.999Z', null, 'Afastamento informado'],
      ['mariana', 'ferias', '2026-10-05T00:00:00.000Z', '2026-10-19T23:59:59.999Z', null, 'Férias programadas'],
      ['valter', 'ferias', '2026-10-19T00:00:00.000Z', '2026-11-02T23:59:59.999Z', null, 'Férias programadas'],
      ['nicolas', 'ausencia', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z', null, 'Afastamento informado'],
      ['olivia', 'ausencia', '2026-10-15T00:00:00.000Z', '2026-11-15T23:59:59.999Z', null, 'Afastamento informado'],
    ];
    // As restrições de demonstração ficam restritas a profissionais fora do efetivo de cobertura.
    await db.collection('restricoes').deleteMany({
      profissionalId: { $in: PEOPLE.filter((pessoa) => pessoa[4] === 'ativo').map((pessoa) => identities[pessoa[0]]) },
    });
    for (const [slug, tipo, inicio, fim, diaSemana, observacao] of restrictions) {
      const profissionalId = identities[slug];
      await db.collection('restricoes').updateOne({ profissionalId, tipo, inicio: date(inicio), fim: date(fim), observacao }, {
        $setOnInsert: { profissionalId, tipo, inicio: date(inicio), fim: date(fim), diaSemana,
          observacao, createdAt: ts, updatedAt: ts },
      }, { upsert: true });
    }
    console.log(`Seed concluído: 1 coordenação, ${PEOPLE.length} profissionais, ${setores.length} setores e ${subsetorDocs.length} sub-setores, 2 configurações mensais e ${restrictions.length} restrições.`);
    console.log('Logins: admin@nurseflow.test e <nome>@nurseflow.test; senhas conforme DEMO_ADMIN_PASSWORD/DEMO_PRO_PASSWORD.');
  } finally {
    await client.close();
  }
}

module.exports = { PEOPLE, cpf, seed };

if (require.main === module) {
  require('dotenv').config();
  const seedAllDemoData = async () => {
    await seed();
  };

  seedAllDemoData().catch((error) => {
    if (error && error.code === 11000) {
      console.error('Falha no seed: conflito de unicidade (e-mail, CPF ou COREN já usados por outro registro).', error.keyValue ?? '');
    } else {
      console.error('Falha no seed:', error);
    }
    process.exitCode = 1;
  });
}
