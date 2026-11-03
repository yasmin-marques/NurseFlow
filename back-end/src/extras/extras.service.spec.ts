import { BadRequestException, ConflictException } from "@nestjs/common";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { ExtrasService, calcularIntervaloJornada } from "./extras.service";
import {
  ExtraEventoTipo,
  ExtraOpcao,
  ExtraProgramadoSituacao,
} from "./extras.schema";
import { ProfissionalSchema } from "../profissionais/schemas/profissional.schema";
import { jest } from "@jest/globals";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ExtrasService", () => {
  let replSet: MongoMemoryReplSet;
  let service: ExtrasService;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri("nurseflow_test"));
    service = new ExtrasService(mongoose.connection);
    await service.inicializarIndices();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.collection("extrasProgramados").deleteMany({});
    await mongoose.connection.collection("auditoriaExtras").deleteMany({});
  });

  it("cria cadastro com defaults e registra evento de criação", async () => {
    const setorId = new Types.ObjectId();
    const substitutoId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    const extra = await service.criar({
      data: "2027-03-05",
      opcao: ExtraOpcao.DOZE_DIA,
      setorId,
      funcao: "enfermeiro",
      substitutoId,
      motivo: "ferias",
      criadoPor: autorId,
      observacao: "Cobertura de férias",
    });

    expect(extra.situacao).toBe(ExtraProgramadoSituacao.PROGRAMADO);
    expect(extra.revisao).toBe(1);
    expect(extra.observacao).toBe("Cobertura de férias");
    expect(extra.plantaoProfissionalId).toBeNull();
    expect(await service.contarEventos(extra._id)).toBe(1);
    expect(await service.contarEventos(extra._id, ExtraEventoTipo.CRIADO)).toBe(
      1,
    );
  });

  it("permite múltiplos extras não vinculados ao plantão (plantaoProfissionalId: null) sem erro de índice", async () => {
    const setorId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    const extra1 = await service.criar({
      data: "2027-03-05",
      opcao: ExtraOpcao.DOZE_DIA,
      setorId,
      funcao: "enfermeiro",
      substitutoId: new Types.ObjectId(),
      motivo: "reforco",
      criadoPor: autorId,
      plantaoProfissionalId: null,
    });

    const extra2 = await service.criar({
      data: "2027-03-06",
      opcao: ExtraOpcao.DOZE_DIA,
      setorId,
      funcao: "tecnico",
      substitutoId: new Types.ObjectId(),
      motivo: "reforco",
      criadoPor: autorId,
      plantaoProfissionalId: null,
    });

    expect(extra1.plantaoProfissionalId).toBeNull();
    expect(extra2.plantaoProfissionalId).toBeNull();
  });

  it("impede dois extras com o mesmo plantaoProfissionalId preenchido (unicidade parcial)", async () => {
    const setorId = new Types.ObjectId();
    const autorId = new Types.ObjectId();
    const vinculoPlantaoId = new Types.ObjectId();

    await service.criar({
      data: "2027-03-05",
      opcao: ExtraOpcao.DOZE_DIA,
      setorId,
      funcao: "enfermeiro",
      substitutoId: new Types.ObjectId(),
      motivo: "ferias",
      criadoPor: autorId,
      plantaoProfissionalId: vinculoPlantaoId,
    });

    await expect(
      service.criar({
        data: "2027-03-06",
        opcao: ExtraOpcao.DOZE_NOITE,
        setorId,
        funcao: "tecnico",
        substitutoId: new Types.ObjectId(),
        motivo: "reforco",
        criadoPor: autorId,
        plantaoProfissionalId: vinculoPlantaoId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("impede duplicidade ativa exata de um mesmo extra", async () => {
    const setorId = new Types.ObjectId();
    const substitutoId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    await service.criar({
      data: "2027-03-05",
      opcao: ExtraOpcao.DOZE_NOITE,
      setorId,
      funcao: "tecnico",
      substitutoId,
      motivo: "atestado",
      criadoPor: autorId,
    });

    await expect(
      service.criar({
        data: "2027-03-05",
        opcao: ExtraOpcao.DOZE_NOITE,
        setorId,
        funcao: "tecnico",
        substitutoId,
        motivo: "atestado",
        criadoPor: autorId,
      }),
    ).rejects.toThrow(/duplicada|duplicado/i);
  });

  it("permite novo extra ativo se o extra anterior idêntico foi cancelado", async () => {
    const setorId = new Types.ObjectId();
    const substitutoId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    const extra = await service.criar({
      data: "2027-03-05",
      opcao: ExtraOpcao.DOZE_NOITE,
      setorId,
      funcao: "tecnico",
      substitutoId,
      motivo: "atestado",
      criadoPor: autorId,
    });

    await service.cancelar(extra._id.toString(), {
      justificativa: "Cancelado para recadastrar",
      canceladoPor: autorId,
      revisaoEsperada: 1,
    });

    const novoExtra = await service.criar({
      data: "2027-03-05",
      opcao: ExtraOpcao.DOZE_NOITE,
      setorId,
      funcao: "tecnico",
      substitutoId,
      motivo: "reforco",
      criadoPor: autorId,
    });

    expect(novoExtra.situacao).toBe(ExtraProgramadoSituacao.PROGRAMADO);
  });

  it("calcula intervalos de jornada completos sem deslocar a data por fuso", () => {
    expect(
      calcularIntervaloJornada("2027-02-28", ExtraOpcao.DOZE_NOITE),
    ).toEqual({
      inicio: new Date("2027-02-28T19:00:00.000Z"),
      fim: new Date("2027-03-01T07:00:00.000Z"),
    });

    expect(
      calcularIntervaloJornada("2027-03-31", ExtraOpcao.VINTE_QUATRO_HORAS),
    ).toEqual({
      inicio: new Date("2027-03-31T07:00:00.000Z"),
      fim: new Date("2027-04-01T07:00:00.000Z"),
    });

    expect(
      calcularIntervaloJornada("2027-12-31", ExtraOpcao.DOZE_NOITE),
    ).toEqual({
      inicio: new Date("2027-12-31T19:00:00.000Z"),
      fim: new Date("2028-01-01T07:00:00.000Z"),
    });

    expect(
      calcularIntervaloJornada("2024-02-28", ExtraOpcao.DOZE_NOITE),
    ).toEqual({
      inicio: new Date("2024-02-28T19:00:00.000Z"),
      fim: new Date("2024-02-29T07:00:00.000Z"),
    });

    expect(calcularIntervaloJornada("2024-02-29", ExtraOpcao.DOZE_DIA)).toEqual(
      {
        inicio: new Date("2024-02-29T07:00:00.000Z"),
        fim: new Date("2024-02-29T19:00:00.000Z"),
      },
    );

    expect(() =>
      calcularIntervaloJornada("2027-02-29", ExtraOpcao.DOZE_DIA),
    ).toThrow(BadRequestException);
    expect(() =>
      calcularIntervaloJornada("2027-04-31", ExtraOpcao.DOZE_DIA),
    ).toThrow(BadRequestException);
    expect(() =>
      calcularIntervaloJornada("data-invalida", ExtraOpcao.DOZE_DIA),
    ).toThrow(BadRequestException);
  });

  it("rejeita edição com data ou opção inválidas", async () => {
    const setorId = new Types.ObjectId();
    const substitutoId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    const extra = await service.criar({
      data: "2027-04-10",
      opcao: ExtraOpcao.DOZE_DIA,
      setorId,
      funcao: "enfermeiro",
      substitutoId,
      motivo: "reforco",
      criadoPor: autorId,
    });

    await expect(
      service.editar(extra._id.toString(), {
        data: "2027-02-29",
        revisaoEsperada: 1,
        atualizadoPor: autorId,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.editar(extra._id.toString(), {
        opcao: "opcao_invalida" as unknown as ExtraOpcao,
        revisaoEsperada: 1,
        atualizadoPor: autorId,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.editar(extra._id.toString(), {
        motivo: "   ",
        revisaoEsperada: 1,
        atualizadoPor: autorId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejeita cancelamento com justificativa vazia ou somente com espaços", async () => {
    const setorId = new Types.ObjectId();
    const substitutoId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    const extra = await service.criar({
      data: "2027-04-10",
      opcao: ExtraOpcao.DOZE_DIA,
      setorId,
      funcao: "enfermeiro",
      substitutoId,
      motivo: "reforco",
      criadoPor: autorId,
    });

    await expect(
      service.cancelar(extra._id.toString(), {
        justificativa: "",
        canceladoPor: autorId,
        revisaoEsperada: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.cancelar(extra._id.toString(), {
        justificativa: "     ",
        canceladoPor: autorId,
        revisaoEsperada: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejeita edição e cancelamento com revisão obsoleta", async () => {
    const setorId = new Types.ObjectId();
    const substitutoId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    const extra = await service.criar({
      data: "2027-04-10",
      opcao: ExtraOpcao.DOZE_DIA,
      setorId,
      funcao: "enfermeiro",
      substitutoId,
      motivo: "reforco",
      criadoPor: autorId,
    });

    await expect(
      service.editar(extra._id.toString(), {
        observacao: "novo detalhe",
        revisaoEsperada: 0,
        atualizadoPor: autorId,
      }),
    ).rejects.toThrow(ConflictException);

    const cancelado = await service.cancelar(extra._id.toString(), {
      justificativa: "Ajuste de agenda",
      canceladoPor: autorId,
      revisaoEsperada: extra.revisao,
    });

    expect(cancelado.situacao).toBe(ExtraProgramadoSituacao.CANCELADO);
    expect(cancelado.justificativaCancelamento).toBe("Ajuste de agenda");
    expect(
      await service.contarEventos(extra._id, ExtraEventoTipo.CANCELADO),
    ).toBe(1);

    await expect(
      service.cancelar(extra._id.toString(), {
        justificativa: "Repetindo cancelamento",
        canceladoPor: autorId,
        revisaoEsperada: cancelado.revisao,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("valida ObjectIds inválidos de modo controlado", async () => {
    const autorId = new Types.ObjectId();

    await expect(
      service.criar({
        data: "2027-04-10",
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: "id_invalido",
        funcao: "enfermeiro",
        substitutoId: new Types.ObjectId(),
        motivo: "reforco",
        criadoPor: autorId,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.criar({
        data: "2027-04-10",
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: new Types.ObjectId(),
        funcao: "enfermeiro",
        substitutoId: "substituto_invalido",
        motivo: "reforco",
        criadoPor: autorId,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.editar("extra_id_invalido", {
        revisaoEsperada: 1,
        atualizadoPor: autorId,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.cancelar("extra_id_invalido", {
        justificativa: "cancelar",
        revisaoEsperada: 1,
        canceladoPor: autorId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("provoca rollback e não persiste extra quando gravação da auditoria falha", async () => {
    const setorId = new Types.ObjectId();
    const substitutoId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    const auditoriaModel = mongoose.connection.model("AuditoriaExtra");
    const originalCreate = auditoriaModel.create;
    jest.spyOn(auditoriaModel, "create").mockImplementationOnce(async () => {
      throw new Error("Falha simulada na auditoria");
    });

    await expect(
      service.criar({
        data: "2027-05-15",
        opcao: ExtraOpcao.DOZE_DIA,
        setorId,
        funcao: "enfermeiro",
        substitutoId,
        motivo: "reforco",
        criadoPor: autorId,
      }),
    ).rejects.toThrow("Falha simulada na auditoria");

    const totalExtras = await mongoose.connection
      .collection("extrasProgramados")
      .countDocuments({ data: "2027-05-15" });
    expect(totalExtras).toBe(0);

    const totalAuditorias = await mongoose.connection
      .collection("extrasProgramados")
      .countDocuments({ data: "2027-05-15" });
    expect(totalAuditorias).toBe(0);

    auditoriaModel.create = originalCreate;
  });

  it("garante que falha na auditoria de edição/cancelamento não deixa estado parcial", async () => {
    const setorId = new Types.ObjectId();
    const substitutoId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    const extra = await service.criar({
      data: "2027-06-01",
      opcao: ExtraOpcao.DOZE_DIA,
      setorId,
      funcao: "enfermeiro",
      substitutoId,
      motivo: "reforco",
      criadoPor: autorId,
      observacao: "Original",
    });

    const auditoriaModel = mongoose.connection.model("AuditoriaExtra");
    jest.spyOn(auditoriaModel, "create").mockImplementationOnce(async () => {
      throw new Error("Falha simulada na auditoria durante edição");
    });

    await expect(
      service.editar(extra._id.toString(), {
        observacao: "Modificado",
        revisaoEsperada: 1,
        atualizadoPor: autorId,
      }),
    ).rejects.toThrow("Falha simulada na auditoria durante edição");

    const naoModificado = await service.buscarPorId(extra._id.toString());
    expect(naoModificado?.observacao).toBe("Original");
    expect(naoModificado?.revisao).toBe(1);

    jest.spyOn(auditoriaModel, "create").mockImplementationOnce(async () => {
      throw new Error("Falha simulada na auditoria durante cancelamento");
    });

    await expect(
      service.cancelar(extra._id.toString(), {
        justificativa: "Tentativa de cancelamento",
        revisaoEsperada: 1,
        canceladoPor: autorId,
      }),
    ).rejects.toThrow("Falha simulada na auditoria durante cancelamento");

    const aindaAtivo = await service.buscarPorId(extra._id.toString());
    expect(aindaAtivo?.situacao).toBe(ExtraProgramadoSituacao.PROGRAMADO);
    expect(aindaAtivo?.revisao).toBe(1);
    expect(aindaAtivo?.justificativaCancelamento).toBeNull();
  });

  it("permite que apenas uma de duas reservas incompatíveis concorrentes seja persistida", async () => {
    const setorId = new Types.ObjectId();
    const substitutoId = new Types.ObjectId();
    const autorId = new Types.ObjectId();

    const dto = {
      data: "2027-07-20",
      opcao: ExtraOpcao.DOZE_DIA,
      setorId,
      funcao: "enfermeiro" as const,
      substitutoId,
      motivo: "reforco",
      criadoPor: autorId,
    };

    const [res1, res2] = await Promise.allSettled([
      service.criar(dto),
      service.criar(dto),
    ]);

    const fulFilled = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejected = [res1, res2].filter((r) => r.status === "rejected");

    expect(fulFilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );

    const gravados = await mongoose.connection
      .collection("extrasProgramados")
      .countDocuments({
        data: "2027-07-20",
        substitutoId,
      });
    expect(gravados).toBe(1);
  });

  it("garante que o schema de Profissional não possui campo extrasProgramados embutido", () => {
    expect(ProfissionalSchema.path("extrasProgramados")).toBeUndefined();
  });
});
