import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import {
  type ClientSession,
  type Connection,
  type QueryFilter,
  type Model,
  Types,
  isValidObjectId,
} from "mongoose";
import { executarTransacao } from "../common/utils/mongo-transaction";
import {
  AuditoriaExtra,
  AuditoriaExtraDocument,
  AuditoriaExtraSchema,
  ExtraEventoTipo,
  ExtraMotivo,
  ExtraOpcao,
  ExtraProgramado,
  ExtraProgramadoDocument,
  ExtraProgramadoSchema,
  ExtraProgramadoSituacao,
  calcularIntervaloJornada,
  validarDataCivil,
} from "./extras.schema";

export type CriarExtraDto = {
  data: string;
  opcao: ExtraOpcao;
  setorId: Types.ObjectId | string;
  funcao: "enfermeiro" | "tecnico";
  substitutoId: Types.ObjectId | string;
  motivo: string;
  cobertoId?: Types.ObjectId | string | null;
  restricaoId?: Types.ObjectId | string | null;
  observacao?: string | null;
  criadoPor: Types.ObjectId | string;
  escalaId?: Types.ObjectId | string | null;
  plantaoId?: Types.ObjectId | string | null;
  plantaoProfissionalId?: Types.ObjectId | string | null;
};

export type AtualizarExtraDto = {
  data?: string;
  opcao?: ExtraOpcao;
  setorId?: Types.ObjectId | string;
  funcao?: "enfermeiro" | "tecnico";
  substitutoId?: Types.ObjectId | string;
  motivo?: string;
  cobertoId?: Types.ObjectId | string | null;
  restricaoId?: Types.ObjectId | string | null;
  observacao?: string | null;
  atualizadoPor: Types.ObjectId | string;
  revisaoEsperada: number;
  escalaId?: Types.ObjectId | string | null;
  plantaoId?: Types.ObjectId | string | null;
  plantaoProfissionalId?: Types.ObjectId | string | null;
};

export type CancelarExtraDto = {
  justificativa: string;
  canceladoPor: Types.ObjectId | string;
  revisaoEsperada: number;
};

@Injectable()
export class ExtrasService {
  private readonly extraModel: Model<ExtraProgramado>;
  private readonly auditoriaModel: Model<AuditoriaExtra>;

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.extraModel =
      (this.connection.models["ExtraProgramado"] as
        | Model<ExtraProgramado>
        | undefined) ??
      this.connection.model<ExtraProgramado>(
        "ExtraProgramado",
        ExtraProgramadoSchema,
      );

    this.auditoriaModel =
      (this.connection.models["AuditoriaExtra"] as
        | Model<AuditoriaExtra>
        | undefined) ??
      this.connection.model<AuditoriaExtra>(
        "AuditoriaExtra",
        AuditoriaExtraSchema,
      );
  }

  async inicializarIndices(): Promise<void> {
    await this.extraModel.createIndexes();
    await this.auditoriaModel.createIndexes();
  }

  normalizarId(
    valor: Types.ObjectId | string | null | undefined,
    campo = "ID",
  ): Types.ObjectId | null {
    if (valor == null || valor === "") return null;
    if (valor instanceof Types.ObjectId) return valor;
    if (typeof valor === "string") {
      if (!isValidObjectId(valor)) {
        throw new BadRequestException(`${campo} inválido: ${valor}.`);
      }
      return new Types.ObjectId(valor);
    }
    throw new BadRequestException(`${campo} inválido.`);
  }

  private async registrarEvento(
    extraId: Types.ObjectId,
    evento: ExtraEventoTipo,
    usuarioId: Types.ObjectId,
    revisao: number,
    detalhes: Record<string, unknown> = {},
    session?: ClientSession,
  ): Promise<void> {
    await this.auditoriaModel.create(
      [
        {
          extraId,
          evento,
          usuarioId,
          revisao,
          detalhes,
          ocorridoEm: new Date(),
        },
      ],
      session ? { session } : {},
    );
  }

  async criar(dto: CriarExtraDto): Promise<ExtraProgramadoDocument> {
    this.validarData(dto.data);
    if (!dto.opcao || !Object.values(ExtraOpcao).includes(dto.opcao)) {
      throw new BadRequestException("Opção de jornada inválida.");
    }
    if (!dto.funcao || !["enfermeiro", "tecnico"].includes(dto.funcao)) {
      throw new BadRequestException(
        "Função inválida. Deve ser enfermeiro ou tecnico.",
      );
    }
    if (!dto.motivo || !dto.motivo.trim()) {
      throw new BadRequestException("Motivo é obrigatório.");
    }
    if (!dto.setorId) throw new BadRequestException("Setor é obrigatório.");
    if (!dto.substitutoId)
      throw new BadRequestException("Substituto é obrigatório.");
    if (!dto.criadoPor)
      throw new BadRequestException("Usuário criador é obrigatório.");

    const setorId = this.normalizarId(dto.setorId, "Setor")!;
    const substitutoId = this.normalizarId(dto.substitutoId, "Substituto")!;
    const criadoPor = this.normalizarId(dto.criadoPor, "criadoPor")!;
    const cobertoId = this.normalizarId(dto.cobertoId, "cobertoId");
    const restricaoId = this.normalizarId(dto.restricaoId, "restricaoId");
    const escalaId = this.normalizarId(dto.escalaId, "escalaId");
    const plantaoId = this.normalizarId(dto.plantaoId, "plantaoId");
    const plantaoProfissionalId = this.normalizarId(
      dto.plantaoProfissionalId,
      "plantaoProfissionalId",
    );

    const payload = {
      data: dto.data,
      opcao: dto.opcao,
      setorId,
      funcao: dto.funcao,
      substitutoId,
      motivo: dto.motivo.trim(),
      cobertoId,
      restricaoId,
      observacao: dto.observacao?.trim() ?? null,
      situacao: ExtraProgramadoSituacao.PROGRAMADO,
      escalaId,
      plantaoId,
      plantaoProfissionalId,
      revisao: 1,
      criadoPor,
      atualizadoPor: null,
      canceladoPor: null,
      canceladoEm: null,
      justificativaCancelamento: null,
    };

    return await executarTransacao(this.connection, async (session) => {
      try {
        const [extra] = await this.extraModel.create([payload], { session });
        await this.registrarEvento(
          extra._id,
          ExtraEventoTipo.CRIADO,
          criadoPor,
          1,
          { data: dto.data, opcao: dto.opcao },
          session,
        );
        return extra;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("duplicate") ||
          message.includes("duplicada") ||
          message.includes("duplicado") ||
          (error as { code?: number }).code === 11000
        ) {
          throw new ConflictException(
            "Extra programado duplicado. Já existe um registro ativo para o mesmo substituto, data e opção ou alocação vinculada duplicada.",
          );
        }
        throw error;
      }
    });
  }

  async editar(
    id: string,
    dto: AtualizarExtraDto,
  ): Promise<ExtraProgramadoDocument> {
    const extraId = this.normalizarId(id, "ID do extra");
    if (!extraId) throw new BadRequestException("ID do extra é obrigatório.");

    if (!dto.atualizadoPor) {
      throw new BadRequestException("Usuário atualizador é obrigatório.");
    }
    const atualizadoPor = this.normalizarId(
      dto.atualizadoPor,
      "atualizadoPor",
    )!;

    if (
      dto.revisaoEsperada == null ||
      typeof dto.revisaoEsperada !== "number"
    ) {
      throw new BadRequestException("Revisão esperada é obrigatória.");
    }

    if (dto.data != null) {
      this.validarData(dto.data);
    }
    if (dto.opcao != null && !Object.values(ExtraOpcao).includes(dto.opcao)) {
      throw new BadRequestException("Opção de jornada inválida.");
    }
    if (dto.funcao != null && !["enfermeiro", "tecnico"].includes(dto.funcao)) {
      throw new BadRequestException(
        "Função inválida. Deve ser enfermeiro ou tecnico.",
      );
    }
    if (dto.motivo != null && !dto.motivo.trim()) {
      throw new BadRequestException("Motivo não pode ser vazio.");
    }

    const setorId =
      dto.setorId !== undefined
        ? this.normalizarId(dto.setorId, "Setor")
        : undefined;
    const substitutoId =
      dto.substitutoId !== undefined
        ? this.normalizarId(dto.substitutoId, "Substituto")
        : undefined;
    const cobertoId =
      dto.cobertoId !== undefined
        ? this.normalizarId(dto.cobertoId, "cobertoId")
        : undefined;
    const restricaoId =
      dto.restricaoId !== undefined
        ? this.normalizarId(dto.restricaoId, "restricaoId")
        : undefined;
    const escalaId =
      dto.escalaId !== undefined
        ? this.normalizarId(dto.escalaId, "escalaId")
        : undefined;
    const plantaoId =
      dto.plantaoId !== undefined
        ? this.normalizarId(dto.plantaoId, "plantaoId")
        : undefined;
    const plantaoProfissionalId =
      dto.plantaoProfissionalId !== undefined
        ? this.normalizarId(dto.plantaoProfissionalId, "plantaoProfissionalId")
        : undefined;

    return await executarTransacao(this.connection, async (session) => {
      const atual = await this.extraModel
        .findById(extraId)
        .session(session)
        .exec();
      if (!atual)
        throw new NotFoundException("Extra programado não encontrado.");
      if (atual.situacao === ExtraProgramadoSituacao.CANCELADO) {
        throw new ConflictException(
          "Não é possível editar um extra cancelado.",
        );
      }
      if (dto.revisaoEsperada !== atual.revisao) {
        throw new ConflictException(
          `Revisão obsoleta: esperava ${atual.revisao}, recebeu ${dto.revisaoEsperada}.`,
        );
      }

      const patch: Record<string, unknown> = {
        ...(dto.data != null ? { data: dto.data } : {}),
        ...(dto.opcao != null ? { opcao: dto.opcao } : {}),
        ...(setorId !== undefined ? { setorId } : {}),
        ...(dto.funcao != null ? { funcao: dto.funcao } : {}),
        ...(substitutoId !== undefined ? { substitutoId } : {}),
        ...(dto.motivo != null ? { motivo: dto.motivo.trim() } : {}),
        ...(cobertoId !== undefined ? { cobertoId } : {}),
        ...(restricaoId !== undefined ? { restricaoId } : {}),
        ...(dto.observacao !== undefined
          ? { observacao: dto.observacao?.trim() ?? null }
          : {}),
        ...(escalaId !== undefined ? { escalaId } : {}),
        ...(plantaoId !== undefined ? { plantaoId } : {}),
        ...(plantaoProfissionalId !== undefined
          ? { plantaoProfissionalId }
          : {}),
        atualizadoPor,
        revisao: atual.revisao + 1,
      };

      try {
        const atualizado = await this.extraModel
          .findOneAndUpdate(
            { _id: extraId, revisao: dto.revisaoEsperada },
            { $set: patch },
            { new: true, runValidators: true, session },
          )
          .exec();

        if (!atualizado) {
          throw new ConflictException(
            "Extra programado não pôde ser atualizado porque a revisão ficou obsoleta.",
          );
        }

        await this.registrarEvento(
          extraId,
          ExtraEventoTipo.EDITADO,
          atualizadoPor,
          atual.revisao + 1,
          { campos: Object.keys(patch) },
          session,
        );

        return atualizado;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("duplicate") ||
          message.includes("duplicada") ||
          message.includes("duplicado") ||
          (error as { code?: number }).code === 11000
        ) {
          throw new ConflictException(
            "Extra programado duplicado. Já existe um registro ativo para o mesmo substituto, data e opção ou alocação vinculada duplicada.",
          );
        }
        throw error;
      }
    });
  }

  async cancelar(
    id: string,
    dto: CancelarExtraDto,
  ): Promise<ExtraProgramadoDocument> {
    const extraId = this.normalizarId(id, "ID do extra");
    if (!extraId) throw new BadRequestException("ID do extra é obrigatório.");

    if (!dto.justificativa || !dto.justificativa.trim()) {
      throw new BadRequestException(
        "A justificativa do cancelamento é obrigatória.",
      );
    }

    if (!dto.canceladoPor) {
      throw new BadRequestException(
        "Usuário responsável pelo cancelamento é obrigatório.",
      );
    }
    const canceladoPor = this.normalizarId(dto.canceladoPor, "canceladoPor")!;

    if (
      dto.revisaoEsperada == null ||
      typeof dto.revisaoEsperada !== "number"
    ) {
      throw new BadRequestException("Revisão esperada é obrigatória.");
    }

    return await executarTransacao(this.connection, async (session) => {
      const atual = await this.extraModel
        .findById(extraId)
        .session(session)
        .exec();
      if (!atual)
        throw new NotFoundException("Extra programado não encontrado.");
      if (atual.situacao === ExtraProgramadoSituacao.CANCELADO) {
        throw new ConflictException("Esse extra já está cancelado.");
      }
      if (dto.revisaoEsperada !== atual.revisao) {
        throw new ConflictException(
          `Revisão obsoleta: esperava ${atual.revisao}, recebeu ${dto.revisaoEsperada}.`,
        );
      }

      const cancelado = await this.extraModel
        .findOneAndUpdate(
          { _id: extraId, revisao: dto.revisaoEsperada },
          {
            $set: {
              situacao: ExtraProgramadoSituacao.CANCELADO,
              canceladoPor,
              canceladoEm: new Date(),
              justificativaCancelamento: dto.justificativa.trim(),
              revisao: atual.revisao + 1,
            },
          },
          { new: true, runValidators: true, session },
        )
        .exec();

      if (!cancelado) {
        throw new ConflictException(
          "Não foi possível cancelar o extra por conflito de revisão.",
        );
      }

      await this.registrarEvento(
        extraId,
        ExtraEventoTipo.CANCELADO,
        canceladoPor,
        atual.revisao + 1,
        { justificativa: dto.justificativa.trim() },
        session,
      );

      return cancelado;
    });
  }

  async buscarPorId(
    id: Types.ObjectId | string,
  ): Promise<ExtraProgramadoDocument | null> {
    const extraId = this.normalizarId(id, "ID do extra");
    return this.extraModel.findById(extraId).exec();
  }

  async contarEventos(
    extraId: Types.ObjectId | string,
    evento?: ExtraEventoTipo,
  ): Promise<number> {
    const id = this.normalizarId(extraId, "ID do extra");
    const filtro: QueryFilter<AuditoriaExtraDocument> = { extraId: id };
    if (evento) filtro.evento = evento;
    return this.auditoriaModel.countDocuments(filtro).exec();
  }

  validarData(data: string): void {
    validarDataCivil(data);
  }
}

export {
  calcularIntervaloJornada,
  validarDataCivil,
  ExtraOpcao,
  ExtraMotivo,
  ExtraProgramadoSituacao,
  ExtraEventoTipo,
};
