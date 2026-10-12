import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, HydratedDocument, Types } from 'mongoose';
export enum TipoRestricao { INDISPONIVEL = 'indisponivel', DISPONIVEL = 'disponivel', FERIAS = 'ferias', AUSENCIA = 'ausencia', VINCULO_EXTERNO = 'vinculo_externo' }
@Schema({ collection: 'restricoes', timestamps: true, versionKey: false })
export class Restricao {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Profissional', required: true }) profissionalId: Types.ObjectId;
  @Prop({ required: true, enum: TipoRestricao }) tipo: TipoRestricao;
  @Prop({ required: true }) inicio: Date;
  @Prop({ required: true }) fim: Date;
  @Prop({ type: Number, min: 0, max: 6, default: null }) diaSemana?: number | null;
  @Prop({ trim: true, maxlength: 300 }) observacao?: string;
  createdAt: Date;
  updatedAt: Date;
}
export type RestricaoDocument = HydratedDocument<Restricao>;
export const RestricaoSchema = SchemaFactory.createForClass(Restricao);
