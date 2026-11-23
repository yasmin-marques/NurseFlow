import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Quantitativo mínimo de profissionais por função em um turno (DA08). O chefe do plantão conta entre os enfermeiros. */
@Schema({ _id: false })
export class Quantitativo {
  @Prop({ required: true, min: 0 })
  enfermeiros: number;

  @Prop({ required: true, min: 0 })
  tecnicos: number;
}
const QuantitativoSchema = SchemaFactory.createForClass(Quantitativo);

@Schema({ _id: false })
export class TurnosSetor {
  @Prop({ type: QuantitativoSchema, required: true })
  diurno: Quantitativo;

  @Prop({ type: QuantitativoSchema, required: true })
  noturno: Quantitativo;
}
const TurnosSetorSchema = SchemaFactory.createForClass(TurnosSetor);

@Schema({ collection: 'setores', timestamps: true, versionKey: false })
export class Setor {
  @Prop({ required: true, trim: true })
  nome: string;

  @Prop()
  descricao?: string;

  @Prop({ type: TurnosSetorSchema, required: true })
  turnos: TurnosSetor;

  @Prop({ required: true, default: true })
  ativo: boolean;

  // Preenchidos pelo Mongoose (timestamps: true); declarados apenas para tipagem.
  createdAt: Date;
  updatedAt: Date;
}

export type SetorDocument = HydratedDocument<Setor>;
export const SetorSchema = SchemaFactory.createForClass(Setor);
