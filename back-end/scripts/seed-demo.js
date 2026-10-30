/** Dados fictícios e idempotentes. Uso EXCLUSIVO em ambiente de desenvolvimento. */
require('dotenv').config();
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
function requirePassword(name) {
  const value = process.env[name];
  if (!value || value.length < 8 || value.length > 72) throw new Error(`${name}: forneça uma senha de 8 a 72 caracteres no .env`);
  return value;
}
function date(s) { return new Date(s); }
const now = () => new Date();

async function seed() {
  if (process.env.DEMO_SEED_ENABLED !== 'true') {
    console.log('Seed de demonstração desabilitado (DEMO_SEED_ENABLED não é true).');
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
        $setOnInsert: { usuarioId: usuario._id, coren, formacao, tipoVinculo, status,
          sincronizaAgenda: false, desativadoEm: null, createdAt: ts, updatedAt: ts },
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

    // Configurações para todos os meses de 2026; não altera configurações já criadas pela coordenação.
    const anoDemo = 2026;
    for (let mes = 1; mes <= 12; mes++) {
      const chave = `${anoDemo}-${String(mes).padStart(2, '0')}`;
      const dias = new Date(Date.UTC(anoDemo, mes, 0)).getUTCDate();
      await db.collection('configuracoes').updateOne({ chave }, { $setOnInsert: {
        chave, limiteTrocas: 3, maxExtras: 2, limitePlantoes: 12,
        maxExtrasConcursado: 1, maxExtrasClt: 1,
        cargas: {
          [`concursado_${dias}`]: { plantoes24h: 6, plantoes12h: 1 },
          [`clt_${dias}`]: { plantoes24h: 5, plantoes12h: 2 },
          [`rpa_${dias}`]: { plantoes24h: 3, plantoes12h: 2 },
        }, createdAt: ts, updatedAt: ts,
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
    ];
    for (const [slug, tipo, inicio, fim, diaSemana, observacao] of restrictions) {
      const profissionalId = identities[slug];
      await db.collection('restricoes').updateOne({ profissionalId, tipo, inicio: date(inicio), fim: date(fim), observacao }, {
        $setOnInsert: { profissionalId, tipo, inicio: date(inicio), fim: date(fim), diaSemana,
          observacao, createdAt: ts, updatedAt: ts },
      }, { upsert: true });
    }
    console.log('Seed concluído: 1 coordenação, 9 profissionais, 3 setores, 12 configurações mensais e 9 restrições.');
    console.log('Logins: admin@nurseflow.test e <nome>@nurseflow.test; senhas conforme DEMO_ADMIN_PASSWORD/DEMO_PRO_PASSWORD.');
  } finally {
    await client.close();
  }
}
seed().catch((error) => {
  if (error && error.code === 11000) {
    console.error('Falha no seed: conflito de unicidade (e-mail, CPF ou COREN já usados por outro registro).', error.keyValue ?? '');
  } else {
    console.error('Falha no seed:', error);
  }
  process.exitCode = 1;
});
