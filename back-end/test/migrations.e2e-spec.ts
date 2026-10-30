import mongoose from 'mongoose';
import { aplicarMigrations, type BancoDeTeste, iniciarBanco, listarMigrations } from './helpers';

describe('Migrations', () => {
  let banco: BancoDeTeste;
  let client: mongoose.mongo.MongoClient;
  let db: mongoose.mongo.Db;

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_migrations');
    client = new mongoose.mongo.MongoClient(banco.uri);
    db = client.db();

    // Estado "antigo" (db/mongo/script.js original): sem validators novos.
    await db.collection('setores').insertOne({ nome: 'Bloco A', descricao: 'Assistência clínica', quantMinEnf: 2, quantMinTec: 3 });
    await db.collection('profissionaisDaSaude').insertOne({
      usuarioId: new mongoose.Types.ObjectId(),
      coren: 'COREN-CE 1',
      tipoVinculo: 'clt',
      status: 'desligado',
      formacao: 'tecnico',
      sincronizaAgenda: false,
    });
    const administradorId = new mongoose.Types.ObjectId();
    const escalaId = new mongoose.Types.ObjectId();
    const plantaoId = new mongoose.Types.ObjectId();
    await db.collection('escalas').insertOne({
      _id: escalaId,
      administradorId,
      mes: 10,
      ano: 2026,
      status: 'publicada',
      dataCriacao: new Date('2026-09-20T12:00:00.000Z'),
    });
    await db.collection('plantoes').insertOne({
      _id: plantaoId,
      escalaId,
      setorId: new mongoose.Types.ObjectId(),
      data: new Date('2026-10-01T00:00:00.000Z'),
      horarioInicio: '07:00',
      horarioFim: '07:00',
      duracaoHoras: 24,
      tipo: 'regular',
    });
    await db.collection('profissionaisRelacionados').insertOne({
      plantaoId,
      profissionalId: new mongoose.Types.ObjectId(),
      funcao: 'enfermeiro',
    });
  });

  afterAll(async () => {
    await client?.close();
    await banco?.parar();
  });

  it('há migrations nomeadas com timestamp', () => {
    expect(listarMigrations()).toHaveLength(7);
  });

  it('up: converte setores para quantitativo por turno e "desligado" para "desativado"', async () => {
    await aplicarMigrations(banco.uri, 'up');

    const setor = await db.collection('setores').findOne({ nome: 'Bloco A' });
    expect(setor).toMatchObject({
      ativo: true,
      turnos: { diurno: { enfermeiros: 2, tecnicos: 3 }, noturno: { enfermeiros: 2, tecnicos: 3 } },
    });
    expect(setor).not.toHaveProperty('quantMinEnf');
    expect(setor).not.toHaveProperty('quantMinTec');

    const profissional = await db.collection('profissionaisDaSaude').findOne({ coren: 'COREN-CE 1' });
    expect(profissional?.status).toBe('desativado');
  });

  it('up: aplica os validators e índices únicos', async () => {
    await expect(db.collection('setores').insertOne({ nome: 'Sem turnos', ativo: true })).rejects.toThrow(/validation/i);
    await expect(
      db.collection('profissionaisDaSaude').insertOne({
        usuarioId: new mongoose.Types.ObjectId(), coren: 'X', tipoVinculo: 'clt', status: 'desligado', formacao: 'tecnico', sincronizaAgenda: false,
      }),
    ).rejects.toThrow(/validation/i);
    await expect(
      db.collection('setores').insertOne({
        nome: 'bloco a', ativo: true,
        turnos: { diurno: { enfermeiros: 1, tecnicos: 1 }, noturno: { enfermeiros: 1, tecnicos: 1 } },
      }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('up: migra escalas antigas e preserva snapshot das publicadas', async () => {
    await aplicarMigrations(banco.uri, 'up');

    const escala = await db.collection('escalas').findOne({ ano: 2026, mes: 10 });
    expect(escala).toMatchObject({ status: 'publicada', revisao: 1, versaoPublicada: 1 });
    const versao = await db.collection('versoesEscala').findOne({ escalaId: escala?._id, numero: 1 });
    expect(versao).toMatchObject({
      ano: 2026,
      mes: 10,
      publicadoPor: escala?.administradorId,
      snapshot: {
        plantoes: [{ duracaoHoras: 24 }],
        profissionaisRelacionados: [{ funcao: 'enfermeiro' }],
      },
    });
  });

  it('up: impede duplicar eventos de notificação do mesmo destinatário', async () => {
    await aplicarMigrations(banco.uri, 'up');

    const escala = await db.collection('escalas').findOne({ ano: 2026, mes: 10 });
    const base = {
      escalaId: escala?._id,
      versao: 1,
      destinatarioId: new mongoose.Types.ObjectId(),
      eventKey: 'escala:2026-10:v1',
      titulo: 'Escala publicada',
      mensagem: 'A escala foi publicada.',
    };
    await db.collection('notificacoesEscala').insertOne(base);
    await expect(db.collection('notificacoesEscala').insertOne(base)).rejects.toThrow(/duplicate key/i);
  });

  it('suporta transações confirmadas e rollback no banco de integração', async () => {
    const session = client.startSession();
    try {
      session.startTransaction();
      await db.collection('testeTransacao').insertOne({ estado: 'confirmado' }, { session });
      await session.commitTransaction();

      expect(await db.collection('testeTransacao').countDocuments({ estado: 'confirmado' })).toBe(1);

      session.startTransaction();
      await db.collection('testeTransacao').insertOne({ estado: 'revertido' }, { session });
      await session.abortTransaction();

      expect(await db.collection('testeTransacao').countDocuments({ estado: 'revertido' })).toBe(0);
    } finally {
      await session.endSession();
    }
  });

  it('é idempotente (pode ser reaplicada)', async () => {
    await expect(aplicarMigrations(banco.uri, 'up')).resolves.toBeUndefined();
  });

  it('down: restaura o modelo anterior sem perder dados', async () => {
    await aplicarMigrations(banco.uri, 'down');
    const setor = await db.collection('setores').findOne({ nome: 'Bloco A' });
    expect(setor).toMatchObject({ quantMinEnf: 2, quantMinTec: 3 });
    expect(setor).not.toHaveProperty('turnos');
    const profissional = await db.collection('profissionaisDaSaude').findOne({ coren: 'COREN-CE 1' });
    expect(profissional?.status).toBe('desligado');
  });
});
