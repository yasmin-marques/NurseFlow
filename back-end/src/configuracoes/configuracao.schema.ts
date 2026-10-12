import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TipoVinculo } from '../profissionais/profissionais.enums';

@Schema({ collection: 'configuracoes', timestamps: true, versionKey: false })
export class Configuracao {
  @Prop({ required: true, unique: true }) chave: string;
  @Prop({ type: Number, min: 0, default: 3 }) limiteTrocas: number;
  @Prop({ type: Number, min: 0, default: 0 }) maxExtras: number;
  @Prop({ type: Number, min: 0, default: 0 }) limitePlantoes: number;
  @Prop({ type: Object, default: {} }) cargas: Record<string, { plantoes24h: number; plantoes12h: number }>;
  createdAt: Date;
  updatedAt: Date;
}
export type ConfiguracaoDocument = HydratedDocument<Configuracao>;
export const ConfiguracaoSchema = SchemaFactory.createForClass(Configuracao);
export const chaveCarga = (v: TipoVinculo, dias: number) => `${v}_${dias}`;
