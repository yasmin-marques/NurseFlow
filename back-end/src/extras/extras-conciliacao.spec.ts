import { ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import {
  ExtraEventoTipo,
  ExtraMotivo,
  ExtraOpcao,
  ExtraProgramadoSituacao,
} from './extras.schema';
import { ExtrasService } from './extras.service';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { StatusProfissional, TipoVinculo, Formacao } from '../profissionais/profissionais.enums';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import {
  Escala,
  EscalaSchema,
  OrigemCobertura,
  Plantao,
  PlantaoProfissional,
  PlantaoProfissionalSchema,
  PlantaoSchema,
  StatusEscala,
  TipoPlantao,
  VersaoEscala,
  VersaoEscalaSchema,
} from '../escalas/schemas';

describe('ExtrasService — Conciliação de Extras Programados com Escalas (Etapa 5)', () => {
  let replSet: MongoMemoryReplSet;
  let service: ExtrasService;

  let profissionalModel: mongoose.Model<Profissional>;
  let setorModel: mongoose.Model<Setor>;
  let escalaModel: mongoose.Model<Escala>;
  let versaoEscalaModel: mongoose.Model<VersaoEscala>;
  let plantaoModel: mongoose.Model<Plantao>;
  let plantaoProfissionalModel: mongoose.Model<PlantaoProfissional>;

  const usuarioId = new Types.ObjectId();

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri('nurseflow_conciliacao_test'));

    service = new ExtrasService(mongoose.connection);
    await service.inicializarIndices();

    profissionalModel =
      (mongoose.connection.models[Profissional.name] as mongoose.Model<Profissional> | undefined) ??
      mongoose.connection.model<Profissional>(Profissional.name, ProfissionalSchema);

    setorModel =
      (mongoose.connection.models[Setor.name] as mongoose.Model<Setor> | undefined) ??
      mongoose.connection.model<Setor>(Setor.name, SetorSchema);

    escalaModel =
      (mongoose.connection.models[Escala.name] as mongoose.Model<Escala> | undefined) ??
      mongoose.connection.model<Escala>(Escala.name, EscalaSchema);

    versaoEscalaModel =
      (mongoose.connection.models[VersaoEscala.name] as mongoose.Model<VersaoEscala> | undefined) ??
      mongoose.connection.model<VersaoEscala>(VersaoEscala.name, VersaoEscalaSchema);

    plantaoModel =
      (mongoose.connection.models[Plantao.name] as mongoose.Model<Plantao> | undefined) ??
      mongoose.connection.model<Plantao>(Plantao.name, PlantaoSchema);

    plantaoProfissionalModel =
      (mongoose.connection.models[PlantaoProfissional.name] as mongoose.Model<PlantaoProfissional> | undefined) ??
      mongoose.connection.model<PlantaoProfissional>(PlantaoProfissional.name, PlantaoProfissionalSchema);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.collection('extrasProgramados').deleteMany({});
    await mongoose.connection.collection('auditoriaExtras').deleteMany({});
    await mongoose.connection.collection('profissionaisDaSaude').deleteMany({});
    await mongoose.connection.collection('setores').deleteMany({});
    await mongoose.connection.collection('escalas').deleteMany({});
    await mongoose.connection.collection('versoesEscala').deleteMany({});
    await mongoose.connection.collection('plantoes').deleteMany({});
    await mongoose.connection.collection('profissionaisRelacionados').deleteMany({});
  });

  async function criarProfissionalFixture(dados: Partial<Profissional> = {}) {
    const [p] = await profissionalModel.create([
      {
        usuarioId: dados.usuarioId ?? new Types.ObjectId(),
        coren: dados.coren ?? `COREN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        formacao: dados.formacao ?? Formacao.ENFERMEIRO,
        tipoVinculo: dados.tipoVinculo ?? TipoVinculo.CLT,
        status: dados.status ?? StatusProfissional.ATIVO,
      },
    ]);
    return p;
  }

  async function criarSetorFixture(dados: Partial<Setor> = {}) {
    const [s] = await setorModel.create([
      {
        nome: dados.nome ?? 'UTI Geral',
        ativo: dados.ativo ?? true,
        turnos: dados.turnos ?? {
          diurno: { enfermeiros: 1, tecnicos: 2 },
          noturno: { enfermeiros: 1, tecnicos: 2 },
        },
      },
    ]);
    return s;
  }

  async function criarEscalaFixture(status: StatusEscala = StatusEscala.RASCUNHO, ano = 2026, mes = 10) {
    const [e] = await escalaModel.create([
      {
        administradorId: new Types.ObjectId(),
        ano,
        mes,
        status,
        revisao: 1,
        versaoPublicada: 0,
        geracao: { pendencias: [], escopo: { turnos: ['diurno', 'noturno'] } },
      },
    ]);
    return e;
  }

  // -------------------------------------------------------------
  // Tarefa 5.1 — Schema de PlantaoProfissional e extraProgramadoId
  // -------------------------------------------------------------
  describe('Tarefa 5.1 — Schema e índice exclusivo extraProgramadoId', () => {
    it('permite criar alocações regulares sem extraProgramadoId (registros legados continuam válidos)', async () => {
      const plantaoId = new Types.ObjectId();
      const prof1 = await criarProfissionalFixture();
      const prof2 = await criarProfissionalFixture();

      const doc1 = await plantaoProfissionalModel.create({
        plantaoId,
        profissionalId: prof1._id,
        funcao: 'enfermeiro',
        lideranca: false,
        origemCobertura: OrigemCobertura.REGULAR,
      });

      const doc2 = await plantaoProfissionalModel.create({
        plantaoId,
        profissionalId: prof2._id,
        funcao: 'tecnico',
        lideranca: false,
        origemCobertura: OrigemCobertura.REGULAR,
        extraProgramadoId: null,
      });

      expect(doc1._id).toBeDefined();
      expect(doc1.extraProgramadoId).toBeNull();
      expect(doc2._id).toBeDefined();
      expect(doc2.extraProgramadoId).toBeNull();
    });

    it('impede dois vínculos com o mesmo extraProgramadoId preenchido (unicidade parcial)', async () => {
      const plantao1Id = new Types.ObjectId();
      const plantao2Id = new Types.ObjectId();
      const prof1 = await criarProfissionalFixture();
      const prof2 = await criarProfissionalFixture();
      const extraId = new Types.ObjectId();

      await plantaoProfissionalModel.create({
        plantaoId: plantao1Id,
        profissionalId: prof1._id,
        funcao: 'enfermeiro',
        extraProgramadoId: extraId,
      });

      await expect(
        plantaoProfissionalModel.create({
          plantaoId: plantao2Id,
          profissionalId: prof2._id,
          funcao: 'enfermeiro',
          extraProgramadoId: extraId,
        }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------
  // Tarefa 5.2 — Vinculação idempotente e referências bidirecionais
  // -------------------------------------------------------------
  describe('Tarefa 5.2 — Vinculação idempotente e referências bidirecionais', () => {
    it('vincula extra ativo a escala em rascunho com referências bidirecionais e auditoria VINCULADO', async () => {
      const prof = await criarProfissionalFixture();
      const setor = await criarSetorFixture();
      const escala = await criarEscalaFixture(StatusEscala.RASCUNHO, 2026, 10);

      const extra = await service.criar({
        data: '2026-10-15',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: prof._id,
        motivo: ExtraMotivo.REFORCO,
        criadoPor: usuarioId,
      });

      const detalheAntes = await service.detalhe(extra._id.toString());
      expect(detalheAntes.statusVinculo).toBe('sem_escala');

      const conciliado = await service.conciliar(
        extra._id.toString(),
        { escalaId: escala._id.toString() },
        usuarioId,
      );

      expect(conciliado.escalaId?.toString()).toBe(escala._id.toString());
      expect(conciliado.plantaoId).toBeDefined();
      expect(conciliado.plantaoProfissionalId).toBeDefined();

      const vinculo = await plantaoProfissionalModel.findById(conciliado.plantaoProfissionalId);
      expect(vinculo).not.toBeNull();
      expect(vinculo?.extraProgramadoId?.toString()).toBe(extra._id.toString());
      expect(vinculo?.profissionalId.toString()).toBe(prof._id.toString());
      expect(vinculo?.origemCobertura).toBe(OrigemCobertura.COMPLEMENTAR);

      const plantao = await plantaoModel.findById(conciliado.plantaoId);
      expect(plantao?.tipo).toBe(TipoPlantao.EXTRA);
      expect(plantao?.horarioInicio).toBe('07:00');
      expect(plantao?.horarioFim).toBe('19:00');

      const detalheDepois = await service.detalhe(extra._id.toString());
      expect(detalheDepois.statusVinculo).toBe('vinculado');

      const eventosVinculado = await service.contarEventos(extra._id, ExtraEventoTipo.VINCULADO);
      expect(eventosVinculado).toBe(1);
    });

    it('garante idempotência: chamar conciliar duas vezes mantém exatamente uma alocação e uma cobertura', async () => {
      const prof = await criarProfissionalFixture();
      const setor = await criarSetorFixture();
      const escala = await criarEscalaFixture(StatusEscala.EM_REVISAO, 2026, 10);

      const extra = await service.criar({
        data: '2026-10-20',
        opcao: ExtraOpcao.DOZE_NOITE,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: prof._id,
        motivo: ExtraMotivo.FERIAS,
        cobertoId: (await criarProfissionalFixture())._id,
        criadoPor: usuarioId,
      });

      const r1 = await service.conciliar(extra._id.toString(), { escalaId: escala._id.toString() }, usuarioId);
      const r2 = await service.conciliar(extra._id.toString(), { escalaId: escala._id.toString() }, usuarioId);

      expect(r1.plantaoProfissionalId?.toString()).toBe(r2.plantaoProfissionalId?.toString());
      expect(r1.plantaoId?.toString()).toBe(r2.plantaoId?.toString());

      const totalVinculos = await plantaoProfissionalModel.countDocuments({
        extraProgramadoId: extra._id,
      });
      expect(totalVinculos).toBe(1);

      const totalPlantoes = await plantaoModel.countDocuments({
        escalaId: escala._id,
        tipo: TipoPlantao.EXTRA,
      });
      expect(totalPlantoes).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // Tarefa 5.3 — Edição e Cancelamento de Extra Vinculado
  // -------------------------------------------------------------
  describe('Tarefa 5.3 — Edição e Cancelamento de Extra Vinculado', () => {
    it('cancelar extra vinculado remove alocação, limpa plantão vazio e reabre a vaga', async () => {
      const prof = await criarProfissionalFixture();
      const setor = await criarSetorFixture();
      const escala = await criarEscalaFixture(StatusEscala.RASCUNHO, 2026, 10);

      const extra = await service.criar({
        data: '2026-10-18',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: prof._id,
        motivo: ExtraMotivo.REFORCO,
        criadoPor: usuarioId,
      });

      const conciliado = await service.conciliar(
        extra._id.toString(),
        { escalaId: escala._id.toString() },
        usuarioId,
      );

      const plantaoId = conciliado.plantaoId;
      const vinculoId = conciliado.plantaoProfissionalId;

      const cancelado = await service.cancelar(extra._id.toString(), {
        justificativa: 'Ausência cancelada pelo profissional coberto',
        canceladoPor: usuarioId,
        revisaoEsperada: conciliado.revisao,
      });

      expect(cancelado.situacao).toBe(ExtraProgramadoSituacao.CANCELADO);

      // Alocação foi removida
      const vinculoAposCancelamento = await plantaoProfissionalModel.findById(vinculoId);
      expect(vinculoAposCancelamento).toBeNull();

      // Plantão exclusivo vazio foi removido
      const plantaoAposCancelamento = await plantaoModel.findById(plantaoId);
      expect(plantaoAposCancelamento).toBeNull();

      // Auditoria registrou desvinculação e cancelamento
      const eventosDesvinculado = await service.contarEventos(extra._id, ExtraEventoTipo.DESVINCULADO);
      const eventosCancelado = await service.contarEventos(extra._id, ExtraEventoTipo.CANCELADO);
      expect(eventosDesvinculado).toBe(1);
      expect(eventosCancelado).toBe(1);
    });

    it('cancelar extra com múltiplos profissionais no mesmo plantão remove apenas a alocação do extra', async () => {
      const profExtra = await criarProfissionalFixture();
      const profOutro = await criarProfissionalFixture();
      const setor = await criarSetorFixture();
      const escala = await criarEscalaFixture(StatusEscala.RASCUNHO, 2026, 10);

      const extra = await service.criar({
        data: '2026-10-18',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: profExtra._id,
        motivo: ExtraMotivo.REFORCO,
        criadoPor: usuarioId,
      });

      const conciliado = await service.conciliar(
        extra._id.toString(),
        { escalaId: escala._id.toString() },
        usuarioId,
      );

      // Adiciona outro profissional no mesmo plantão (ex: técnico)
      await plantaoProfissionalModel.create({
        plantaoId: conciliado.plantaoId,
        profissionalId: profOutro._id,
        funcao: 'tecnico',
        lideranca: false,
        origemCobertura: OrigemCobertura.REGULAR,
      });

      await service.cancelar(extra._id.toString(), {
        justificativa: 'Cancelamento pontual',
        canceladoPor: usuarioId,
        revisaoEsperada: conciliado.revisao,
      });

      // O outro profissional continua alocado no plantão
      const alocacaoOutro = await plantaoProfissionalModel.findOne({
        plantaoId: conciliado.plantaoId,
        profissionalId: profOutro._id,
      });
      expect(alocacaoOutro).not.toBeNull();

      // O plantão continua existindo porque não ficou vazio
      const plantao = await plantaoModel.findById(conciliado.plantaoId);
      expect(plantao).not.toBeNull();
    });

    it('editar extra vinculado alterando data/horário move a alocação e invalida validação da escala', async () => {
      const prof = await criarProfissionalFixture();
      const setor = await criarSetorFixture();
      const escala = await criarEscalaFixture(StatusEscala.EM_REVISAO, 2026, 10);

      // Marca escala como previamente validada com metadados de validação
      await escalaModel.updateOne(
        { _id: escala._id },
        { $set: { validacao: { validadoPor: usuarioId, data: new Date() } } },
      );

      const extra = await service.criar({
        data: '2026-10-10',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: prof._id,
        motivo: ExtraMotivo.REFORCO,
        criadoPor: usuarioId,
      });

      const conciliado = await service.conciliar(
        extra._id.toString(),
        { escalaId: escala._id.toString() },
        usuarioId,
      );

      const plantaoOriginalId = conciliado.plantaoId;

      // Edita o extra alterando para 12n no dia 12
      const editado = await service.editar(extra._id.toString(), {
        data: '2026-10-12',
        opcao: ExtraOpcao.DOZE_NOITE,
        revisaoEsperada: conciliado.revisao,
        atualizadoPor: usuarioId,
      });

      expect(editado.plantaoId?.toString()).not.toBe(plantaoOriginalId?.toString());

      // O plantão original vazio foi removido
      const plantaoAntigo = await plantaoModel.findById(plantaoOriginalId);
      expect(plantaoAntigo).toBeNull();

      // A validação obsoleta da escala foi invalidada (removida)
      const escalaAtualizada = await escalaModel.findById(escala._id);
      expect(escalaAtualizada?.validacao).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // Tarefa 5.4 — Proteção de Escalas Publicadas e Finalizadas
  // -------------------------------------------------------------
  describe('Tarefa 5.4 — Proteção de escalas validadas, publicadas e finalizadas', () => {
    it('impede conciliar extra com escala publicada ou finalizada', async () => {
      const prof = await criarProfissionalFixture();
      const setor = await criarSetorFixture();
      const escalaPublicada = await criarEscalaFixture(StatusEscala.PUBLICADA, 2026, 10);

      const extra = await service.criar({
        data: '2026-10-25',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: prof._id,
        motivo: ExtraMotivo.REFORCO,
        criadoPor: usuarioId,
      });

      await expect(
        service.conciliar(extra._id.toString(), { escalaId: escalaPublicada._id.toString() }, usuarioId),
      ).rejects.toThrow(ConflictException);
    });

    it('impede editar ou cancelar extra vinculado cuja escala foi publicada, mantendo snapshot imutável', async () => {
      const prof = await criarProfissionalFixture();
      const setor = await criarSetorFixture();
      const escala = await criarEscalaFixture(StatusEscala.RASCUNHO, 2026, 10);

      const extra = await service.criar({
        data: '2026-10-22',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: prof._id,
        motivo: ExtraMotivo.REFORCO,
        criadoPor: usuarioId,
      });

      const conciliado = await service.conciliar(
        extra._id.toString(),
        { escalaId: escala._id.toString() },
        usuarioId,
      );

      // Simula a publicação oficial da escala e criação de snapshot congelado
      await escalaModel.updateOne(
        { _id: escala._id },
        { $set: { status: StatusEscala.PUBLICADA, versaoPublicada: 1 } },
      );

      const snapshotOriginal = {
        escalaId: escala._id,
        totalPlantoes: 1,
        versao: 1,
        extraId: extra._id.toString(),
      };
      await versaoEscalaModel.create({
        escalaId: escala._id,
        numero: 1,
        ano: 2026,
        mes: 10,
        publicadoPor: usuarioId,
        publicadoEm: new Date(),
        snapshot: snapshotOriginal,
        pendenciasConfirmadas: true,
      });

      // Tentativa de editar o extra é rejeitada
      await expect(
        service.editar(extra._id.toString(), {
          observacao: 'Tentativa de alteração pós-publicação',
          revisaoEsperada: conciliado.revisao,
          atualizadoPor: usuarioId,
        }),
      ).rejects.toThrow(ConflictException);

      // Tentativa de cancelar o extra é rejeitada
      await expect(
        service.cancelar(extra._id.toString(), {
          justificativa: 'Tentativa de cancelamento pós-publicação',
          canceladoPor: usuarioId,
          revisaoEsperada: conciliado.revisao,
        }),
      ).rejects.toThrow(ConflictException);

      // Snapshot oficial permanece 100% idêntico e inalterado
      const versaoOficial = await versaoEscalaModel.findOne({ escalaId: escala._id, numero: 1 });
      expect(versaoOficial?.snapshot).toEqual(snapshotOriginal);
    });
  });

  // -------------------------------------------------------------
  // Tarefa 5.5 — Rollback transacional
  // -------------------------------------------------------------
  describe('Tarefa 5.5 — Atomicidade e rollback de conciliação', () => {
    it('faz rollback de vínculo e extra se a etapa de auditoria falhar', async () => {
      const prof = await criarProfissionalFixture();
      const setor = await criarSetorFixture();
      const escala = await criarEscalaFixture(StatusEscala.RASCUNHO, 2026, 10);

      const extra = await service.criar({
        data: '2026-10-30',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: prof._id,
        motivo: ExtraMotivo.REFORCO,
        criadoPor: usuarioId,
      });

      // Simula falha forçada no registro de evento de auditoria
      const spyAuditoria = jest
        .spyOn(mongoose.connection.models['AuditoriaExtra'], 'create')
        .mockRejectedValueOnce(new Error('Falha simulada no log de auditoria'));

      await expect(
        service.conciliar(extra._id.toString(), { escalaId: escala._id.toString() }, usuarioId),
      ).rejects.toThrow('Falha simulada no log de auditoria');

      spyAuditoria.mockRestore();

      // Verifica que não sobrou alocação em PlantaoProfissional
      const vinculos = await plantaoProfissionalModel.find({ extraProgramadoId: extra._id });
      expect(vinculos).toHaveLength(0);

      // Verifica que o extra permaneceu desvinculado e na revisão original
      const extraAposFalha = await service.buscarPorId(extra._id);
      expect(extraAposFalha?.plantaoProfissionalId).toBeNull();
      expect(extraAposFalha?.escalaId).toBeNull();
      expect(extraAposFalha?.revisao).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // Tarefa 5.6 — Preservação de Identidade CLT/Concursado/RPA
  // -------------------------------------------------------------
  describe('Tarefa 5.6 — Vínculo CLT, concursado e RPA', () => {
    it('preserva identidade CLT e RPA e contabiliza cada extra uma única vez na cobertura', async () => {
      const profClt = await criarProfissionalFixture({ tipoVinculo: TipoVinculo.CLT });
      const profRpa = await criarProfissionalFixture({ tipoVinculo: TipoVinculo.RPA });
      const setor = await criarSetorFixture();
      const escala = await criarEscalaFixture(StatusEscala.RASCUNHO, 2026, 10);

      const extraClt = await service.criar({
        data: '2026-10-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: profClt._id,
        motivo: ExtraMotivo.REFORCO,
        criadoPor: usuarioId,
      });

      const extraRpa = await service.criar({
        data: '2026-10-06',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: profRpa._id,
        motivo: ExtraMotivo.REFORCO,
        criadoPor: usuarioId,
      });

      const concClt = await service.conciliar(extraClt._id.toString(), { escalaId: escala._id.toString() }, usuarioId);
      const concRpa = await service.conciliar(extraRpa._id.toString(), { escalaId: escala._id.toString() }, usuarioId);

      // Confere que profissionais preservaram seus tipos de vínculo
      const profCltCarregado = await profissionalModel.findById(profClt._id);
      const profRpaCarregado = await profissionalModel.findById(profRpa._id);
      expect(profCltCarregado?.tipoVinculo).toBe(TipoVinculo.CLT);
      expect(profRpaCarregado?.tipoVinculo).toBe(TipoVinculo.RPA);

      // Confere que cada alocação tem origemCobertura COMPLEMENTAR
      const vClt = await plantaoProfissionalModel.findById(concClt.plantaoProfissionalId);
      const vRpa = await plantaoProfissionalModel.findById(concRpa.plantaoProfissionalId);
      expect(vClt?.origemCobertura).toBe(OrigemCobertura.COMPLEMENTAR);
      expect(vRpa?.origemCobertura).toBe(OrigemCobertura.COMPLEMENTAR);

      // Confere que a contagem de alocações na escala foi incrementada em exatamente 2
      const totalAlocacoesEscala = await plantaoProfissionalModel.countDocuments({
        extraProgramadoId: { $in: [extraClt._id, extraRpa._id] },
      });
      expect(totalAlocacoesEscala).toBe(2);
    });
  });
});
