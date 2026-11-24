import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

/** Quantitativo mínimo de um subsetor: apenas técnicos de enfermagem (enfermeiros são dimensionados no setor). */
@Schema({ _id: false })
export class QuantitativoSubsetor {
  @Prop({ required: true, min: 0 })
  tecnicos: number;
}
const QuantitativoSubsetorSchema = SchemaFactory.createForClass(QuantitativoSubsetor);

/** Subdivisão de um setor. Só existe vinculada a um setor e carrega o mínimo de técnicos do próprio subsetor. */
@Schema({ collection: 'subsetores', timestamps: true, versionKey: false })
export class Subsetor {
  @Prop({ type: Types.ObjectId, ref: 'Setor', required: true })
  setorId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nome: string;

  @Prop()
  descricao?: string;

  @Prop({ type: QuantitativoSubsetorSchema, required: true })
  plantao24h: QuantitativoSubsetor;

  @Prop({ required: true, default: true })
  ativo: boolean;

  // Preenchidos pelo Mongoose (timestamps: true); declarados apenas para tipagem.
  createdAt: Date;
  updatedAt: Date;
}

export type SubsetorDocument = HydratedDocument<Subsetor>;
export const SubsetorSchema = SchemaFactory.createForClass(Subsetor);
