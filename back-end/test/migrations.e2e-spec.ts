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
  });

  afterAll(async () => {
    await client?.close();
    await banco?.parar();
  });

  it('há migrations nomeadas com timestamp', () => {
    expect(listarMigrations()).toHaveLength(6);
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
