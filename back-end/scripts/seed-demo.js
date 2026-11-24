/** Dados fictícios e idempotentes. Uso EXCLUSIVO em ambiente de desenvolvimento. */
const { MongoClient, ObjectId } = require('mongodb');
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
  ['karina', 'Karina Azevedo Lopes', 'enfermeiro', 'clt', 'ativo', 'CE-10011'],
  ['leonardo', 'Leonardo Teixeira Gomes', 'enfermeiro', 'rpa', 'ativo', 'CE-10012'],
  ['mariana', 'Mariana Cardoso Braga', 'enfermeiro', 'clt', 'ferias', 'CE-10013'],
  ['nicolas', 'Nicolas Araujo Prado', 'enfermeiro', 'concursado', 'afastado', 'CE-10014'],
  ['olivia', 'Olivia Santana Reis', 'enfermeiro', 'rpa', 'afastado', 'CE-10015'],
  ['paulo', 'Paulo Vinicius Moreira', 'enfermeiro', 'clt', 'ativo', 'CE-10016'],
  ['quiteria', 'Quiteria Batista Neves', 'enfermeiro', 'concursado', 'desativado', 'CE-10017'],
  ['rafael', 'Rafael Monteiro Cunha', 'enfermeiro', 'concursado', 'ativo', 'CE-10018'],
  ['sandra', 'Sandra Vieira Campos', 'tecnico', 'concursado', 'ativo', 'CE-10019'],
  ['tiago', 'Tiago Carvalho Esteves', 'tecnico', 'clt', 'ativo', 'CE-10020'],
  ['ursula', 'Ursula Medeiros Farias', 'tecnico', 'rpa', 'ativo', 'CE-10021'],
  ['valter', 'Valter Domingos Peixoto', 'tecnico', 'clt', 'ferias', 'CE-10022'],
  ['wanessa', 'Wanessa Pacheco Ramos', 'tecnico', 'rpa', 'ativo', 'CE-10023'],
  ['xavier', 'Xavier Lacerda Siqueira', 'tecnico', 'concursado', 'ativo', 'CE-10024'],
  ['yara', 'Yara Fontenele Duarte', 'tecnico', 'clt', 'ativo', 'CE-10025'],
  ['zenilda', 'Zenilda Guimarães Matos', 'tecnico', 'rpa', 'desativado', 'CE-10026'],
  ['otavio', 'Otavio Brandão Leite', 'tecnico', 'clt', 'ativo', 'CE-10027'],
];

/**
 * Efetivo adicional para a geração automática fechar a cobertura mínima dos 3 setores
 * (demanda diária: enfermeiros 5 dia/4 noite; técnicos 8 dia/5 noite) com a carga padrão
 * (concursado 6x24h+1x12h, CLT 5x24h+2x12h) e descanso de 72h/36h. Todos ativos, sem RPA.
 */
const EXTRA_ENFERMEIROS = [
  'Helena Rangel Moura', 'Igor Vasconcelos Assis', 'Julia Bezerra Tavares', 'Kleber Antunes Lobo',
  'Larissa Coutinho Vaz', 'Murilo Sampaio Noronha', 'Natalia Figueiredo Brito', 'Osvaldo Quintela Lemos',
  'Patricia Bastos Meireles', 'Renato Galvao Pontes', 'Simone Aragao Teles', 'Thales Nogueira Rios',
  'Vanessa Portela Cruz', 'William Cavalcante Dantas', 'Aline Prates Moraes', 'Caio Valadares Seixas',
  'Debora Lacerda Furtado', 'Elias Montenegro Paiva', 'Flavia Meneses Orlando',
];
const EXTRA_TECNICOS = [
  'Gustavo Albuquerque Sa', 'Heloisa Barreto Viana', 'Ivan Camargo Rezende', 'Jessica Dornelas Maia',
  'Kaue Escobar Ventura', 'Lorena Faria Calado', 'Marcelo Gusmao Ibiapina', 'Nayara Holanda Bessa',
  'Orlando Itapemirim Sales', 'Priscila Jardim Nery', 'Ricardo Kruger Lyra', 'Silvia Linhares Macedo',
  'Tatiane Mourao Nobre', 'Ubirajara Neiva Osorio', 'Viviane Padilha Quaresma', 'Wagner Queiroz Rabelo',
  'Adriana Sobral Tolentino', 'Bernardo Uchoa Valente', 'Camila Xavier Zagallo', 'Diego Amaral Bittencourt',
  'Emanuele Cordeiro Falcao', 'Fabio Garcia Honorato', 'Giovana Inacio Jucá', 'Hugo Kerr Lessa',
  'Ingrid Loureiro Maranhao', 'Jonas Neves Ouriques', 'Karen Pimentel Rosario', 'Luciano Salgado Tamandare',
  'Monica Teixeira Uchoa', 'Nelson Vilar Wanderley',
];
// Concursado/CLT alternados em proporção 10:9 (enfermeiros) e 16:14 (técnicos).
const vinculoExtra = (i, nConcursado, total) => (i * nConcursado) % total < nConcursado ? 'concursado' : 'clt';
const slugOf = (name) => name.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
for (const [lista, formacao, nConcursado] of [[EXTRA_ENFERMEIROS, 'enfermeiro', 10], [EXTRA_TECNICOS, 'tecnico', 16]]) {
  lista.forEach((name, i) => {
    PEOPLE.push([slugOf(name), name, formacao, vinculoExtra(i, nConcursado, lista.length), 'ativo', `CE-${10028 + PEOPLE.length - 27}`]);
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

function repartir(total, pesos) {
  const somaPesos = pesos.reduce((soma, peso) => soma + peso, 0);
  if (!Number.isInteger(total) || total < 0 || somaPesos <= 0) {
    throw new Error('Não foi possível distribuir profissionais entre setores.');
  }

  const cotasExatas = pesos.map((peso) => (total * peso) / somaPesos);
  const cotas = cotasExatas.map(Math.floor);
  const restantes = total - cotas.reduce((soma, cota) => soma + cota, 0);
  const ordemPorResto = cotasExatas
    .map((cota, indice) => ({ indice, resto: cota - Math.floor(cota) }))
    .sort((a, b) => b.resto - a.resto || a.indice - b.indice);

  for (let i = 0; i < restantes; i++) cotas[ordemPorResto[i].indice]++;
  return cotas;
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
      const profissional = await profs.findOneAndUpdate({ usuarioId: usuario._id }, {
        $setOnInsert: { usuarioId: usuario._id, coren, formacao, tipoVinculo, status, subsetorId: null,
          sincronizaAgenda: false, desativadoEm: status === 'desativado' ? ts : null, createdAt: ts, updatedAt: ts },
      }, { upsert: true, returnDocument: 'after' });
      identities[slug] = profissional._id;
    }

    // [nome, descrição, [enf dia, téc dia], [enf noite, téc noite], subsetores]. Setor com subsetores não tem mínimo
    // próprio de técnicos: cada subsetor tem o seu (UTI: 2 + 1 = 3, a mesma demanda total de antes).
    const setores = [
      ['Internamento', 'Unidade de Terapia Intensiva', [1, 3], [1, 3], [['Setor A', 'Leitos de terapia intensiva adulto', 3], ['Setor B', 'Cuidados semi-intensivos', 3]]],
      ['Emergência', 'Pronto atendimento', [1, 3], [1, 3], []],
    ];
    for (const [nome, descricao, dia, noite, subsetores] of setores) {
      const possuiSubsetores = subsetores.length > 0;
      const tecnicos = possuiSubsetores
        ? subsetores.reduce((soma, [, , minimo]) => soma + minimo, 0)
        : Math.max(dia[1], noite[1]);
      await db.collection('setores').updateOne({ nome }, { $setOnInsert: {
        nome, descricao, plantao24h: {
          enfermeiros: Math.max(dia[0], noite[0]),
          tecnicos,
        }, possuiSubsetores, ativo: true, createdAt: ts, updatedAt: ts,
      } }, { upsert: true });
      if (possuiSubsetores) {
        // Demo já existente (setor criado antes dos subsetores): adota subsetores e mínimo derivado, sem tocar no resto.
        await db.collection('setores').updateOne(
          { nome, possuiSubsetores: { $ne: true } },
          { $set: { possuiSubsetores: true, 'plantao24h.tecnicos': tecnicos, updatedAt: ts } },
        );
        const setorDoc = await db.collection('setores').findOne({ nome });
        for (const [nomeSubsetor, descricaoSubsetor, minimo] of subsetores) {
          await db.collection('subsetores').updateOne({ setorId: setorDoc._id, nome: nomeSubsetor }, { $setOnInsert: {
            setorId: setorDoc._id, nome: nomeSubsetor, descricao: descricaoSubsetor,
            plantao24h: { tecnicos: minimo }, ativo: true, createdAt: ts, updatedAt: ts,
          } }, { upsert: true });
        }
      }
    }

    // Setor fixo: cada profissional demo recebe um unico setor, proporcional a demanda de sua categoria.
    // So preenche quem ainda nao tem setor (nunca sobrescreve um setor ja definido no cadastro).
    const setorDocs = await db.collection('setores').find({ nome: { $in: setores.map(([nome]) => nome) } }).toArray();
    const setorPorNome = new Map(setorDocs.map((s) => [s.nome, s._id]));
    for (const [formacaoDemo, indiceFuncao] of [['enfermeiro', 0], ['tecnico', 1]]) {
      const grupo = PEOPLE.filter((pessoa) => pessoa[2] === formacaoDemo);
      const pesos = setores.map(([, , dia, noite]) => Math.max(dia[indiceFuncao], noite[indiceFuncao]));
      const cotas = repartir(grupo.length, pesos);
      let cursor = 0;
      for (let s = 0; s < setores.length; s++) {
        for (let k = 0; k < cotas[s]; k++, cursor++) {
          await profs.updateOne(
            { _id: identities[grupo[cursor][0]], setorId: { $in: [null] } },
            { $set: { setorId: setorPorNome.get(setores[s][0]), updatedAt: ts } },
          );
        }
      }
    }

    // Subsetor dos técnicos de setores com subsetores: repartido proporcionalmente ao mínimo de cada subsetor.
    // Só preenche quem ainda não tem subsetor. Enfermeiros e técnicos de setor sem subsetores ficam sem subsetor.
    {
      const tecnicos = PEOPLE.filter((pessoa) => pessoa[2] === 'tecnico');
      const cotasTecnicos = repartir(tecnicos.length, setores.map(([, , dia, noite]) => Math.max(dia[1], noite[1])));
      let cursor = 0;
      for (let s = 0; s < setores.length; s++) {
        const [nomeSetor, , , , subsetores] = setores[s];
        const grupoDoSetor = tecnicos.slice(cursor, cursor + cotasTecnicos[s]);
        cursor += cotasTecnicos[s];
        if (subsetores.length === 0) continue;
        const subsetorDocs = await db.collection('subsetores')
          .find({ setorId: setorPorNome.get(nomeSetor), nome: { $in: subsetores.map(([nomeSubsetor]) => nomeSubsetor) } }).toArray();
        const subsetorPorNome = new Map(subsetorDocs.map((sub) => [sub.nome, sub._id]));
        const cotasSubsetores = repartir(grupoDoSetor.length, subsetores.map(([, , minimo]) => minimo));
        let posicao = 0;
        for (let k = 0; k < subsetores.length; k++) {
          for (let n = 0; n < cotasSubsetores[k]; n++, posicao++) {
            await profs.updateOne(
              { _id: identities[grupoDoSetor[posicao][0]], setorId: setorPorNome.get(nomeSetor), subsetorId: { $in: [null] } },
              { $set: { subsetorId: subsetorPorNome.get(subsetores[k][0]), updatedAt: ts } },
            );
          }
        }
      }
    }

    for (const chave of DEMO_CONFIGURATIONS) {
      await db.collection('configuracoes').updateOne({ chave }, { $setOnInsert: {
        chave,
        limiteTrocas: 3,
        maxExtras: 2,
        limitePlantoes: 12,
        maxExtrasConcursado: 1,
        maxExtrasClt: 1,
        cargas: defaultLoads(),
        createdAt: ts,
        updatedAt: ts,
      } }, { upsert: true });
    }

    const restrictions = [
      ['ana', 'indisponivel', '2026-10-14T00:00:00.000Z', '2026-10-14T23:59:59.999Z', null, 'Indisponível na quarta-feira'],
      ['bruno', 'vinculo_externo', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z', 2, 'Outro vínculo às terças (sem horário específico)'],
      ['carla', 'disponivel', '2026-10-16T00:00:00.000Z', '2026-10-16T23:59:59.999Z', null, 'Disponibilidade declarada'],
      ['daniela', 'ausencia', '2026-10-19T00:00:00.000Z', '2026-10-21T23:59:59.999Z', null, 'Ausência informada'],
      ['eduardo', 'indisponivel', '2026-10-23T00:00:00.000Z', '2026-10-23T23:59:59.999Z', null, 'Compromisso pessoal'],
      ['fernanda', 'vinculo_externo', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z', 5, 'Outro vínculo às sextas'],
      ['gabriela', 'ferias', '2026-10-12T00:00:00.000Z', '2026-10-26T23:59:59.999Z', null, 'Férias programadas'],
      ['henrique', 'ausencia', '2026-10-12T00:00:00.000Z', '2026-10-31T23:59:59.999Z', null, 'Afastamento informado'],
      ['isabela', 'disponivel', '2026-10-18T00:00:00.000Z', '2026-10-18T23:59:59.999Z', null, 'Disponível neste domingo'],
      ['mariana', 'ferias', '2026-10-05T00:00:00.000Z', '2026-10-19T23:59:59.999Z', null, 'Férias programadas'],
      ['valter', 'ferias', '2026-10-19T00:00:00.000Z', '2026-11-02T23:59:59.999Z', null, 'Férias programadas'],
      ['nicolas', 'ausencia', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z', null, 'Afastamento informado'],
      ['olivia', 'ausencia', '2026-10-15T00:00:00.000Z', '2026-11-15T23:59:59.999Z', null, 'Afastamento informado'],
      ['joao', 'indisponivel', '2026-10-09T00:00:00.000Z', '2026-10-09T23:59:59.999Z', null, 'Compromisso pessoal'],
      ['tiago', 'vinculo_externo', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z', 3, 'Outro vínculo às quartas'],
      ['yara', 'indisponivel', '2026-10-28T00:00:00.000Z', '2026-10-28T23:59:59.999Z', null, 'Indisponível neste dia'],
    ];
    for (const [slug, tipo, inicio, fim, diaSemana, observacao] of restrictions) {
      const profissionalId = identities[slug];
      await db.collection('restricoes').updateOne({ profissionalId, tipo, inicio: date(inicio), fim: date(fim), observacao }, {
        $setOnInsert: { profissionalId, tipo, inicio: date(inicio), fim: date(fim), diaSemana,
          observacao, createdAt: ts, updatedAt: ts },
      }, { upsert: true });
    }
    console.log(`Seed concluído: 1 coordenação, ${PEOPLE.length} profissionais, 3 setores (UTI com 2 subsetores), 2 configurações mensais e ${restrictions.length} restrições.`);
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
