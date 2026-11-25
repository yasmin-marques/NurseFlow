/* eslint-disable no-console */
// Seed temporário e idempotente para homologação manual de Extras Programados.
// Não usa os modelos da aplicação para evitar bypass das regras: mutações passam pela API real.

const { MongoClient } = require('mongodb');

const marker = 'seed:extras-homologacao:v1';
const uri = process.env.EXTRAS_HOMOLOG_MONGODB_URI;
const backendUri = process.env.EXTRAS_HOMOLOG_BACKEND_MONGODB_URI;
const api = (process.env.EXTRAS_HOMOLOG_BACKEND_URL || '').replace(/\/$/, '');

function fail(message) {
  throw new Error(message);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`${name} é obrigatório.`);
  return value;
}

function idOf(value) {
  return value?.id || value?._id || value?.profissional?.id || value?.setor?.id;
}

function requireSafeUri(value, name) {
  if (!value) fail(`${name} é obrigatório.`);
  const parsed = new URL(value);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName || !/^nurseflow_extras_homolog_[a-z0-9_]+$/.test(dbName)) {
    fail(`${name} deve apontar para um banco exclusivo nurseflow_extras_homolog_<identificador>.`);
  }
  if (parsed.searchParams.get('replicaSet') !== 'rs0') {
    fail(`${name} deve informar replicaSet=rs0.`);
  }
  if (['production', 'prod', 'nurseflow', 'admin', 'test'].includes(dbName)) {
    fail(`${name} aponta para um banco não permitido.`);
  }
  return { parsed, dbName };
}

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    fail(`${options.method || 'GET'} ${path} retornou ${response.status}: ${detail}`);
  }
  return body;
}

function auth(token, method, body) {
  return { method, body: JSON.stringify(body), headers: { authorization: `Bearer ${token}` } };
}

async function login(email, senha, perfil = 'coordenacao') {
  const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha, perfil }) });
  return result.accessToken;
}

async function firstOrCreate(listPath, predicate, createPath, token, body) {
  const existing = await request(listPath, { headers: { authorization: `Bearer ${token}` } });
  const items = Array.isArray(existing) ? existing : (existing.itens || []);
  const found = items.find(predicate);
  if (found) return found;
  return request(createPath, auth(token, 'POST', body));
}

async function configure(token, ano, mes, limite) {
  await request(`/configuracoes/limites?ano=${ano}&mes=${mes}`, auth(token, 'PATCH', {
    maxExtras: limite,
    limitePlantoes: 31,
    maxExtrasClt: limite,
    maxExtrasConcursado: limite,
  }));
  for (const vinculo of ['clt', 'concursado', 'rpa']) {
    await request(`/configuracoes/cargas?ano=${ano}&mes=${mes}`, auth(token, 'PUT', {
      vinculo, diasMes: mes === 2 ? 28 : 30, plantoes24h: 1, plantoes12h: 1,
    }));
  }
}

async function allExtras(token) {
  const result = await request('/extras?pagina=1&limite=100', { headers: { authorization: `Bearer ${token}` } });
  return result.itens || [];
}

async function ensureExtra(token, extras, definition) {
  const found = extras.find((item) => item.observacao?.includes(definition.marker));
  if (found) return found;
  const created = await request('/extras', auth(token, 'POST', {
    data: definition.data,
    opcao: definition.opcao,
    setorId: definition.setorId,
    funcao: definition.funcao,
    substitutoId: definition.substitutoId,
    motivo: definition.motivo,
    observacao: `${marker}:${definition.marker}`,
  }));
  extras.push(created);
  return created;
}

async function ensureRestriction(token, professionalId, definition) {
  const existing = await request(`/profissionais/${professionalId}/restricoes`, { headers: { authorization: `Bearer ${token}` } });
  if (existing.some((item) => item.observacao?.includes(`${marker}:${definition.marker}`))) return;
  const { marker: restrictionMarker, ...payload } = definition;
  await request(`/profissionais/${professionalId}/restricoes`, auth(token, 'POST', {
    ...payload,
    observacao: `${marker}:${restrictionMarker}`,
  }));
}

async function main() {
  if (process.env.NODE_ENV === 'production') fail('Seed recusado em NODE_ENV=production.');
  if (process.env.EXTRAS_HOMOLOG_CONFIRM !== '1') fail('Defina EXTRAS_HOMOLOG_CONFIRM=1 para confirmar a homologação.');
  if (!api || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(api)) fail('EXTRAS_HOMOLOG_BACKEND_URL deve ser um backend local explícito.');
  const target = requireSafeUri(uri, 'EXTRAS_HOMOLOG_MONGODB_URI');
  const backendTarget = requireSafeUri(backendUri, 'EXTRAS_HOMOLOG_BACKEND_MONGODB_URI');
  if (uri !== backendUri || target.dbName !== backendTarget.dbName) fail('O backend e o seed não estão apontando para exatamente a mesma base.');

  const coordEmail = required('EXTRAS_HOMOLOG_COORD_EMAIL');
  const coordPassword = required('EXTRAS_HOMOLOG_COORD_PASSWORD');
  const proPassword = required('EXTRAS_HOMOLOG_PRO_PASSWORD');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(target.dbName);
  await db.command({ ping: 1 });
  console.log(`Banco confirmado: ${target.dbName}; backend confirmado: ${api}; replica set rs0.`);

  const coordToken = await login(coordEmail, coordPassword);
  const setores = [];
  for (const nome of ['QA Extras — Setor A', 'QA Extras — Setor B']) {
    setores.push(await firstOrCreate('/setores', (item) => item.nome === nome, '/setores', coordToken, {
      nome, descricao: `${marker} — setor fictício`,
      turnos: { diurno: { enfermeiros: 1, tecnicos: 0 }, noturno: { enfermeiros: 1, tecnicos: 0 } },
    }));
  }

  const professionals = [];
  const people = [
    ['QA Extras — Enfermeira A', '23456789092', 'COREN-QA-A-2034', 'qa-extras-a@nurseflow.test', 'enfermeiro', 'clt'],
    ['QA Extras — Enfermeira B', '34567890175', 'COREN-QA-B-2034', 'qa-extras-b@nurseflow.test', 'enfermeiro', 'clt'],
    ['QA Extras — Técnica C', '45678901249', 'COREN-QA-C-2034', 'qa-extras-c@nurseflow.test', 'tecnico', 'concursado'],
    ['QA Extras — Enfermeira Oficial', '56789012303', 'COREN-QA-O-2034', 'qa-extras-oficial@nurseflow.test', 'enfermeiro', 'clt'],
    ['QA Extras — Restrição', '67890123469', 'COREN-QA-R-2034', 'qa-extras-restricao@nurseflow.test', 'enfermeiro', 'clt'],
  ];
  for (const [nome, cpf, coren, email, formacao, tipoVinculo] of people) {
    professionals.push(await firstOrCreate('/profissionais/todos', (item) => item.email === email || item.nome === nome, '/profissionais', coordToken, {
      nome, cpf, coren, email, formacao, tipoVinculo, senha: proPassword,
    }));
  }
  await ensureRestriction(coordToken, idOf(professionals[4]), {
    tipo: 'ferias', inicio: '2034-05-20T00:00:00.000Z', fim: '2034-05-24T23:59:59.999Z',
    turno: 'flexivel', motivo: 'Férias fictícias para homologação', marker: 'ferias',
  });
  await ensureRestriction(coordToken, idOf(professionals[4]), {
    tipo: 'indisponivel', inicio: '2034-07-12T00:00:00.000Z', fim: '2034-07-12T23:59:59.999Z',
    turno: 'diurno', motivo: 'Indisponibilidade fictícia para homologação', marker: 'indisponivel',
  });

  await configure(coordToken, 2034, 5, 30);
  await configure(coordToken, 2034, 6, 30);
  await configure(coordToken, 2034, 7, 30);
  await configure(coordToken, 2034, 8, 0);

  const extras = await allExtras(coordToken);
  const definitions = [
    ['2034-05-03', '12d', 0, 0, 'enfermeiro', 'reforco', 'editavel', 'QA Extras — Enfermeira A'],
    ['2034-05-05', '12n', 0, 1, 'enfermeiro', 'reforco', 'concorrencia', 'QA Extras — Enfermeira B'],
    ['2034-05-07', '12d', 1, 2, 'tecnico', 'reforco', 'tecnico', 'QA Extras — Técnica C'],
    ['2034-05-09', '12d', 0, 0, 'enfermeiro', 'reforco', 'cancelavel', 'QA Extras — Enfermeira A'],
    ['2034-05-11', '12n', 1, 1, 'enfermeiro', 'reforco', 'filtro-setor-b', 'QA Extras — Enfermeira B'],
    ['2034-05-13', '12d', 0, 3, 'enfermeiro', 'outro', 'rpa-preparacao', 'QA Extras — Enfermeira Oficial'],
    ['2034-05-15', '12n', 1, 2, 'tecnico', 'reforco', 'pagina-01', 'QA Extras — Técnica C'],
    ['2034-05-17', '12d', 0, 0, 'enfermeiro', 'reforco', 'pagina-02', 'QA Extras — Enfermeira A'],
    ['2034-05-19', '12n', 1, 1, 'enfermeiro', 'reforco', 'pagina-03', 'QA Extras — Enfermeira B'],
    ['2034-05-25', '12d', 0, 3, 'enfermeiro', 'reforco', 'oficial-auxiliar', 'QA Extras — Enfermeira Oficial'],
    ['2034-06-03', '12d', 0, 0, 'enfermeiro', 'reforco', 'junho-01', 'QA Extras — Enfermeira A'],
    ['2034-06-05', '12n', 1, 1, 'enfermeiro', 'reforco', 'junho-02', 'QA Extras — Enfermeira B'],
    ['2034-06-07', '12d', 1, 2, 'tecnico', 'reforco', 'junho-03', 'QA Extras — Técnica C'],
    ['2034-06-09', '12d', 0, 3, 'enfermeiro', 'reforco', 'oficial', 'QA Extras — Enfermeira Oficial'],
    ['2034-06-11', '12n', 1, 0, 'enfermeiro', 'reforco', 'junho-05', 'QA Extras — Enfermeira A'],
    ['2034-06-15', '12d', 0, 1, 'enfermeiro', 'reforco', 'junho-06', 'QA Extras — Enfermeira B'],
    ['2034-06-17', '12n', 1, 2, 'tecnico', 'reforco', 'junho-07', 'QA Extras — Técnica C'],
    ['2034-06-19', '12d', 0, 3, 'enfermeiro', 'reforco', 'junho-08', 'QA Extras — Enfermeira Oficial'],
    ['2034-06-21', '12n', 1, 0, 'enfermeiro', 'reforco', 'junho-09', 'QA Extras — Enfermeira A'],
    ['2034-06-23', '12d', 0, 1, 'enfermeiro', 'reforco', 'junho-10', 'QA Extras — Enfermeira B'],
    ['2034-06-25', '12n', 1, 2, 'tecnico', 'reforco', 'junho-11', 'QA Extras — Técnica C'],
    ['2034-06-27', '12d', 0, 3, 'enfermeiro', 'reforco', 'junho-12', 'QA Extras — Enfermeira Oficial'],
  ];
  const created = [];
  for (const [data, opcao, setor, profissional, funcao, motivo, key, label] of definitions) {
    const extra = await ensureExtra(coordToken, extras, {
      data, opcao, setorId: idOf(setores[setor]), funcao, substitutoId: idOf(professionals[profissional]), motivo,
      marker: key,
    });
    created.push({ key, data, setor: setores[setor].nome, profissional: label, id: idOf(extra) });
  }
  const cancelavel = created.find((item) => item.key === 'cancelavel');
  const cancelDetail = await request(`/extras/${cancelavel.id}`, { headers: { authorization: `Bearer ${coordToken}` } });
  if (cancelDetail.situacao === 'programado') {
    await request(`/extras/${cancelavel.id}/cancelar`, auth(coordToken, 'POST', {
      revisaoEsperada: cancelDetail.revisao, justificativa: 'Cancelamento fictício preparado para homologação.',
    }));
  }

  const escalaExistente = await request('/escalas?ano=2034&mes=6', { headers: { authorization: `Bearer ${coordToken}` } });
  let escala = escalaExistente[0]?.escala || escalaExistente[0];
  if (!escala || ['publicada', 'finalizada'].includes(escala.status) === false) {
    const gerada = await request('/escalas/gerar', auth(coordToken, 'POST', {
      ano: 2034, mes: 6, substituirRascunho: Boolean(escala), setorIds: setores.map(idOf), turnos: ['diurno', 'noturno'],
    }));
    escala = gerada.escala;
  }
  if (escala && escala.status !== 'publicada' && escala.status !== 'finalizada') {
    const revisao = await request(`/escalas/${idOf(escala)}`, { headers: { authorization: `Bearer ${coordToken}` } });
    const revisaoAtual = revisao.escala?.revisao || revisao.revisao || escala.revisao;
    const revisada = await request(`/escalas/${idOf(escala)}/revisao`, auth(coordToken, 'POST', { revisaoEsperada: revisaoAtual }));
    const revisaoDepois = revisada.escala?.revisao || revisada.revisao || revisaoAtual + 1;
    const validada = await request(`/escalas/${idOf(escala)}/validar`, auth(coordToken, 'POST', { revisaoEsperada: revisaoDepois }));
    const revisaoValidada = validada.escala?.revisao || validada.revisao || revisaoDepois;
    await request(`/escalas/${idOf(escala)}/publicar`, auth(coordToken, 'POST', { revisaoEsperada: revisaoValidada, confirmarPendencias: true }));
  }
  const metadata = db.collection('nurseflow_seed_metadata');
  await metadata.updateOne({ _id: marker }, { $set: { marker, createdAt: new Date(), banco: target.dbName, escalaJunho: idOf(escala), extras: created } }, { upsert: true });
  console.log(`Seed concluído: ${created.length} extras identificados, 2 setores, 5 profissionais, restrições e escala oficial de 06/2034 preparados.`);
  console.log('RPA manual: use profissional fictício QA Extras — RPA Manual, e-mail qa-extras-rpa@nurseflow.test, CPF 15350946056, COREN COREN-QA-RPA-2034, vínculo rpa; não foi criado pelo seed.');
  await client.close();
}

main().catch(async (error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
