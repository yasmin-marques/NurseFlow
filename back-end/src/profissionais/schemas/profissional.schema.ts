import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais.enums';

@Schema({ collection: 'profissionaisDaSaude', timestamps: true, versionKey: false })
export class Profissional {
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  usuarioId: Types.ObjectId;

  /** Normalizado em maiúsculas, sem espaços duplicados. */
  @Prop({ required: true })
  coren: string;

  @Prop({ required: true, enum: Formacao })
  formacao: Formacao;

  @Prop({ required: true, enum: TipoVinculo })
  tipoVinculo: TipoVinculo;

  @Prop({ required: true, enum: StatusProfissional, default: StatusProfissional.ATIVO })
  status: StatusProfissional;

  @Prop({ required: true, default: false })
  sincronizaAgenda: boolean;

  @Prop({ type: Date, default: null })
  desativadoEm: Date | null;

  // Preenchidos pelo Mongoose (timestamps: true); declarados apenas para tipagem.
  createdAt: Date;
  updatedAt: Date;
}

export type ProfissionalDocument = HydratedDocument<Profissional>;
export const ProfissionalSchema = SchemaFactory.createForClass(Profissional);
