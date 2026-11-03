import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { type HydratedDocument, Types } from 'mongoose';

export enum StatusEscala {
  RASCUNHO = 'rascunho',
  EM_REVISAO = 'em_revisao',
  VALIDADA = 'validada',
  PUBLICADA = 'publicada',
  FINALIZADA = 'finalizada',
}

export enum TipoPlantao {
  REGULAR = 'regular',
  EXTRA = 'extra',
}

export enum OrigemCobertura {
  REGULAR = 'regular',
  RESTRICAO = 'restricao',
  COMPLEMENTAR = 'complementar',
}

/** Escala mensal. `geracao` guarda o retrato da geração (configuração vigente, pendências, conflitos). */
@Schema({ collection: 'escalas', timestamps: true, versionKey: false })
export class Escala {
  @Prop({ type: Types.ObjectId, ref: 'Administrador', required: true }) administradorId: Types.ObjectId;
  @Prop({ required: true, min: 1, max: 12 }) mes: number;
  @Prop({ required: true, min: 1, max: 9999 }) ano: number;
  @Prop({ required: true, enum: StatusEscala, default: StatusEscala.RASCUNHO }) status: StatusEscala;
  @Prop({ required: true, min: 1, default: 1 }) revisao: number;
  @Prop({ required: true, min: 0, default: 0 }) versaoPublicada: number;
  @Prop({ type: MongooseSchema.Types.Mixed }) validacao?: Record<string, unknown>;
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
  @Prop({ required: true, default: false }) lideranca: boolean;
  @Prop({ required: true, enum: OrigemCobertura, default: OrigemCobertura.REGULAR }) origemCobertura: OrigemCobertura;
  createdAt: Date;
  updatedAt: Date;
}
export type PlantaoProfissionalDocument = HydratedDocument<PlantaoProfissional>;
export const PlantaoProfissionalSchema = SchemaFactory.createForClass(PlantaoProfissional);

@Schema({ collection: 'versoesEscala', timestamps: true, versionKey: false })
export class VersaoEscala {
  @Prop({ type: Types.ObjectId, ref: 'Escala', required: true }) escalaId: Types.ObjectId;
  @Prop({ required: true, min: 1 }) numero: number;
  @Prop({ required: true, min: 1, max: 12 }) mes: number;
  @Prop({ required: true, min: 1, max: 9999 }) ano: number;
  @Prop({ type: Types.ObjectId, ref: 'Administrador', required: true }) publicadoPor: Types.ObjectId;
  @Prop({ required: true, default: () => new Date() }) publicadoEm: Date;
  @Prop({ required: true, type: MongooseSchema.Types.Mixed }) snapshot: Record<string, unknown>;
  @Prop({ required: true, default: false }) pendenciasConfirmadas: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export type VersaoEscalaDocument = HydratedDocument<VersaoEscala>;
export const VersaoEscalaSchema = SchemaFactory.createForClass(VersaoEscala);

@Schema({ collection: 'auditoriaEscalas', timestamps: true, versionKey: false })
export class AuditoriaEscala {
  @Prop({ type: Types.ObjectId, ref: 'Escala', required: true }) escalaId: Types.ObjectId;
  @Prop({ required: true, min: 1 }) revisao: number;
  @Prop({ required: true, trim: true }) acao: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true }) usuarioId: Types.ObjectId;
  @Prop({ required: true, default: () => new Date() }) ocorridoEm: Date;
  @Prop({ type: MongooseSchema.Types.Mixed }) detalhes?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
export type AuditoriaEscalaDocument = HydratedDocument<AuditoriaEscala>;
export const AuditoriaEscalaSchema = SchemaFactory.createForClass(AuditoriaEscala);

@Schema({ collection: 'notificacoesEscala', timestamps: true, versionKey: false })
export class NotificacaoEscala {
  @Prop({ type: Types.ObjectId, ref: 'Escala', required: true }) escalaId: Types.ObjectId;
  @Prop({ required: true, min: 1 }) versao: number;
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true }) destinatarioId: Types.ObjectId;
  @Prop({ required: true, trim: true }) eventKey: string;
  @Prop({ required: true, trim: true }) titulo: string;
  @Prop({ required: true, trim: true }) mensagem: string;
  @Prop({ type: Date, default: null }) lidaEm?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type NotificacaoEscalaDocument = HydratedDocument<NotificacaoEscala>;
export const NotificacaoEscalaSchema = SchemaFactory.createForClass(NotificacaoEscala);

export enum StatusTroca {
  AGUARDANDO_RESPOSTA = 'aguardando_resposta',
  AGUARDANDO_COORDENACAO = 'aguardando_coordenacao',
  RECUSADA_PELO_PROFISSIONAL = 'recusada_pelo_profissional',
  APROVADA = 'aprovada',
  RECUSADA_PELA_COORDENACAO = 'recusada_pela_coordenacao',
}

/** Registro compartilhado com RF015/RF016. Somente o aceite autenticado do destinatário pode colocá-lo na fila administrativa. */
@Schema({ collection: 'solicitacoesTroca', timestamps: true, versionKey: false })
export class SolicitacaoTroca {
  @Prop({ required: true, enum: StatusTroca, default: StatusTroca.AGUARDANDO_RESPOSTA }) status: StatusTroca;
  /** Competência registrada pelo fluxo solicitante/aceite e usada para contagem e filtros administrativos. */
  @Prop({ required: true, min: 1, max: 12 }) mes: number;
  @Prop({ required: true, min: 1, max: 9999 }) ano: number;
  @Prop({ type: Types.ObjectId, ref: 'Profissional', required: true }) solicitanteProfissionalId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Profissional', required: true }) profissionalSolicitadoId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'PlantaoProfissional', required: true }) vinculoSolicitanteId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'PlantaoProfissional', required: true }) vinculoSolicitadoId: Types.ObjectId;
  @Prop({ type: Date, required: true, default: () => new Date() }) criadaEm: Date;
  @Prop({ type: MongooseSchema.Types.Mixed, default: null }) aceite: { profissionalId: Types.ObjectId; aceitoEm: Date } | null;
  @Prop({ type: MongooseSchema.Types.Mixed, default: null }) decisaoCoordenacao: {
    resultado: 'aprovada' | 'recusada'; usuarioId: Types.ObjectId; decididaEm: Date;
    justificativa?: string; excecaoLimite?: boolean; versoesEscala?: { ano: number; mes: number; numero: number }[];
  } | null;
  @Prop({ type: String, default: undefined }) chaveIdempotencia?: string;
  createdAt: Date;
  updatedAt: Date;
}
export type SolicitacaoTrocaDocument = HydratedDocument<SolicitacaoTroca>;
export const SolicitacaoTrocaSchema = SchemaFactory.createForClass(SolicitacaoTroca);
SolicitacaoTrocaSchema.index({ status: 1, criadaEm: -1, _id: -1 });
SolicitacaoTrocaSchema.index({ status: 1, ano: 1, mes: 1, criadaEm: -1 });
SolicitacaoTrocaSchema.index({ vinculoSolicitanteId: 1, status: 1 });
SolicitacaoTrocaSchema.index({ vinculoSolicitadoId: 1, status: 1 });
SolicitacaoTrocaSchema.index({ chaveIdempotencia: 1 }, { unique: true, sparse: true });

@Schema({ collection: 'auditoriaTrocas', timestamps: true, versionKey: false })
export class AuditoriaTroca {
  @Prop({ type: Types.ObjectId, ref: 'SolicitacaoTroca', required: true }) solicitacaoId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true }) usuarioId: Types.ObjectId;
  @Prop({ required: true, enum: ['aprovada', 'recusada'] }) resultado: 'aprovada' | 'recusada';
  @Prop({ type: Date, required: true }) decididaEm: Date;
  @Prop({ type: String, trim: true, maxlength: 500 }) justificativa?: string;
  @Prop({ type: MongooseSchema.Types.Mixed, default: [] }) vinculos: Record<string, unknown>[];
  @Prop({ type: MongooseSchema.Types.Mixed, default: [] }) versoesEscala: Record<string, unknown>[];
  @Prop({ type: Boolean, default: false }) excecaoLimite: boolean;
  @Prop({ type: String, required: true }) operacaoId: string;
  createdAt: Date;
  updatedAt: Date;
}
export const AuditoriaTrocaSchema = SchemaFactory.createForClass(AuditoriaTroca);
AuditoriaTrocaSchema.index({ solicitacaoId: 1, createdAt: -1 });
AuditoriaTrocaSchema.index({ operacaoId: 1 }, { unique: true });

@Schema({ collection: 'notificacoesTroca', timestamps: true, versionKey: false })
export class NotificacaoTroca {
  @Prop({ type: Types.ObjectId, ref: 'SolicitacaoTroca', required: true }) solicitacaoId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true }) destinatarioId: Types.ObjectId;
  @Prop({ required: true, trim: true }) eventKey: string;
  @Prop({ required: true, trim: true }) titulo: string;
  @Prop({ required: true, trim: true }) mensagem: string;
  @Prop({ type: Date, default: null }) lidaEm?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export const NotificacaoTrocaSchema = SchemaFactory.createForClass(NotificacaoTroca);
NotificacaoTrocaSchema.index({ eventKey: 1, destinatarioId: 1 }, { unique: true });
NotificacaoTrocaSchema.index({ destinatarioId: 1, createdAt: -1 });
