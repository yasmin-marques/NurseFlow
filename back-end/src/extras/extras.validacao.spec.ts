import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  // @ts-expect-error Node 18 global crypto polyfill for VM modules
  globalThis.crypto = webcrypto;
}

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { ExtrasService } from './extras.service';
import { ExtraOpcao, ExtraProgramadoSituacao } from './extras.schema';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais/profissionais.enums';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { Restricao, RestricaoSchema, TipoRestricao } from '../restricoes/restricao.schema';
import {
  OrigemCobertura,
  Plantao,
  PlantaoProfissional,
  PlantaoProfissionalSchema,
  PlantaoSchema,
  TipoPlantao,
} from '../escalas/schemas';
import { Configuracao, ConfiguracaoSchema } from '../configuracoes/configuracao.schema';
import { utcDate } from '../common/utils/date';

describe('ExtrasService — Validações de Elegibilidade, Disponibilidade, Descanso e Limites', () => {
  let replSet: MongoMemoryReplSet;
  let service: ExtrasService;

  let profissionalModel: mongoose.Model<Profissional>;
  let setorModel: mongoose.Model<Setor>;
  let restricaoModel: mongoose.Model<Restricao>;
  let plantaoModel: mongoose.Model<Plantao>;
  let plantaoProfissionalModel: mongoose.Model<PlantaoProfissional>;
  let configuracaoModel: mongoose.Model<Configuracao>;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri('nurseflow_validacao_test'));

    service = new ExtrasService(mongoose.connection);
    await service.inicializarIndices();

    profissionalModel =
      (mongoose.connection.models[Profissional.name] as mongoose.Model<Profissional> | undefined) ??
      mongoose.connection.model<Profissional>(Profissional.name, ProfissionalSchema);

    setorModel =
      (mongoose.connection.models[Setor.name] as mongoose.Model<Setor> | undefined) ??
      mongoose.connection.model<Setor>(Setor.name, SetorSchema);

    restricaoModel =
      (mongoose.connection.models[Restricao.name] as mongoose.Model<Restricao> | undefined) ??
      mongoose.connection.model<Restricao>(Restricao.name, RestricaoSchema);

    plantaoModel =
      (mongoose.connection.models[Plantao.name] as mongoose.Model<Plantao> | undefined) ??
      mongoose.connection.model<Plantao>(Plantao.name, PlantaoSchema);

    plantaoProfissionalModel =
      (mongoose.connection.models[PlantaoProfissional.name] as mongoose.Model<PlantaoProfissional> | undefined) ??
      mongoose.connection.model<PlantaoProfissional>(PlantaoProfissional.name, PlantaoProfissionalSchema);

    configuracaoModel =
      (mongoose.connection.models[Configuracao.name] as mongoose.Model<Configuracao> | undefined) ??
      mongoose.connection.model<Configuracao>(Configuracao.name, ConfiguracaoSchema);
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
    await mongoose.connection.collection('restricoes').deleteMany({});
    await mongoose.connection.collection('plantoes').deleteMany({});
    await mongoose.connection.collection('profissionaisRelacionados').deleteMany({});
    await mongoose.connection.collection('configuracoes').deleteMany({});
  });

  async function criarConfiguracao(dados: Partial<Configuracao> & { chave: string }) {
    return configuracaoModel.create({
      limiteTrocas: 3,
      maxExtras: 2,
      limitePlantoes: 12,
      maxExtrasConcursado: 1,
      maxExtrasClt: 1,
      cargas: {},
      ...dados,
    });
  }

  async function criarProfissional(dados: Partial<Profissional> = {}) {
    return profissionalModel.create({
      usuarioId: new Types.ObjectId(),
      coren: `COREN-${Math.floor(Math.random() * 900000 + 100000)}`,
      formacao: Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.CLT,
      status: StatusProfissional.ATIVO,
      sincronizaAgenda: false,
      desativadoEm: null,
      ...dados,
    });
  }

  async function criarSetor(dados: Partial<Setor> = {}) {
    return setorModel.create({
      nome: 'UTI Adulto',
      ativo: true,
      turnos: {
        diurno: { enfermeiros: 2, tecnicos: 4 },
        noturno: { enfermeiros: 2, tecnicos: 4 },
      },
      ...dados,
    });
  }

  async function criarRestricao(dados: Partial<Restricao> & { profissionalId: Types.ObjectId }) {
    return restricaoModel.create({
      tipo: TipoRestricao.INDISPONIVEL,
      inicio: new Date('2027-03-01T00:00:00.000Z'),
      fim: new Date('2027-03-31T23:59:59.000Z'),
      ...dados,
    });
  }

  async function criarPlantaoComVinculo(
    profissionalId: Types.ObjectId,
    data: Date,
    horarioInicio: '07:00' | '19:00',
    duracaoHoras: 12 | 24 = 12,
    tipo: TipoPlantao = TipoPlantao.REGULAR,
  ) {
    const horarioFim = duracaoHoras === 24 ? horarioInicio : horarioInicio === '07:00' ? '19:00' : '07:00';
    const plantao = await plantaoModel.create({
      escalaId: new Types.ObjectId(),
      setorId: new Types.ObjectId(),
      data,
      horarioInicio,
      horarioFim,
      duracaoHoras,
      tipo,
    });

    const vinculo = await plantaoProfissionalModel.create({
      plantaoId: plantao._id,
      profissionalId,
      funcao: 'enfermeiro',
      lideranca: false,
      origemCobertura: OrigemCobertura.REGULAR,
    });

    return { plantao, vinculo };
  }

  // 1. Substituto inexistente ou inativo
  it('1. rejeita substituto inexistente ou inativo', async () => {
    const setor = await criarSetor();
    const idInexistente = new Types.ObjectId();

    await expect(
      service.validar({
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: idInexistente,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(NotFoundException);

    const substitutoInativo = await criarProfissional({ status: StatusProfissional.DESATIVADO });
    await expect(
      service.validar({
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substitutoInativo._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 2. Formação incompatível
  it('2. rejeita formação incompatível com a função exigida', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({ formacao: Formacao.ENFERMEIRO });

    await expect(
      service.validar({
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'tecnico',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 3. Setor inexistente ou inativo
  it('3. rejeita setor inexistente ou inativo', async () => {
    const substituto = await criarProfissional();
    const idSetorInexistente = new Types.ObjectId();

    await expect(
      service.validar({
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: idSetorInexistente,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(NotFoundException);

    const setorInativo = await criarSetor({ ativo: false });
    await expect(
      service.validar({
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setorInativo._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 4. Substituto igual ao coberto
  it('4. impede que o substituto seja igual ao profissional coberto', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();

    await expect(
      service.validar({
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'ferias',
        cobertoId: substituto._id,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 5. Extra durante férias
  it('5. rejeita extra durante período de férias do substituto', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();

    await criarRestricao({
      profissionalId: substituto._id,
      tipo: TipoRestricao.FERIAS,
      inicio: new Date('2027-03-01T00:00:00.000Z'),
      fim: new Date('2027-03-10T23:59:59.000Z'),
    });

    await expect(
      service.validar({
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 6. Extra durante ausência
  it('6. rejeita extra durante período de ausência do substituto', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();

    await criarRestricao({
      profissionalId: substituto._id,
      tipo: TipoRestricao.AUSENCIA,
      inicio: new Date('2027-03-15T00:00:00.000Z'),
      fim: new Date('2027-03-16T23:59:59.000Z'),
      motivo: 'Congresso',
    });

    await expect(
      service.validar({
        data: '2027-03-15',
        opcao: ExtraOpcao.DOZE_NOITE,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 7. Extra no turno indisponível
  it('7. rejeita extra em turno indisponível segundo restrição configurada', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();

    // 2027-03-05 é sexta-feira (getUTCDay = 5)
    await criarRestricao({
      profissionalId: substituto._id,
      tipo: TipoRestricao.INDISPONIVEL,
      inicio: new Date('2027-03-01T00:00:00.000Z'),
      fim: new Date('2027-03-31T23:59:59.000Z'),
      diasSemana: [5],
      turno: 'diurno',
    });

    // Turno diurno bloqueado -> deve rejeitar
    await expect(
      service.validar({
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    // Turno noturno na mesma sexta-feira NÃO deve ser bloqueado pela restrição diurna
    await expect(
      service.validar({
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_NOITE,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).resolves.not.toThrow();
  });

  // 8. Extra conflitante com vínculo externo
  it('8. rejeita extra conflitante com vínculo externo', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();

    // 2027-03-03 é quarta-feira (getUTCDay = 3)
    await criarRestricao({
      profissionalId: substituto._id,
      tipo: TipoRestricao.VINCULO_EXTERNO,
      inicio: new Date('2027-03-01T00:00:00.000Z'),
      fim: new Date('2027-03-31T23:59:59.000Z'),
      diasSemana: [3],
      turno: 'noturno',
      instituicao: 'Hospital Samaritano',
    });

    await expect(
      service.validar({
        data: '2027-03-03',
        opcao: ExtraOpcao.DOZE_NOITE,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 9. Extra sobreposto a plantão regular
  it('9. rejeita extra sobreposto a plantão regular já persistido na escala', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();

    const dataPlantao = utcDate(2027, 2, 8); // 2027-03-08
    await criarPlantaoComVinculo(substituto._id, dataPlantao, '07:00', 12);

    await expect(
      service.validar({
        data: '2027-03-08',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 10. Extra sobreposto a outro extra ativo
  it('10. rejeita extra sobreposto a outro extra ativo', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();
    const autorId = new Types.ObjectId();

    await service.criar({
      data: '2027-03-08',
      opcao: ExtraOpcao.DOZE_DIA,
      setorId: setor._id,
      funcao: 'enfermeiro',
      substitutoId: substituto._id,
      motivo: 'reforco',
      criadoPor: autorId,
    });

    // 24h no mesmo dia sobrepõe as 12h existentes
    await expect(
      service.validar({
        data: '2027-03-08',
        opcao: ExtraOpcao.VINTE_QUATRO_HORAS,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 11. Jornada atravessando a meia-noite
  it('11. detecta conflito quando a jornada noturna atravessa a meia-noite para período de férias', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();

    // Férias começam em 2027-03-10 às 00:00 UTC
    await criarRestricao({
      profissionalId: substituto._id,
      tipo: TipoRestricao.FERIAS,
      inicio: new Date('2027-03-10T00:00:00.000Z'),
      fim: new Date('2027-03-20T23:59:59.000Z'),
    });

    // 2027-03-09 12n vai das 19:00 de 09/03 até 07:00 de 10/03 -> invade as férias!
    await expect(
      service.validar({
        data: '2027-03-09',
        opcao: ExtraOpcao.DOZE_NOITE,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    // 2027-03-09 12d termina às 19:00 de 09/03 -> NÃO invade as férias!
    await expect(
      service.validar({
        data: '2027-03-09',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).resolves.not.toThrow();
  });

  // 12. Descanso insuficiente entre jornadas
  it('12. rejeita jornada com descanso insuficiente (< 36h após 12h ou < 72h após 24h), permitindo 12d + 12n no mesmo dia', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();

    // Plantão anterior: 2027-03-12 12d (07:00 às 19:00)
    await criarPlantaoComVinculo(substituto._id, utcDate(2027, 2, 12), '07:00', 12);

    // Candidata no dia seguinte: 2027-03-13 12d (descanso de apenas 12h entre 19:00 e 07:00) -> rejeita!
    await expect(
      service.validar({
        data: '2027-03-13',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    // Exceção de semântica aprovada: 12d + 12n no MESMO dia (2027-03-12 19:00) -> permitido!
    await expect(
      service.validar({
        data: '2027-03-12',
        opcao: ExtraOpcao.DOZE_NOITE,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).resolves.not.toThrow();
  });

  // 13. Conflito entre meses diferentes
  it('13. detecta descanso insuficiente entre meses diferentes (fim de fevereiro e início de março)', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional();

    // Plantão no último dia de fevereiro: 2027-02-28 12n (19:00 de 28/02 às 07:00 de 01/03)
    await criarPlantaoComVinculo(substituto._id, utcDate(2027, 1, 28), '19:00', 12);

    // Extra no primeiro dia de março: 2027-03-01 12d (começa às 07:00 de 01/03) -> 0h de descanso!
    await expect(
      service.validar({
        data: '2027-03-01',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 14. Extra válido sendo cadastrado normalmente
  it('14. permite cadastrar normalmente um extra válido com validação ativada', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({ formacao: Formacao.ENFERMEIRO });
    const autorId = new Types.ObjectId();

    const extra = await service.criar(
      {
        data: '2027-03-25',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
        observacao: 'Reforço para feriado',
      },
      { validar: true },
    );

    expect(extra).toBeDefined();
    expect(extra.situacao).toBe(ExtraProgramadoSituacao.PROGRAMADO);
    expect(extra.revisao).toBe(1);
    expect(extra.substitutoId.toString()).toBe(substituto._id.toString());
    expect(extra.setorId.toString()).toBe(setor._id.toString());
    expect(await service.contarEventos(extra._id)).toBe(1);
  });

  // 15. Limite de extras para substituto CLT (maxExtrasClt)
  it('15. rejeita extra quando substituto CLT atinge limite configurado (maxExtrasClt)', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({
      formacao: Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.CLT,
    });
    const autorId = new Types.ObjectId();

    await criarConfiguracao({
      chave: '2027-03',
      maxExtras: 3,
      maxExtrasClt: 1,
      maxExtrasConcursado: 2,
    });

    // 1º extra cadastrado com sucesso
    await service.criar(
      {
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    // Tentativa do 2º extra no mesmo mês para CLT (limite 1)
    let erroCapturado: unknown;
    try {
      await service.criar(
        {
          data: '2027-03-15',
          opcao: ExtraOpcao.DOZE_DIA,
          setorId: setor._id,
          funcao: 'enfermeiro',
          substitutoId: substituto._id,
          motivo: 'reforco',
          criadoPor: autorId,
        },
        { validar: true },
      );
    } catch (err) {
      erroCapturado = err;
    }

    expect(erroCapturado).toBeInstanceOf(UnprocessableEntityException);
    const resp = (erroCapturado as UnprocessableEntityException).getResponse() as {
      erros?: Array<{ regra: string; campo: string; mensagem: string }>;
    };
    expect(resp.erros).toBeDefined();
    expect(resp.erros![0].regra).toBe('limite_extras');
    expect(resp.erros![0].campo).toBe('substitutoId');
  });

  // 16. Limite de extras para substituto CONCURSADO (maxExtrasConcursado)
  it('16. rejeita extra quando substituto concursado atinge limite configurado (maxExtrasConcursado)', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({
      formacao: Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.CONCURSADO,
    });
    const autorId = new Types.ObjectId();

    await criarConfiguracao({
      chave: '2027-03',
      maxExtras: 3,
      maxExtrasClt: 2,
      maxExtrasConcursado: 1,
    });

    // 1º extra cadastrado com sucesso
    await service.criar(
      {
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    // Tentativa do 2º extra no mesmo mês para Concursado (limite 1)
    await expect(
      service.criar(
        {
          data: '2027-03-15',
          opcao: ExtraOpcao.DOZE_DIA,
          setorId: setor._id,
          funcao: 'enfermeiro',
          substitutoId: substituto._id,
          motivo: 'reforco',
          criadoPor: autorId,
        },
        { validar: true },
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 17. Substituto RPA utiliza fallback maxExtras padrão
  it('17. aplica limite geral maxExtras como fallback para substituto RPA', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({
      formacao: Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.RPA,
    });
    const autorId = new Types.ObjectId();

    await criarConfiguracao({
      chave: '2027-03',
      maxExtras: 2,
      maxExtrasClt: 1,
      maxExtrasConcursado: 1,
    });

    // 1º extra
    await service.criar(
      {
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    // 2º extra (permitido, pois maxExtras = 2)
    await service.criar(
      {
        data: '2027-03-10',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    // 3º extra deve ser rejeitado (2/2)
    await expect(
      service.criar(
        {
          data: '2027-03-15',
          opcao: ExtraOpcao.DOZE_DIA,
          setorId: setor._id,
          funcao: 'enfermeiro',
          substitutoId: substituto._id,
          motivo: 'reforco',
          criadoPor: autorId,
        },
        { validar: true },
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 18. Semântica de fallback quando maxExtrasConcursado ou maxExtrasClt é 0
  it('18. preserva semântica de fallback para maxExtras quando maxExtrasConcursado ou maxExtrasClt é 0', async () => {
    const setor = await criarSetor();
    const concursado = await criarProfissional({
      formacao: Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.CONCURSADO,
    });
    const clt = await criarProfissional({
      formacao: Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.CLT,
    });
    const autorId = new Types.ObjectId();

    await criarConfiguracao({
      chave: '2027-03',
      maxExtras: 2,
      maxExtrasConcursado: 0,
      maxExtrasClt: 0,
    });

    // Concursado pode ter até 2 extras (fallback em maxExtras = 2)
    await service.criar(
      {
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: concursado._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    await service.criar(
      {
        data: '2027-03-10',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: concursado._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    // 3º extra do concursado excede maxExtras (2)
    await expect(
      service.criar(
        {
          data: '2027-03-15',
          opcao: ExtraOpcao.DOZE_DIA,
          setorId: setor._id,
          funcao: 'enfermeiro',
          substitutoId: concursado._id,
          motivo: 'reforco',
          criadoPor: autorId,
        },
        { validar: true },
      ),
    ).rejects.toThrow(UnprocessableEntityException);

    // CLT também pode ter 2 extras por causa do fallback
    await service.criar(
      {
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: clt._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    await service.criar(
      {
        data: '2027-03-10',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: clt._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    // 3º extra do CLT excede maxExtras (2)
    await expect(
      service.criar(
        {
          data: '2027-03-15',
          opcao: ExtraOpcao.DOZE_DIA,
          setorId: setor._id,
          funcao: 'enfermeiro',
          substitutoId: clt._id,
          motivo: 'reforco',
          criadoPor: autorId,
        },
        { validar: true },
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 19. Limite total de plantões (limitePlantoes)
  it('19. rejeita extra quando total de plantões no período excede limitePlantoes', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({ formacao: Formacao.ENFERMEIRO });
    const autorId = new Types.ObjectId();

    await criarConfiguracao({
      chave: '2027-03',
      maxExtras: 5,
      maxExtrasClt: 5,
      limitePlantoes: 2,
    });

    // 2 plantões regulares no mês (atingindo o limite de 2)
    await criarPlantaoComVinculo(substituto._id, utcDate(2027, 2, 5), '07:00', 12, TipoPlantao.REGULAR);
    await criarPlantaoComVinculo(substituto._id, utcDate(2027, 2, 10), '07:00', 12, TipoPlantao.REGULAR);

    // Tentativa de adicionar um extra -> total seria 3 > 2 (limitePlantoes)
    let erroCapturado: unknown;
    try {
      await service.criar(
        {
          data: '2027-03-20',
          opcao: ExtraOpcao.DOZE_DIA,
          setorId: setor._id,
          funcao: 'enfermeiro',
          substitutoId: substituto._id,
          motivo: 'reforco',
          criadoPor: autorId,
        },
        { validar: true },
      );
    } catch (err) {
      erroCapturado = err;
    }

    expect(erroCapturado).toBeInstanceOf(UnprocessableEntityException);
    const resp = (erroCapturado as UnprocessableEntityException).getResponse() as {
      erros?: Array<{ regra: string; campo: string; mensagem: string }>;
    };
    expect(resp.erros![0].regra).toBe('limite_plantoes');
  });

  // 20. Sem limite total quando limitePlantoes é 0
  it('20. não restringe total de plantões quando limitePlantoes é configurado como 0', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({ formacao: Formacao.ENFERMEIRO });
    const autorId = new Types.ObjectId();

    await criarConfiguracao({
      chave: '2027-03',
      maxExtras: 5,
      maxExtrasClt: 5,
      limitePlantoes: 0,
    });

    // 3 plantões regulares
    await criarPlantaoComVinculo(substituto._id, utcDate(2027, 2, 2), '07:00', 12, TipoPlantao.REGULAR);
    await criarPlantaoComVinculo(substituto._id, utcDate(2027, 2, 6), '07:00', 12, TipoPlantao.REGULAR);
    await criarPlantaoComVinculo(substituto._id, utcDate(2027, 2, 10), '07:00', 12, TipoPlantao.REGULAR);

    // Deve conseguir criar o extra normalmente
    const extra = await service.criar(
      {
        data: '2027-03-20',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    expect(extra).toBeDefined();
    expect(extra.situacao).toBe(ExtraProgramadoSituacao.PROGRAMADO);
  });

  // 21. Deduplicação: não duplica contagem de extra já vinculado a alocação na escala
  it('21. desconta uma única vez alocação já vinculada à escala ao validar limites', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({
      formacao: Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.CLT,
    });
    const autorId = new Types.ObjectId();

    await criarConfiguracao({
      chave: '2027-03',
      maxExtras: 1,
      maxExtrasClt: 1,
      limitePlantoes: 10,
    });

    // Criar plantão EXTRA na escala
    const { plantao, vinculo } = await criarPlantaoComVinculo(
      substituto._id,
      utcDate(2027, 2, 5),
      '07:00',
      12,
      TipoPlantao.EXTRA,
    );

    // Criar ExtraProgramado vinculado a esse mesmo plantão
    const extraExistente = await service.criar({
      data: '2027-03-05',
      opcao: ExtraOpcao.DOZE_DIA,
      setorId: setor._id,
      funcao: 'enfermeiro',
      substitutoId: substituto._id,
      motivo: 'reforco',
      criadoPor: autorId,
      plantaoId: plantao._id,
      plantaoProfissionalId: vinculo._id,
    });

    // Editar este mesmo extra vinculado não deve duplicar contagem (limite = 1/1)
    await expect(
      service.editar(
        extraExistente._id.toString(),
        {
          revisaoEsperada: 1,
          atualizadoPor: autorId,
          observacao: 'Edição de teste com vínculo existente',
        },
        { validar: true },
      ),
    ).resolves.toBeDefined();

    // Porém, tentar criar um 2º extra para outro dia deve ser rejeitado (1 extra já existe)
    await expect(
      service.criar(
        {
          data: '2027-03-25',
          opcao: ExtraOpcao.DOZE_DIA,
          setorId: setor._id,
          funcao: 'enfermeiro',
          substitutoId: substituto._id,
          motivo: 'reforco',
          criadoPor: autorId,
        },
        { validar: true },
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // 22. Edição do mesmo extra não provoca autoconflito de limites nem duplicidade
  it('22. permite editar o mesmo extra sem autoconflito de limites ou falsa duplicidade', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({
      formacao: Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.CLT,
    });
    const autorId = new Types.ObjectId();

    await criarConfiguracao({
      chave: '2027-03',
      maxExtras: 1,
      maxExtrasClt: 1,
    });

    const extra = await service.criar(
      {
        data: '2027-03-10',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
        observacao: 'Observação inicial',
      },
      { validar: true },
    );

    // Edição mantendo os dados que já ocupam o limite (1/1)
    const extraAtualizado = await service.editar(
      extra._id.toString(),
      {
        revisaoEsperada: 1,
        atualizadoPor: autorId,
        observacao: 'Observação atualizada com sucesso',
      },
      { validar: true },
    );

    expect(extraAtualizado.observacao).toBe('Observação atualizada com sucesso');
    expect(extraAtualizado.revisao).toBe(2);
  });

  // 23. Padronização de erros estruturados por regra e campo
  it('23. retorna erros de validação estruturados com regra e campo correspondentes', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({ formacao: Formacao.TECNICO });

    let erroFormacao: unknown;
    try {
      await service.validar({
        data: '2027-03-15',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro', // substituto é técnico!
        substitutoId: substituto._id,
        motivo: 'reforco',
      });
    } catch (err) {
      erroFormacao = err;
    }

    expect(erroFormacao).toBeInstanceOf(UnprocessableEntityException);
    const resp = (erroFormacao as UnprocessableEntityException).getResponse() as {
      message: string;
      erros: Array<{ regra: string; campo: string; mensagem: string }>;
    };
    expect(resp.erros).toBeDefined();
    expect(resp.erros[0].regra).toBe('formacao_incompativel');
    expect(resp.erros[0].campo).toBe('funcao');
  });

  // 24. Rollback transacional ao falhar validação na criação
  it('24. garante rollback transacional completo quando validação de limites ou regras falha na criação', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({
      formacao: Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.CLT,
    });
    const autorId = new Types.ObjectId();

    await criarConfiguracao({
      chave: '2027-03',
      maxExtras: 1,
      maxExtrasClt: 1,
    });

    // 1º extra criado
    await service.criar(
      {
        data: '2027-03-05',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    const totalExtrasAntes = await mongoose.connection.collection('extrasProgramados').countDocuments();
    const totalAuditoriaAntes = await mongoose.connection.collection('auditoriaExtras').countDocuments();

    // 2º extra deve falhar na validação
    await expect(
      service.criar(
        {
          data: '2027-03-15',
          opcao: ExtraOpcao.DOZE_DIA,
          setorId: setor._id,
          funcao: 'enfermeiro',
          substitutoId: substituto._id,
          motivo: 'reforco',
          criadoPor: autorId,
        },
        { validar: true },
      ),
    ).rejects.toThrow(UnprocessableEntityException);

    // Contagem no banco não pode ter mudado (sem inserções parciais)
    const totalExtrasDepois = await mongoose.connection.collection('extrasProgramados').countDocuments();
    const totalAuditoriaDepois = await mongoose.connection.collection('auditoriaExtras').countDocuments();

    expect(totalExtrasDepois).toBe(totalExtrasAntes);
    expect(totalAuditoriaDepois).toBe(totalAuditoriaAntes);
  });

  // 25. Rollback transacional ao falhar validação na edição
  it('25. garante rollback transacional quando validação falha na edição (sem alteração de dados)', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({ formacao: Formacao.ENFERMEIRO });
    const autorId = new Types.ObjectId();

    // Cria extra no dia 10
    const extra = await service.criar(
      {
        data: '2027-03-10',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    // Cria um plantão regular no dia 15
    await criarPlantaoComVinculo(substituto._id, utcDate(2027, 2, 15), '07:00', 12);

    const totalAuditoriaAntes = await mongoose.connection.collection('auditoriaExtras').countDocuments();

    // Tenta mover o extra para o dia 15 (sobreposição com o plantão regular)
    await expect(
      service.editar(
        extra._id.toString(),
        {
          revisaoEsperada: 1,
          atualizadoPor: autorId,
          data: '2027-03-15',
        },
        { validar: true },
      ),
    ).rejects.toThrow(UnprocessableEntityException);

    // Documento no banco permaneceu intacto no dia 10 com revisão 1
    const extraNoBanco = await service.buscarPorId(extra._id.toString());
    expect(extraNoBanco.data).toBe('2027-03-10');
    expect(extraNoBanco.revisao).toBe(1);

    const totalAuditoriaDepois = await mongoose.connection.collection('auditoriaExtras').countDocuments();
    expect(totalAuditoriaDepois).toBe(totalAuditoriaAntes);
  });

  // 26. Conflito de revisão na edição e cancelamento sem efeitos colaterais
  it('26. rejeita edição e cancelamento com revisão obsoleta mantendo estado intacto', async () => {
    const setor = await criarSetor();
    const substituto = await criarProfissional({ formacao: Formacao.ENFERMEIRO });
    const autorId = new Types.ObjectId();

    const extra = await service.criar(
      {
        data: '2027-03-10',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: setor._id,
        funcao: 'enfermeiro',
        substitutoId: substituto._id,
        motivo: 'reforco',
        criadoPor: autorId,
      },
      { validar: true },
    );

    // Edição com revisão obsoleta (esperava 1, enviou 99)
    await expect(
      service.editar(
        extra._id.toString(),
        {
          revisaoEsperada: 99,
          atualizadoPor: autorId,
          observacao: 'Revisão incorreta',
        },
        { validar: true },
      ),
    ).rejects.toThrow(ConflictException);

    // Cancelamento com revisão obsoleta
    await expect(
      service.cancelar(extra._id.toString(), {
        revisaoEsperada: 99,
        canceladoPor: autorId,
        justificativa: 'Motivo qualquer',
      }),
    ).rejects.toThrow(ConflictException);

    const extraNoBanco = await service.buscarPorId(extra._id.toString());
    expect(extraNoBanco.situacao).toBe(ExtraProgramadoSituacao.PROGRAMADO);
    expect(extraNoBanco.revisao).toBe(1);
  });
});

