import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Quantitativo mínimo de profissionais por função em um plantão de 24h. O chefe conta entre os enfermeiros. */
@Schema({ _id: false })
export class Quantitativo {
  @Prop({ required: true, min: 0 })
  enfermeiros: number;

  @Prop({ required: true, min: 0 })
  tecnicos: number;
}
const QuantitativoSchema = SchemaFactory.createForClass(Quantitativo);

@Schema({ collection: 'setores', timestamps: true, versionKey: false })
export class Setor {
  @Prop({ required: true, trim: true })
  nome: string;

  @Prop()
  descricao?: string;

  @Prop({ type: QuantitativoSchema, required: true })
  plantao24h: Quantitativo;

  @Prop({ required: true, default: true })
  ativo: boolean;

  // Preenchidos pelo Mongoose (timestamps: true); declarados apenas para tipagem.
  createdAt: Date;
  updatedAt: Date;
}

export type SetorDocument = HydratedDocument<Setor>;
export const SetorSchema = SchemaFactory.createForClass(Setor);
