import { BadRequestException } from "@nestjs/common";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  Schema as MongooseSchema,
  type HydratedDocument,
  Types,
} from "mongoose";

export enum ExtraOpcao {
  DOZE_DIA = "12d",
  DOZE_NOITE = "12n",
  VINTE_QUATRO_HORAS = "24h",
}

export enum ExtraMotivo {
  FERIAS = "ferias",
  AUSENCIA = "ausencia",
  ATESTADO = "atestado",
  REFORCO = "reforco",
  OUTRO = "outro",
}

export enum ExtraProgramadoSituacao {
  PROGRAMADO = "programado",
  CANCELADO = "cancelado",
}

export enum ExtraEventoTipo {
  CRIADO = "CRIADO",
  EDITADO = "EDITADO",
  CANCELADO = "CANCELADO",
  VINCULADO = "VINCULADO",
  DESVINCULADO = "DESVINCULADO",
}

@Schema({
  collection: "extrasProgramados",
  timestamps: true,
  versionKey: false,
})
export class ExtraProgramado {
  @Prop({ type: Types.ObjectId, ref: "Profissional", required: true })
  substitutoId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  data: string;

  @Prop({ required: true, enum: ExtraOpcao })
  opcao: ExtraOpcao;

  @Prop({ type: Types.ObjectId, ref: "Setor", required: true })
  setorId: Types.ObjectId;

  @Prop({ required: true, enum: ["enfermeiro", "tecnico"] })
  funcao: string;

  @Prop({ type: Types.ObjectId, ref: "Profissional", default: null })
  cobertoId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: "Restricao", default: null })
  restricaoId?: Types.ObjectId | null;

  @Prop({ required: true, enum: ExtraMotivo, default: ExtraMotivo.OUTRO })
  motivo: ExtraMotivo | string;

  @Prop({ type: String, default: null, trim: true })
  observacao?: string | null;

  @Prop({
    required: true,
    enum: ExtraProgramadoSituacao,
    default: ExtraProgramadoSituacao.PROGRAMADO,
  })
  situacao: ExtraProgramadoSituacao;

  @Prop({ type: Types.ObjectId, ref: "Escala", default: null })
  escalaId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: "Plantao", default: null })
  plantaoId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: "PlantaoProfissional", default: null })
  plantaoProfissionalId?: Types.ObjectId | null;

  @Prop({ required: true, min: 1, default: 1 })
  revisao: number;

  @Prop({ type: Types.ObjectId, ref: "Usuario", required: true })
  criadoPor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Usuario", default: null })
  atualizadoPor?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: "Usuario", default: null })
  canceladoPor?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  canceladoEm?: Date | null;

  @Prop({ type: String, trim: true, default: null })
  justificativaCancelamento?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export type ExtraProgramadoDocument = HydratedDocument<ExtraProgramado>;
export const ExtraProgramadoSchema =
  SchemaFactory.createForClass(ExtraProgramado);

ExtraProgramadoSchema.index({ data: 1, situacao: 1 });
ExtraProgramadoSchema.index({ substitutoId: 1, data: 1 });
ExtraProgramadoSchema.index({ setorId: 1, data: 1 });
ExtraProgramadoSchema.index(
  { plantaoProfissionalId: 1 },
  {
    unique: true,
    partialFilterExpression: { plantaoProfissionalId: { $type: "objectId" } },
  },
);
ExtraProgramadoSchema.index(
  { substitutoId: 1, data: 1, opcao: 1 },
  {
    unique: true,
    partialFilterExpression: { situacao: ExtraProgramadoSituacao.PROGRAMADO },
  },
);

@Schema({ collection: "auditoriaExtras", timestamps: true, versionKey: false })
export class AuditoriaExtra {
  @Prop({ type: Types.ObjectId, ref: "ExtraProgramado", required: true })
  extraId: Types.ObjectId;

  @Prop({ required: true, enum: ExtraEventoTipo })
  evento: ExtraEventoTipo;

  @Prop({ type: Types.ObjectId, ref: "Usuario", required: true })
  usuarioId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  revisao: number;

  @Prop({ required: true, default: () => new Date() })
  ocorridoEm: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  detalhes?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export type AuditoriaExtraDocument = HydratedDocument<AuditoriaExtra>;
export const AuditoriaExtraSchema =
  SchemaFactory.createForClass(AuditoriaExtra);

export function validarDataCivil(data: string): void {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(data)) {
    throw new BadRequestException(
      "A data do extra deve seguir o formato YYYY-MM-DD.",
    );
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const dataObj = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    dataObj.getUTCFullYear() !== ano ||
    dataObj.getUTCMonth() !== mes - 1 ||
    dataObj.getUTCDate() !== dia
  ) {
    throw new BadRequestException("A data do extra é inválida.");
  }
}

export function calcularIntervaloJornada(
  data: string,
  opcao: ExtraOpcao,
): { inicio: Date; fim: Date } {
  validarDataCivil(data);
  const [ano, mes, dia] = data.split("-").map(Number);
  const base = Date.UTC(ano, mes - 1, dia);

  switch (opcao) {
    case ExtraOpcao.DOZE_DIA:
      return {
        inicio: new Date(base + 7 * 60 * 60 * 1000),
        fim: new Date(base + 19 * 60 * 60 * 1000),
      };
    case ExtraOpcao.DOZE_NOITE:
      return {
        inicio: new Date(base + 19 * 60 * 60 * 1000),
        fim: new Date(base + 31 * 60 * 60 * 1000),
      };
    case ExtraOpcao.VINTE_QUATRO_HORAS:
      return {
        inicio: new Date(base + 7 * 60 * 60 * 1000),
        fim: new Date(base + 31 * 60 * 60 * 1000),
      };
    default:
      throw new BadRequestException(`Opção inválida: ${String(opcao)}`);
  }
}
