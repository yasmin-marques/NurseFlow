import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, HydratedDocument, Types } from "mongoose";

export enum TipoRestricao {
  INDISPONIVEL = "indisponivel",
  DISPONIVEL = "disponivel",
  FERIAS = "ferias",
  AUSENCIA = "ausencia",
  VINCULO_EXTERNO = "vinculo_externo",
}

@Schema({ collection: "restricoes", timestamps: true, versionKey: false })
export class Restricao {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Profissional",
    required: true,
  })
  profissionalId: Types.ObjectId;

  @Prop({ required: true, enum: TipoRestricao }) tipo: TipoRestricao;
  @Prop({ required: true }) inicio: Date;
  @Prop({ required: true }) fim: Date;

  @Prop({
    type: [Number],
    default: undefined,
    validate: {
      validator: (valor: number[] | undefined | null) =>
        !valor ||
        (valor.every((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6) &&
          new Set(valor).size === valor.length),
      message:
        "diasSemana deve conter valores únicos entre 0 e 6 para cada dia da semana.",
    },
  })
  diasSemana?: number[] | null;
  @Prop({ type: Number, min: 0, max: 6, default: null }) diaSemana?:
    | number
    | null;

  @Prop({
    type: String,
    enum: ["diurno", "noturno", "flexivel"],
    default: null,
  })
  turno?: "diurno" | "noturno" | "flexivel" | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null }) motivo?:
    | string
    | null;

  @Prop({ type: String, trim: true, maxlength: 300, default: null })
  observacao?: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  instituicao?: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  tipoVinculo?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export type RestricaoDocument = HydratedDocument<Restricao>;
export const RestricaoSchema = SchemaFactory.createForClass(Restricao);
