/** Dados fictÃ­cios e idempotentes. Uso EXCLUSIVO em ambiente de desenvolvimento. */
require('dotenv').config();
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
    // A imagem Docker usa NODE_ENV=production mesmo em mÃ¡quinas locais.
    // A autorizaÃ§Ã£o explÃ­cita Ã© configurada exclusivamente no serviÃ§o de seed.
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
        $setOnInsert: { usuarioId: usuario._id, coren, formacao, tipoVinculo, status,
          sincronizaAgenda: false, desativadoEm: status === 'desativado' ? ts : null, createdAt: ts, updatedAt: ts },
      }, { upsert: true, returnDocument: 'after' });
      identities[slug] = profissional._id;
    }

    const setores = [
      ['UTI', 'Unidade de Terapia Intensiva', [2, 3], [2, 2]],
      ['Emergência', 'Pronto atendimento', [2, 3], [1, 2]],
      ['Clínica Médica', 'Internação clínica', [1, 2], [1, 1]],
    ];
    for (const [nome, descricao, dia, noite] of setores) {
      await db.collection('setores').updateOne({ nome }, { $setOnInsert: {
        nome, descricao, turnos: {
          diurno: { enfermeiros: dia[0], tecnicos: dia[1] },
          noturno: { enfermeiros: noite[0], tecnicos: noite[1] },
        }, ativo: true, createdAt: ts, updatedAt: ts,
      } }, { upsert: true });
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
    console.log(`Seed concluído: 1 coordenação, ${PEOPLE.length} profissionais, 3 setores, 2 configurações mensais e ${restrictions.length} restrições.`);
    console.log('Logins: admin@nurseflow.test e <nome>@nurseflow.test; senhas conforme DEMO_ADMIN_PASSWORD/DEMO_PRO_PASSWORD.');
  } finally {
    await client.close();
  }
}

async function seedTrocasDemo() {
  const TAG = 'demo-trocas-2027-01-v1';
  const YEAR = 2027;
  const MONTH = 1;
  const PREFIX = '6ff000000000000000000';
  const id = (n) => new ObjectId(`${PREFIX}${String(n).padStart(3, '0')}`);
  const at = (day) => new Date(Date.UTC(YEAR, MONTH - 1, day));
  let activeSession;
  let globalDb;

  function write(name) {
    const collection = globalDb.collection(name);
    return new Proxy(collection, {
      get(target, key) {
        const method = target[key];
        if (!['insertOne', 'insertMany', 'updateOne'].includes(String(key))) {
          return typeof method === 'function' ? method.bind(target) : method;
        }
        return (filterOrDocs, updateOrOptions, maybeOptions) => {
          if (key === 'updateOne') {
            return method.call(target, filterOrDocs, updateOrOptions, { ...(maybeOptions || {}), session: activeSession });
          }
          return method.call(target, filterOrDocs, { ...(updateOrOptions || {}), session: activeSession });
        };
      },
    });
  }

  function snapshot(scale, shifts, links) {
    return {
      escala: scale,
      plantoes: shifts,
      profissionaisRelacionados: links,
      pendencias: [],
      conflitos: [],
      avisos: [],
      cargas: [],
      origemDemo: TAG,
    };
  }

  if (process.env.NODE_ENV !== 'development' || process.env.DEMO_SEED_ENABLED !== 'true') {
    throw new Error('Seed de trocas recusada: requer NODE_ENV=development e DEMO_SEED_ENABLED=true.');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente.');
  const parsed = new URL(uri);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new Error('Seed de trocas permitida somente em MongoDB local.');
  }
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0]);
  if (!dbName || dbName === 'admin' || dbName === 'production') {
    throw new Error('Banco local de desenvolvimento esperado.');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  globalDb = db;
  try {
    const hello = await db.admin().command({ hello: 1 });
    if (!hello.setName) throw new Error('MongoDB local precisa operar como replica set para transações.');
    const tagged = await db.collection('escalas').findOne({ 'geracao.origemDemo': TAG });
    if (tagged) {
      const count = await db.collection('solicitacoesTroca').countDocuments({ origemDemo: TAG });
      if (count !== 7) throw new Error(`Seed parcial detectado (${count}/7 solicitações). Nenhum dado foi alterado.`);
      const demoConfig = await db.collection('configuracoes').findOne({ _id: id(2), chave: '2027-01' });
      if (!demoConfig) throw new Error('Configuração do cenário demo ausente; nenhuma alteração realizada.');
      if (!tagged.geracao?.datasAposDescansoAdjacente) {
        const days = [5, 9, 7, 11, 13, 17, 15, 21, 19, 23, 25, 29, 27, 31];
        const session = client.startSession();
        await session.withTransaction(async () => {
          await db.collection('configuracoes').updateOne({ _id: id(2), chave: '2027-01' }, {
            $set: {
              'cargas.concursado_31': { plantoes24h: 0, plantoes12h: 8 },
              'cargas.clt_31': { plantoes24h: 0, plantoes12h: 8 },
            },
          }, { session });
          const scaleShifts = await db.collection('plantoes')
            .find({ escalaId: tagged._id }, { session }).sort({ _id: 1 }).toArray();
          if (scaleShifts.length !== 14) {
            throw new Error('Esperados 14 plantões identificados como demo; correção cancelada.');
          }
          const adjusted = scaleShifts.map((shift, index) => ({
            ...shift,
            data: new Date(Date.UTC(YEAR, MONTH - 1, days[index])),
          }));
          for (const shift of adjusted) {
            await db.collection('plantoes').updateOne(
              { _id: shift._id, escalaId: tagged._id },
              { $set: { data: shift.data } },
              { session },
            );
          }
          await db.collection('escalas').updateOne(
            { _id: tagged._id },
            { $set: { 'geracao.datasAposDescansoAdjacente': true } },
            { session },
          );
          const versions = await db.collection('versoesEscala').find({ escalaId: tagged._id }, { session }).toArray();
          if (versions.length !== 3) {
            throw new Error('Esperados 3 snapshots identificados como demo; correção cancelada.');
          }
          for (const version of versions) {
            const snap = version.snapshot;
            snap.plantoes = adjusted;
            if (snap.escala?.geracao) snap.escala.geracao.datasAposDescansoAdjacente = true;
            await db.collection('versoesEscala').updateOne(
              { _id: version._id, escalaId: tagged._id },
              { $set: { snapshot: snap } },
              { session },
            );
          }
          const approvals = await db.collection('solicitacoesTroca')
            .find({ origemDemo: TAG, status: 'aprovada' }, { session }).toArray();
          for (const request of approvals) {
            const indexes = request._id.equals(id(50)) ? [0, 1] : [4, 5];
            const dayA = days[indexes[0]];
            const dayB = days[indexes[1]];
            await db.collection('notificacoesTroca').updateMany(
              { solicitacaoId: request._id },
              {
                $set: {
                  mensagem: `Cenário de demonstração: plantões de 2027-01-${String(dayA).padStart(2, '0')} e 2027-01-${String(dayB).padStart(2, '0')} permutados na versão ${request.decisaoCoordenacao.versoesEscala[0].numero}.`,
                },
              },
              { session },
            );
          }
        });
        await session.endSession();
      }
      console.log(`Cenário ${TAG} já existe (${count} solicitações); configuração de carga demo conferida.`);
      return;
    }

    if (await db.collection('escalas').countDocuments({ ano: YEAR, mes: MONTH })) {
      throw new Error('A competência 2027-01 já possui escala; nenhuma alteração realizada.');
    }
    if (await db.collection('configuracoes').countDocuments({ chave: '2027-01' })) {
      throw new Error('A configuração 2027-01 já existe; nenhuma alteração realizada.');
    }
    for (const name of [
      'escalas',
      'plantoes',
      'profissionaisRelacionados',
      'versoesEscala',
      'auditoriaEscalas',
      'solicitacoesTroca',
      'auditoriaTrocas',
      'notificacoesTroca',
    ]) {
      const found = await db.collection(name).findOne({
        _id: { $in: Array.from({ length: 60 }, (_, index) => id(index + 1)) },
      });
      if (found) throw new Error(`IDs reservados do seed já usados em ${name}; nenhuma alteração realizada.`);
    }
    const emails = [
      'ana@nurseflow.test',
      'bruno@nurseflow.test',
      'daniela@nurseflow.test',
      'eduardo@nurseflow.test',
      'isabela@nurseflow.test',
    ];
    const [users, professionals, admin, sector, configTemplate] = await Promise.all([
      db.collection('usuarios').find({ email: { $in: emails } }).toArray(),
      db.collection('profissionaisDaSaude').find({}).toArray(),
      db.collection('administradores').findOne({}),
      db.collection('setores').findOne({ ativo: true }),
      db.collection('configuracoes').findOne({ chave: '2026-10' }),
    ]);
    const personByEmail = new Map(
      professionals.map((person) => [
        String(users.find((user) => String(user._id) === String(person.usuarioId))?.email || ''),
        person,
      ]),
    );
    const people = {
      ana: personByEmail.get('ana@nurseflow.test'),
      bruno: personByEmail.get('bruno@nurseflow.test'),
      daniela: personByEmail.get('daniela@nurseflow.test'),
      eduardo: personByEmail.get('eduardo@nurseflow.test'),
      isabela: personByEmail.get('isabela@nurseflow.test'),
    };
    if (
      !admin ||
      !sector ||
      !configTemplate ||
      Object.values(people).some((person) => !person || person.status !== 'ativo')
    ) {
      throw new Error('Contas demo ativas, Coordenação, setor ou configuração base ausentes. Rode o seed demo geral antes.');
    }
    if (
      people.ana.formacao !== 'enfermeiro' ||
      people.bruno.formacao !== 'enfermeiro' ||
      people.daniela.formacao !== 'tecnico' ||
      people.eduardo.formacao !== 'tecnico' ||
      people.isabela.formacao !== 'tecnico'
    ) {
      throw new Error('Formações demo inesperadas; seed cancelado.');
    }
    const coordUser = await db.collection('usuarios').findOne({ _id: admin.usuarioId });
    const config = {
      ...configTemplate,
      cargas: {
        ...configTemplate.cargas,
        concursado_31: { plantoes24h: 0, plantoes12h: 8 },
        clt_31: { plantoes24h: 0, plantoes12h: 8 },
      },
      _id: id(2),
      chave: '2027-01',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const scaleId = id(1);
    const now = new Date();
    const scale = {
      _id: scaleId,
      administradorId: admin._id,
      mes: MONTH,
      ano: YEAR,
      status: 'publicada',
      revisao: 1,
      versaoPublicada: 1,
      dataCriacao: now,
      geracao: {
        origemDemo: TAG,
        geradaEm: now,
        geradaPor: admin.usuarioId,
        configuracao: { periodo: '2027-01', limiteTrocas: config.limiteTrocas },
        escopo: { setorIds: [sector._id], turnos: ['diurno'] },
        resumo: { alocacoes: 14 },
      },
      createdAt: now,
      updatedAt: now,
    };
    const slots = [
      ['ana', 5], ['bruno', 9], ['ana', 7], ['bruno', 11], ['daniela', 13], ['eduardo', 17], ['ana', 15],
      ['bruno', 21], ['daniela', 19], ['isabela', 23], ['daniela', 25], ['eduardo', 29], ['ana', 27], ['isabela', 31],
    ];
    const shifts = slots.map(([, day], index) => ({
      _id: id(10 + index),
      escalaId: scaleId,
      setorId: sector._id,
      data: at(day),
      horarioInicio: '07:00',
      horarioFim: '19:00',
      duracaoHoras: 12,
      tipo: 'regular',
      createdAt: now,
      updatedAt: now,
    }));
    const links = slots.map(([slug], index) => ({
      _id: id(30 + index),
      plantaoId: shifts[index]._id,
      profissionalId: people[slug]._id,
      funcao: people[slug].formacao,
      lideranca: false,
      origemCobertura: 'regular',
      createdAt: now,
      updatedAt: now,
    }));
    const pairs = [
      { label: 'aprovada-enfermagem', a: 0, b: 1, status: 'aprovada' },
      { label: 'aprovada-tecnicos', a: 4, b: 5, status: 'aprovada' },
      {
        label: 'recusada-conflito-agenda',
        a: 2,
        b: 3,
        status: 'recusada_pela_coordenacao',
        why: 'Recusada para preservar a cobertura assistencial planejada.',
      },
      {
        label: 'recusada-justificativa',
        a: 8,
        b: 9,
        status: 'recusada_pela_coordenacao',
        why: 'Recusada após revisão da necessidade do setor nesta competência.',
      },
      { label: 'pendente-aprovacao-normal', a: 10, b: 11, status: 'aguardando_coordenacao' },
      { label: 'pendente-aprovacao-enfermagem', a: 6, b: 7, status: 'aguardando_coordenacao' },
      { label: 'pendente-bloqueio-formacao', a: 12, b: 13, status: 'aguardando_coordenacao' },
    ];
    const requests = pairs.map((pair, index) => ({
      _id: id(50 + index),
      status: pair.status,
      ano: YEAR,
      mes: MONTH,
      solicitanteProfissionalId: links[pair.a].profissionalId,
      profissionalSolicitadoId: links[pair.b].profissionalId,
      vinculoSolicitanteId: links[pair.a]._id,
      vinculoSolicitadoId: links[pair.b]._id,
      criadaEm: new Date(now.getTime() - index * 60000),
      aceite: {
        profissionalId: links[pair.b].profissionalId,
        aceitoEm: new Date(now.getTime() - index * 30000),
      },
      decisaoCoordenacao: null,
      origemDemo: TAG,
      createdAt: now,
      updatedAt: now,
    }));

    activeSession = client.startSession();
    await activeSession.withTransaction(async () => {
      await write('configuracoes').insertOne(config);
      await write('escalas').insertOne(scale);
      await write('plantoes').insertMany(shifts);
      await write('profissionaisRelacionados').insertMany(links);
      await write('versoesEscala').insertOne({
        _id: id(3),
        escalaId: scaleId,
        numero: 1,
        mes: MONTH,
        ano: YEAR,
        publicadoPor: admin._id,
        publicadoEm: now,
        snapshot: snapshot(scale, shifts, links),
        pendenciasConfirmadas: false,
        createdAt: now,
        updatedAt: now,
      });
      await write('auditoriaEscalas').insertOne({
        _id: id(4),
        escalaId: scaleId,
        revisao: 1,
        acao: 'escala_publicada',
        usuarioId: admin.usuarioId,
        ocorridoEm: now,
        detalhes: { versao: 1, origemDemo: TAG },
        createdAt: now,
        updatedAt: now,
      });
      await write('solicitacoesTroca').insertMany(requests);

      for (let index = 0; index < pairs.length; index++) {
        const pair = pairs[index];
        const request = requests[index];
        if (pair.status === 'aguardando_coordenacao') continue;
        const a = links[pair.a];
        const b = links[pair.b];
        const shiftA = shifts[pair.a];
        const shiftB = shifts[pair.b];
        const event = `troca:${request._id}:demo-${pair.label}`;
        if (pair.status === 'aprovada') {
          const version = index === 0 ? 2 : 3;
          const oldA = a.profissionalId;
          const oldB = b.profissionalId;
          const revisedScale = { ...scale, revisao: version, versaoPublicada: version, updatedAt: now };
          await write('profissionaisRelacionados').updateOne(
            { _id: a._id },
            { $set: { profissionalId: b.profissionalId, updatedAt: now } },
          );
          await write('profissionaisRelacionados').updateOne(
            { _id: b._id },
            { $set: { profissionalId: a.profissionalId, updatedAt: now } },
          );
          links[pair.a].profissionalId = oldB;
          links[pair.b].profissionalId = oldA;
          Object.assign(scale, revisedScale);
          await write('escalas').updateOne(
            { _id: scaleId },
            { $set: { revisao: version, versaoPublicada: version, updatedAt: now } },
          );
          await write('versoesEscala').insertOne({
            _id: id(version + 3),
            escalaId: scaleId,
            numero: version,
            mes: MONTH,
            ano: YEAR,
            publicadoPor: admin._id,
            publicadoEm: now,
            snapshot: snapshot(scale, shifts, links),
            pendenciasConfirmadas: false,
            createdAt: now,
            updatedAt: now,
          });
          const decision = {
            resultado: 'aprovada',
            usuarioId: admin.usuarioId,
            decididaEm: now,
            excecaoLimite: false,
            versoesEscala: [{ ano: YEAR, mes: MONTH, numero: version }],
          };
          await write('solicitacoesTroca').updateOne(
            { _id: request._id },
            { $set: { decisaoCoordenacao: decision, chaveIdempotencia: `demo-${pair.label}`, updatedAt: now } },
          );
          await write('auditoriaEscalas').insertOne({
            _id: id(6 + version),
            escalaId: scaleId,
            revisao: version,
            acao: 'troca_aprovada',
            usuarioId: admin.usuarioId,
            ocorridoEm: now,
            detalhes: { solicitacaoId: String(request._id), operacaoId: `demo-${pair.label}`, versao: version, origemDemo: TAG },
            createdAt: now,
            updatedAt: now,
          });
          await write('auditoriaTrocas').insertOne({
            _id: id(20 + index),
            solicitacaoId: request._id,
            usuarioId: admin.usuarioId,
            resultado: 'aprovada',
            decididaEm: now,
            excecaoLimite: false,
            operacaoId: `demo-${pair.label}`,
            vinculos: [
              { vinculoId: String(a._id), plantaoId: String(shiftA._id), de: String(oldA), para: String(oldB) },
              { vinculoId: String(b._id), plantaoId: String(shiftB._id), de: String(oldB), para: String(oldA) },
            ],
            versoesEscala: [{ ano: YEAR, mes: MONTH, numero: version }],
            createdAt: now,
            updatedAt: now,
          });
          const recipients = [a.profissionalId, b.profissionalId].map((personId) =>
            Object.values(people).find((person) => String(person._id) === String(personId)).usuarioId,
          );
          await write('notificacoesTroca').insertMany(recipients.map((personId, recipientIndex) => ({
            _id: id(40 + index * 2 + recipientIndex),
            solicitacaoId: request._id,
            destinatarioId: personId,
            eventKey: event,
            titulo: 'Troca de plantão aprovada',
            mensagem: `Cenário de demonstração: plantões de ${shiftA.data.toISOString().slice(0, 10)} e ${shiftB.data.toISOString().slice(0, 10)} permutados na versão ${version}.`,
            createdAt: now,
            updatedAt: now,
          })));
        } else {
          const decision = {
            resultado: 'recusada',
            usuarioId: admin.usuarioId,
            decididaEm: now,
            justificativa: pair.why,
            versoesEscala: [{ ano: YEAR, mes: MONTH, numero: scale.versaoPublicada }],
          };
          await write('solicitacoesTroca').updateOne(
            { _id: request._id },
            { $set: { decisaoCoordenacao: decision, chaveIdempotencia: `demo-${pair.label}`, updatedAt: now } },
          );
          await write('auditoriaEscalas').insertOne({
            _id: id(10 + index),
            escalaId: scaleId,
            revisao: scale.revisao,
            acao: 'troca_recusada',
            usuarioId: admin.usuarioId,
            ocorridoEm: now,
            detalhes: {
              solicitacaoId: String(request._id),
              operacaoId: `demo-${pair.label}`,
              justificativa: pair.why,
              origemDemo: TAG,
            },
            createdAt: now,
            updatedAt: now,
          });
          await write('auditoriaTrocas').insertOne({
            _id: id(20 + index),
            solicitacaoId: request._id,
            usuarioId: admin.usuarioId,
            resultado: 'recusada',
            decididaEm: now,
            justificativa: pair.why,
            excecaoLimite: false,
            operacaoId: `demo-${pair.label}`,
            vinculos: [
              { vinculoId: String(a._id), plantaoId: String(shiftA._id), profissionalId: String(a.profissionalId) },
              { vinculoId: String(b._id), plantaoId: String(shiftB._id), profissionalId: String(b.profissionalId) },
            ],
            versoesEscala: [{ ano: YEAR, mes: MONTH, numero: scale.versaoPublicada }],
            createdAt: now,
            updatedAt: now,
          });
          const recipients = [a.profissionalId, b.profissionalId].map((personId) =>
            Object.values(people).find((person) => String(person._id) === String(personId)).usuarioId,
          );
          await write('notificacoesTroca').insertMany(recipients.map((personId, recipientIndex) => ({
            _id: id(40 + index * 2 + recipientIndex),
            solicitacaoId: request._id,
            destinatarioId: personId,
            eventKey: event,
            titulo: 'Troca de plantão recusada',
            mensagem: `Cenário de demonstração: ${pair.why}`,
            createdAt: now,
            updatedAt: now,
          })));
        }
      }
    });
    await activeSession.endSession();
    activeSession = undefined;
    console.log(`Seed ${TAG} criado: 3 pendentes (1 bloqueada por formação), 2 aprovadas (versões oficiais 2 e 3), 2 recusadas. Competência 2027-01.`);
    console.log(`Coordenação: ${coordUser?.email ?? 'conta de Coordenação local'}; use o login local já configurado.`);
  } finally {
    if (activeSession) {
      await activeSession.endSession();
      activeSession = undefined;
    }
    await client.close();
  }
}

module.exports = { PEOPLE, cpf, seed };

if (require.main === module) {
  const seedAllDemoData = async () => {
    await seed();
    if (process.env.DEMO_SEED_ENABLED !== 'true') return;
    await seedTrocasDemo();
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
