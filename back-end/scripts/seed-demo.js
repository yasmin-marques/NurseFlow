/** Dados fictÃ­cios e idempotentes. Uso EXCLUSIVO em ambiente de desenvolvimento. */
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
  ['joao', 'JoÃ£o Pedro Barbosa', 'enfermeiro', 'concursado', 'ativo', 'CE-10010'],
  ['karina', 'Karina Azevedo Lopes', 'enfermeiro', 'clt', 'ativo', 'CE-10011'],
  ['leonardo', 'Leonardo Teixeira Gomes', 'enfermeiro', 'rpa', 'ativo', 'CE-10012'],
  ['mariana', 'Mariana Cardoso Braga', 'enfermeiro', 'clt', 'ferias', 'CE-10013'],
  ['nicolas', 'Nicolas AraÃºjo Prado', 'enfermeiro', 'concursado', 'afastado', 'CE-10014'],
  ['olivia', 'OlÃ­via Santana Reis', 'enfermeiro', 'rpa', 'afastado', 'CE-10015'],
  ['paulo', 'Paulo VinÃ­cius Moreira', 'enfermeiro', 'clt', 'ativo', 'CE-10016'],
  ['quiteria', 'QuitÃ©ria Batista Neves', 'enfermeiro', 'concursado', 'desativado', 'CE-10017'],
  ['rafael', 'Rafael Monteiro Cunha', 'enfermeiro', 'concursado', 'ativo', 'CE-10018'],
  ['sandra', 'Sandra Vieira Campos', 'tecnico', 'concursado', 'ativo', 'CE-10019'],
  ['tiago', 'Tiago Carvalho Esteves', 'tecnico', 'clt', 'ativo', 'CE-10020'],
  ['ursula', 'Ãšrsula Medeiros Farias', 'tecnico', 'rpa', 'ativo', 'CE-10021'],
  ['valter', 'Valter Domingos Peixoto', 'tecnico', 'clt', 'ferias', 'CE-10022'],
  ['wanessa', 'Wanessa Pacheco Ramos', 'tecnico', 'rpa', 'ativo', 'CE-10023'],
  ['xavier', 'Xavier Lacerda Siqueira', 'tecnico', 'concursado', 'ativo', 'CE-10024'],
  ['yara', 'Yara Fontenele Duarte', 'tecnico', 'clt', 'ativo', 'CE-10025'],
  ['zenilda', 'Zenilda GuimarÃ£es Matos', 'tecnico', 'rpa', 'desativado', 'CE-10026'],
  ['otavio', 'OtÃ¡vio BrandÃ£o Leite', 'tecnico', 'clt', 'ativo', 'CE-10027'],
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
  if (!value || value.length < 8 || value.length > 72) throw new Error(`${name}: forneÃ§a uma senha de 8 a 72 caracteres no .env`);
  return value;
}
function date(s) { return new Date(s); }
const now = () => new Date();

async function seed() {
  if (process.env.DEMO_SEED_ENABLED !== 'true') {
    console.log('Seed de demonstraÃ§Ã£o desabilitado (DEMO_SEED_ENABLED nÃ£o Ã© true).');
    return;
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'true') {
    // A imagem Docker usa NODE_ENV=production mesmo em mÃ¡quinas locais.
    // A autorizaÃ§Ã£o explÃ­cita Ã© configurada exclusivamente no serviÃ§o de seed.
    throw new Error('Seed recusado em NODE_ENV=production sem ALLOW_DEMO_IN_PRODUCTION=true. Use somente numa instÃ¢ncia local isolada.');
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
        nome: 'CoordenaÃ§Ã£o Demo', email: adminEmail, cpf: adminCpf,
        senha: await bcrypt.hash(adminPassword, 10), tipoUsuario: 'administrador',
        senhaTemporaria: false, tentativasFalhasLogin: 0, bloqueadoAte: null,
        ultimoLoginEm: null, createdAt: ts, updatedAt: ts,
      },
    }, { upsert: true, returnDocument: 'after' });
    if (admin.tipoUsuario !== 'administrador') throw new Error(`Conflito de perfil no usuÃ¡rio ${adminEmail}`);
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
      ['EmergÃªncia', 'Pronto atendimento', [2, 3], [1, 2]],
      ['ClÃ­nica MÃ©dica', 'InternaÃ§Ã£o clÃ­nica', [1, 2], [1, 1]],
    ];
    for (const [nome, descricao, dia, noite] of setores) {
      await db.collection('setores').updateOne({ nome }, { $setOnInsert: {
        nome, descricao, turnos: {
          diurno: { enfermeiros: dia[0], tecnicos: dia[1] },
          noturno: { enfermeiros: noite[0], tecnicos: noite[1] },
        }, ativo: true, createdAt: ts, updatedAt: ts,
      } }, { upsert: true });
    }

    const restrictions = [
      ['ana', 'indisponivel', '2026-10-14T00:00:00.000Z', '2026-10-14T23:59:59.999Z', null, 'IndisponÃ­vel na quarta-feira'],
      ['bruno', 'vinculo_externo', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z', 2, 'Outro vÃ­nculo Ã s terÃ§as (sem horÃ¡rio especÃ­fico)'],
      ['carla', 'disponivel', '2026-10-16T00:00:00.000Z', '2026-10-16T23:59:59.999Z', null, 'Disponibilidade declarada'],
      ['daniela', 'ausencia', '2026-10-19T00:00:00.000Z', '2026-10-21T23:59:59.999Z', null, 'AusÃªncia informada'],
      ['eduardo', 'indisponivel', '2026-10-23T00:00:00.000Z', '2026-10-23T23:59:59.999Z', null, 'Compromisso pessoal'],
      ['fernanda', 'vinculo_externo', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z', 5, 'Outro vÃ­nculo Ã s sextas'],
      ['gabriela', 'ferias', '2026-10-12T00:00:00.000Z', '2026-10-26T23:59:59.999Z', null, 'FÃ©rias programadas'],
      ['henrique', 'ausencia', '2026-10-12T00:00:00.000Z', '2026-10-31T23:59:59.999Z', null, 'Afastamento informado'],
      ['isabela', 'disponivel', '2026-10-18T00:00:00.000Z', '2026-10-18T23:59:59.999Z', null, 'DisponÃ­vel neste domingo'],
      ['mariana', 'ferias', '2026-10-05T00:00:00.000Z', '2026-10-19T23:59:59.999Z', null, 'FÃ©rias programadas'],
      ['valter', 'ferias', '2026-10-19T00:00:00.000Z', '2026-11-02T23:59:59.999Z', null, 'FÃ©rias programadas'],
      ['nicolas', 'ausencia', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z', null, 'Afastamento informado'],
      ['olivia', 'ausencia', '2026-10-15T00:00:00.000Z', '2026-11-15T23:59:59.999Z', null, 'Afastamento informado'],
      ['joao', 'indisponivel', '2026-10-09T00:00:00.000Z', '2026-10-09T23:59:59.999Z', null, 'Compromisso pessoal'],
      ['tiago', 'vinculo_externo', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.999Z', 3, 'Outro vÃ­nculo Ã s quartas'],
      ['yara', 'indisponivel', '2026-10-28T00:00:00.000Z', '2026-10-28T23:59:59.999Z', null, 'IndisponÃ­vel neste dia'],
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
module.exports = { PEOPLE, cpf, seed };

if (require.main === module) seed().catch((error) => {
  if (error && error.code === 11000) {
    console.error('Falha no seed: conflito de unicidade (e-mail, CPF ou COREN jÃ¡ usados por outro registro).', error.keyValue ?? '');
  } else {
    console.error('Falha no seed:', error);
  }
  process.exitCode = 1;
});
