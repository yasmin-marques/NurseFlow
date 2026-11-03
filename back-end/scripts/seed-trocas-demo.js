// Cria um cenário local e identificável para demonstrar a fila administrativa.
// Não apaga nem atualiza escalas, profissionais ou vínculos preexistentes.
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const TAG = 'demo-trocas-2027-01-v1';
const YEAR = 2027;
const MONTH = 1;
const PREFIX = '6ff000000000000000000';
const id = (n) => new ObjectId(`${PREFIX}${String(n).padStart(3, '0')}`);
const at = (day) => new Date(Date.UTC(YEAR, MONTH - 1, day));
let activeSession;
function write(name) {
  const collection = globalDb.collection(name);
  return new Proxy(collection, { get(target, key) {
    const method = target[key];
    if (!['insertOne','insertMany','updateOne'].includes(String(key))) return typeof method === 'function' ? method.bind(target) : method;
    return (filterOrDocs, updateOrOptions, maybeOptions) => {
      if (key === 'updateOne') return method.call(target, filterOrDocs, updateOrOptions, { ...(maybeOptions || {}), session: activeSession });
      return method.call(target, filterOrDocs, { ...(updateOrOptions || {}), session: activeSession });
    };
  } });
}
let globalDb;

function snapshot(scale, shifts, links) {
  return { escala: scale, plantoes: shifts, profissionaisRelacionados: links,
    pendencias: [], conflitos: [], avisos: [], cargas: [], origemDemo: TAG };
}

async function seed() {
  if (process.env.NODE_ENV !== 'development' || process.env.DEMO_TROCAS_SEED_ENABLED !== 'true')
    throw new Error('Seed recusado: requer NODE_ENV=development e DEMO_TROCAS_SEED_ENABLED=true.');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente.');
  const parsed = new URL(uri);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) throw new Error('Seed permitido somente em MongoDB local.');
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0]);
  if (!dbName || dbName === 'admin' || dbName === 'production') throw new Error('Banco local de desenvolvimento esperado.');

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
        const dias = [5,9,7,11,13,17,15,21,19,23,25,29,27,31];
        const session = client.startSession();
        await session.withTransaction(async () => {
          await db.collection('configuracoes').updateOne({ _id: id(2), chave: '2027-01' }, { $set: {
            'cargas.concursado_31': { plantoes24h: 0, plantoes12h: 8 },
            'cargas.clt_31': { plantoes24h: 0, plantoes12h: 8 },
          } }, { session });
          const scaleShifts = await db.collection('plantoes').find({ escalaId: tagged._id }, { session }).sort({ _id: 1 }).toArray();
          if (scaleShifts.length !== 14) throw new Error('Esperados 14 plantões identificados como demo; correção cancelada.');
          const adjusted = scaleShifts.map((shift, i) => ({ ...shift, data: new Date(Date.UTC(YEAR, MONTH - 1, dias[i])) }));
          for (const shift of adjusted) await db.collection('plantoes').updateOne({ _id: shift._id, escalaId: tagged._id }, { $set: { data: shift.data } }, { session });
          await db.collection('escalas').updateOne({ _id: tagged._id }, { $set: { 'geracao.datasAposDescansoAdjacente': true } }, { session });
          const versions = await db.collection('versoesEscala').find({ escalaId: tagged._id }, { session }).toArray();
          if (versions.length !== 3) throw new Error('Esperados 3 snapshots identificados como demo; correção cancelada.');
          for (const version of versions) {
            const snap = version.snapshot;
            snap.plantoes = adjusted;
            if (snap.escala?.geracao) snap.escala.geracao.datasAposDescansoAdjacente = true;
            await db.collection('versoesEscala').updateOne({ _id: version._id, escalaId: tagged._id }, { $set: { snapshot: snap } }, { session });
          }
          const approvals = await db.collection('solicitacoesTroca').find({ origemDemo: TAG, status: 'aprovada' }, { session }).toArray();
          for (const request of approvals) {
            const indexes = request._id.equals(id(50)) ? [0,1] : [4,5];
            const dayA = dias[indexes[0]], dayB = dias[indexes[1]];
            await db.collection('notificacoesTroca').updateMany({ solicitacaoId: request._id }, { $set: { mensagem: `Cenário de demonstração: plantões de 2027-01-${String(dayA).padStart(2,'0')} e 2027-01-${String(dayB).padStart(2,'0')} permutados na versão ${request.decisaoCoordenacao.versoesEscala[0].numero}.` } }, { session });
          }
        });
        await session.endSession();
      }
      console.log(`Cenário ${TAG} já existe (${count} solicitações); configuração de carga demo conferida.`);
      return;
    }
    if (await db.collection('escalas').countDocuments({ ano: YEAR, mes: MONTH })) throw new Error('A competência 2027-01 já possui escala; nenhuma alteração realizada.');
    if (await db.collection('configuracoes').countDocuments({ chave: '2027-01' })) throw new Error('A configuração 2027-01 já existe; nenhuma alteração realizada.');
    for (const name of ['escalas','plantoes','profissionaisRelacionados','versoesEscala','auditoriaEscalas','solicitacoesTroca','auditoriaTrocas','notificacoesTroca']) {
      const found = await db.collection(name).findOne({ _id: { $in: Array.from({length: 60}, (_, i) => id(i + 1)) } });
      if (found) throw new Error(`IDs reservados do seed já usados em ${name}; nenhuma alteração realizada.`);
    }
    const [users, professionals, admin, sector, configTemplate] = await Promise.all([
      db.collection('usuarios').find({ email: { $in: ['ana@nurseflow.test','bruno@nurseflow.test','daniela@nurseflow.test','eduardo@nurseflow.test','isabela@nurseflow.test'] } }).toArray(),
      db.collection('profissionaisDaSaude').find({}).toArray(),
      db.collection('administradores').findOne({}),
      db.collection('setores').findOne({ ativo: true }),
      db.collection('configuracoes').findOne({ chave: '2026-10' }),
    ]);
    const userByEmail = new Map(users.map(u => [u.email, u]));
    const personByEmail = new Map(professionals.map(p => [String(users.find(u => String(u._id) === String(p.usuarioId))?.email || ''), p]));
    const ana=personByEmail.get('ana@nurseflow.test'), bruno=personByEmail.get('bruno@nurseflow.test'), daniela=personByEmail.get('daniela@nurseflow.test'), eduardo=personByEmail.get('eduardo@nurseflow.test'), isabela=personByEmail.get('isabela@nurseflow.test');
    if (!admin || !sector || !configTemplate || [ana,bruno,daniela,eduardo,isabela].some(p => !p || p.status !== 'ativo')) throw new Error('Contas demo ativas, Coordenação, setor ou configuração base ausentes. Rode o seed demo geral antes.');
    if (ana.formacao !== 'enfermeiro' || bruno.formacao !== 'enfermeiro' || daniela.formacao !== 'tecnico' || eduardo.formacao !== 'tecnico' || isabela.formacao !== 'tecnico') throw new Error('Formações demo inesperadas; seed cancelado.');
    const coordUser = await db.collection('usuarios').findOne({ _id: admin.usuarioId });
    const config = { ...configTemplate, cargas: { ...configTemplate.cargas,
      concursado_31: { plantoes24h: 0, plantoes12h: 8 }, clt_31: { plantoes24h: 0, plantoes12h: 8 } },
      _id: id(2), chave: '2027-01', createdAt: new Date(), updatedAt: new Date() };
    const scaleId = id(1), now = new Date();
    const scale = { _id: scaleId, administradorId: admin._id, mes: MONTH, ano: YEAR, status: 'publicada', revisao: 1, versaoPublicada: 1,
      dataCriacao: now, geracao: { origemDemo: TAG, geradaEm: now, geradaPor: admin.usuarioId, configuracao: { periodo:'2027-01', limiteTrocas: config.limiteTrocas }, escopo: { setorIds:[sector._id], turnos:['diurno'] }, resumo:{ alocacoes:14 } }, createdAt:now, updatedAt:now };
    const people = { ana,bruno,daniela,eduardo,isabela };
    const slots = [
      ['ana',5],['bruno',9],['ana',7],['bruno',11],['daniela',13],['eduardo',17],['ana',15],
      ['bruno',21],['daniela',19],['isabela',23],['daniela',25],['eduardo',29],['ana',27],['isabela',31],
    ];
    const shifts = slots.map(([,day],i)=>({_id:id(10+i),escalaId:scaleId,setorId:sector._id,data:at(day),horarioInicio:'07:00',horarioFim:'19:00',duracaoHoras:12,tipo:'regular',createdAt:now,updatedAt:now}));
    const links = slots.map(([slug],i)=>({_id:id(30+i),plantaoId:shifts[i]._id,profissionalId:people[slug]._id,funcao:people[slug].formacao,lideranca:false,origemCobertura:'regular',createdAt:now,updatedAt:now}));
    const pairs = [
      { label:'aprovada-enfermagem', a:0,b:1,status:'aprovada' },
      { label:'aprovada-tecnicos', a:4,b:5,status:'aprovada' },
      { label:'recusada-conflito-agenda', a:2,b:3,status:'recusada_pela_coordenacao', why:'Recusada para preservar a cobertura assistencial planejada.' },
      { label:'recusada-justificativa', a:8,b:9,status:'recusada_pela_coordenacao', why:'Recusada após revisão da necessidade do setor nesta competência.' },
      { label:'pendente-aprovacao-normal', a:10,b:11,status:'aguardando_coordenacao' },
      { label:'pendente-aprovacao-enfermagem', a:6,b:7,status:'aguardando_coordenacao' },
      { label:'pendente-bloqueio-formacao', a:12,b:13,status:'aguardando_coordenacao' },
    ];
    const requests = pairs.map((p,i)=>({ _id:id(50+i), status:p.status, ano:YEAR, mes:MONTH,
      solicitanteProfissionalId:links[p.a].profissionalId, profissionalSolicitadoId:links[p.b].profissionalId,
      vinculoSolicitanteId:links[p.a]._id, vinculoSolicitadoId:links[p.b]._id, criadaEm:new Date(now.getTime()-i*60000),
      aceite:{profissionalId:links[p.b].profissionalId,aceitoEm:new Date(now.getTime()-i*30000)},
      decisaoCoordenacao:null, origemDemo:TAG, createdAt:now,updatedAt:now }));
    activeSession = client.startSession();
    await activeSession.withTransaction(async () => {
    await write('configuracoes').insertOne(config);
    await write('escalas').insertOne(scale);
    await write('plantoes').insertMany(shifts);
    await write('profissionaisRelacionados').insertMany(links);
    await write('versoesEscala').insertOne({ _id:id(3),escalaId:scaleId,numero:1,mes:MONTH,ano:YEAR,publicadoPor:admin._id,publicadoEm:now,snapshot:snapshot(scale,shifts,links),pendenciasConfirmadas:false,createdAt:now,updatedAt:now });
    await write('auditoriaEscalas').insertOne({_id:id(4),escalaId:scaleId,revisao:1,acao:'escala_publicada',usuarioId:admin.usuarioId,ocorridoEm:now,detalhes:{versao:1,origemDemo:TAG},createdAt:now,updatedAt:now});
    await write('solicitacoesTroca').insertMany(requests);

    for (let index=0; index<pairs.length; index++) {
      const pair=pairs[index], req=requests[index];
      if (pair.status === 'aguardando_coordenacao') continue;
      const a=links[pair.a], b=links[pair.b], pa=shifts[pair.a], pb=shifts[pair.b];
      const event=`troca:${req._id}:demo-${pair.label}`;
      if (pair.status==='aprovada') {
        const version= index===0 ? 2 : 3;
        const oldA = a.profissionalId, oldB = b.profissionalId;
        const revisedScale={...scale,revisao:version,versaoPublicada:version,updatedAt:now};
        await write('profissionaisRelacionados').updateOne({_id:a._id},{$set:{profissionalId:b.profissionalId,updatedAt:now}});
        await write('profissionaisRelacionados').updateOne({_id:b._id},{$set:{profissionalId:a.profissionalId,updatedAt:now}});
        links[pair.a].profissionalId=oldB; links[pair.b].profissionalId=oldA;
        Object.assign(scale,revisedScale);
        await write('escalas').updateOne({_id:scaleId},{$set:{revisao:version,versaoPublicada:version,updatedAt:now}});
        await write('versoesEscala').insertOne({_id:id(version+3),escalaId:scaleId,numero:version,mes:MONTH,ano:YEAR,publicadoPor:admin._id,publicadoEm:now,snapshot:snapshot(scale,shifts,links),pendenciasConfirmadas:false,createdAt:now,updatedAt:now});
        const decision={resultado:'aprovada',usuarioId:admin.usuarioId,decididaEm:now,excecaoLimite:false,versoesEscala:[{ano:YEAR,mes:MONTH,numero:version}]};
        await write('solicitacoesTroca').updateOne({_id:req._id},{$set:{decisaoCoordenacao:decision,chaveIdempotencia:`demo-${pair.label}`,updatedAt:now}});
        await write('auditoriaEscalas').insertOne({_id:id(6+version),escalaId:scaleId,revisao:version,acao:'troca_aprovada',usuarioId:admin.usuarioId,ocorridoEm:now,detalhes:{solicitacaoId:String(req._id),operacaoId:`demo-${pair.label}`,versao:version,origemDemo:TAG},createdAt:now,updatedAt:now});
        await write('auditoriaTrocas').insertOne({_id:id(20+index),solicitacaoId:req._id,usuarioId:admin.usuarioId,resultado:'aprovada',decididaEm:now,excecaoLimite:false,operacaoId:`demo-${pair.label}`,vinculos:[{vinculoId:String(a._id),plantaoId:String(pa._id),de:String(oldA),para:String(oldB)},{vinculoId:String(b._id),plantaoId:String(pb._id),de:String(oldB),para:String(oldA)}],versoesEscala:[{ano:YEAR,mes:MONTH,numero:version}],createdAt:now,updatedAt:now});
        await write('notificacoesTroca').insertMany([a.profissionalId,b.profissionalId].map((pid,j)=>({ _id:id(40+index*2+j),solicitacaoId:req._id,destinatarioId:people[Object.keys(people).find(k=>String(people[k]._id)===String(pid))].usuarioId,eventKey:event,titulo:'Troca de plantão aprovada',mensagem:`Cenário de demonstração: plantões de ${pa.data.toISOString().slice(0,10)} e ${pb.data.toISOString().slice(0,10)} permutados na versão ${version}.`,createdAt:now,updatedAt:now })));
      } else {
        const decision={resultado:'recusada',usuarioId:admin.usuarioId,decididaEm:now,justificativa:pair.why,versoesEscala:[{ano:YEAR,mes:MONTH,numero:scale.versaoPublicada}]};
        await write('solicitacoesTroca').updateOne({_id:req._id},{$set:{decisaoCoordenacao:decision,chaveIdempotencia:`demo-${pair.label}`,updatedAt:now}});
        await write('auditoriaEscalas').insertOne({_id:id(10+index),escalaId:scaleId,revisao:scale.revisao,acao:'troca_recusada',usuarioId:admin.usuarioId,ocorridoEm:now,detalhes:{solicitacaoId:String(req._id),operacaoId:`demo-${pair.label}`,justificativa:pair.why,origemDemo:TAG},createdAt:now,updatedAt:now});
        await write('auditoriaTrocas').insertOne({_id:id(20+index),solicitacaoId:req._id,usuarioId:admin.usuarioId,resultado:'recusada',decididaEm:now,justificativa:pair.why,excecaoLimite:false,operacaoId:`demo-${pair.label}`,vinculos:[{vinculoId:String(a._id),plantaoId:String(pa._id),profissionalId:String(a.profissionalId)},{vinculoId:String(b._id),plantaoId:String(pb._id),profissionalId:String(b.profissionalId)}],versoesEscala:[{ano:YEAR,mes:MONTH,numero:scale.versaoPublicada}],createdAt:now,updatedAt:now});
        await write('notificacoesTroca').insertMany([a.profissionalId,b.profissionalId].map((pid,j)=>({ _id:id(40+index*2+j),solicitacaoId:req._id,destinatarioId:people[Object.keys(people).find(k=>String(people[k]._id)===String(pid))].usuarioId,eventKey:event,titulo:'Troca de plantão recusada',mensagem:`Cenário de demonstração: ${pair.why}`,createdAt:now,updatedAt:now })));
      }
    }
    });
    await activeSession.endSession();
    activeSession = undefined;
    console.log(`Seed ${TAG} criado: 3 pendentes (1 bloqueada por formação), 2 aprovadas (versões oficiais 2 e 3), 2 recusadas. Competência 2027-01.`);
    console.log(`Coordenação: ${coordUser?.email ?? 'conta de Coordenação local'}; use o login local já configurado.`);
  } finally {
    if (activeSession) { await activeSession.endSession(); activeSession = undefined; }
    await client.close();
  }
}

module.exports = { seed, TAG };
if (require.main === module) seed().catch((error) => { console.error('Seed de trocas falhou:', error.message); process.exitCode=1; });
