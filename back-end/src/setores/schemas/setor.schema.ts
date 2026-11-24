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

  /**
   * Quantitativo mínimo do setor. `enfermeiros` é sempre definido no setor. `tecnicos` é o mínimo próprio do setor
   * apenas quando `possuiSubsetores` é false; quando é true, o mínimo de técnicos pertence aos subsetores e este
   * valor é DERIVADO (soma dos subsetores ativos, mantida pelo SetoresService) — existe só para que o módulo de
   * escalas, que lê `plantao24h` diretamente, continue enxergando a demanda total de técnicos do setor.
   */
  @Prop({ type: QuantitativoSchema, required: true })
  plantao24h: Quantitativo;

  /** true quando o setor é dividido em subsetores (ao menos um cadastrado). Mantido pelo SetoresService. */
  @Prop({ required: true, default: false })
  possuiSubsetores: boolean;

  @Prop({ required: true, default: true })
  ativo: boolean;

  // Preenchidos pelo Mongoose (timestamps: true); declarados apenas para tipagem.
  createdAt: Date;
  updatedAt: Date;
}

export type SetorDocument = HydratedDocument<Setor>;
export const SetorSchema = SchemaFactory.createForClass(Setor);
