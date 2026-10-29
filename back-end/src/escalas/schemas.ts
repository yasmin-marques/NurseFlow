import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

export enum StatusEscala {
  RASCUNHO = 'rascunho',
  PUBLICADA = 'publicada',
  FINALIZADA = 'finalizada',
}

export enum TipoPlantao {
  REGULAR = 'regular',
  EXTRA = 'extra',
}

/** Escala mensal. `geracao` guarda o retrato da geração (configuração vigente, pendências, conflitos). */
@Schema({ collection: 'escalas', timestamps: true, versionKey: false })
export class Escala {
  @Prop({ type: Types.ObjectId, ref: 'Administrador', required: true }) administradorId: Types.ObjectId;
  @Prop({ required: true, min: 1, max: 12 }) mes: number;
  @Prop({ required: true, min: 2020 }) ano: number;
  @Prop({ required: true, enum: StatusEscala, default: StatusEscala.RASCUNHO }) status: StatusEscala;
  @Prop({ type: Date, default: () => new Date() }) dataCriacao: Date;
  @Prop({ type: Object }) geracao?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
export type EscalaDocument = HydratedDocument<Escala>;
export const EscalaSchema = SchemaFactory.createForClass(Escala);

/** Vaga de um setor em um dia e horário; os profissionais ficam em `profissionaisRelacionados`. */
@Schema({ collection: 'plantoes', timestamps: true, versionKey: false })
export class Plantao {
  @Prop({ type: Types.ObjectId, ref: 'Escala', required: true }) escalaId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Setor', required: true }) setorId: Types.ObjectId;
  /** Dia de início do plantão (00:00 UTC). */
  @Prop({ required: true }) data: Date;
  @Prop({ required: true }) horarioInicio: string;
  @Prop({ required: true }) horarioFim: string;
  @Prop({ required: true, min: 1 }) duracaoHoras: number;
  @Prop({ required: true, enum: TipoPlantao }) tipo: TipoPlantao;
  createdAt: Date;
  updatedAt: Date;
}
export type PlantaoDocument = HydratedDocument<Plantao>;
export const PlantaoSchema = SchemaFactory.createForClass(Plantao);

@Schema({ collection: 'profissionaisRelacionados', timestamps: true, versionKey: false })
export class PlantaoProfissional {
  @Prop({ type: Types.ObjectId, ref: 'Plantao', required: true }) plantaoId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Profissional', required: true }) profissionalId: Types.ObjectId;
  @Prop({ required: true, enum: ['enfermeiro', 'tecnico'] }) funcao: string;
  createdAt: Date;
  updatedAt: Date;
}
export type PlantaoProfissionalDocument = HydratedDocument<PlantaoProfissional>;
export const PlantaoProfissionalSchema = SchemaFactory.createForClass(PlantaoProfissional);
