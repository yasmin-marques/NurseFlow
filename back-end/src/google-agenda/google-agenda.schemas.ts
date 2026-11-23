import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, Types } from 'mongoose';

export enum StatusIntegracaoGoogle {
  CONECTADA = 'conectada',
  DESATIVADA = 'desativada',
  RECONEXAO_NECESSARIA = 'reconexao_necessaria',
}

export enum StatusTarefaGoogle {
  PENDENTE = 'pendente',
  PROCESSANDO = 'processando',
  CONCLUIDA = 'concluida',
  FALHA = 'falha',
  CANCELADA = 'cancelada',
}

export type OrigemTarefaGoogle = 'publicacao' | 'troca' | 'conexao';

export interface ResultadoSincronizacao {
  resultado: 'sucesso' | 'parcial' | 'falha';
  criados: number;
  atualizados: number;
  removidos: number;
  inalterados: number;
  falhas: number;
  reconexaoNecessaria: boolean;
  mensagem: string;
  em: Date;
}

/** Conexão de um profissional com o Google Agenda. O refresh token nunca é gravado em claro. */
@Schema({ collection: 'integracoesGoogleAgenda', timestamps: true, versionKey: false })
export class IntegracaoGoogleAgenda {
  @Prop({ type: Types.ObjectId, ref: 'Profissional', required: true }) profissionalId: Types.ObjectId;
  @Prop({ required: true, enum: StatusIntegracaoGoogle }) status: StatusIntegracaoGoogle;
  /** AES-256-GCM (`v1.iv.tag.texto`, base64url). Nulo quando desativada ou revogada. */
  @Prop({ type: String, default: null }) refreshTokenCifrado: string | null;
  @Prop({ type: String, default: '' }) escopo: string;
  @Prop({ type: String, default: 'primary' }) calendarId: string;
  @Prop({ type: Date, required: true }) conectadaEm: Date;
  @Prop({ type: Date, default: null }) desativadaEm: Date | null;
  @Prop({ type: Date, default: null }) ultimaSincronizacaoEm: Date | null;
  @Prop({ type: MongooseSchema.Types.Mixed, default: null }) ultimoResultado: ResultadoSincronizacao | null;
  /** Lease que serializa execuções (manual, automática e retentativas) do mesmo profissional. */
  @Prop({ type: String, default: null }) lockToken: string | null;
  @Prop({ type: Date, default: null }) lockExpiraEm: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type IntegracaoGoogleAgendaDocument = HydratedDocument<IntegracaoGoogleAgenda>;
export const IntegracaoGoogleAgendaSchema = SchemaFactory.createForClass(IntegracaoGoogleAgenda);
IntegracaoGoogleAgendaSchema.index({ profissionalId: 1 }, { unique: true });

/** Evento que o NurseFlow criou no Google Agenda — identidade estável (profissional + plantão). */
@Schema({ collection: 'eventosGoogleAgenda', timestamps: true, versionKey: false })
export class EventoGoogleAgenda {
  @Prop({ type: Types.ObjectId, ref: 'Profissional', required: true }) profissionalId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Plantao', required: true }) plantaoId: Types.ObjectId;
  @Prop({ required: true }) googleEventId: string;
  @Prop({ required: true, enum: ['sincronizado', 'removido'] }) status: 'sincronizado' | 'removido';
  /** Hash do conteúdo enviado; vazio força um novo envio. */
  @Prop({ type: String, default: '' }) hashConteudo: string;
  @Prop({ type: Date, required: true }) inicio: Date;
  @Prop({ type: Date, required: true }) fim: Date;
  @Prop({ type: Date, required: true }) sincronizadoEm: Date;
  createdAt: Date;
  updatedAt: Date;
}
export type EventoGoogleAgendaDocument = HydratedDocument<EventoGoogleAgenda>;
export const EventoGoogleAgendaSchema = SchemaFactory.createForClass(EventoGoogleAgenda);
EventoGoogleAgendaSchema.index({ profissionalId: 1, plantaoId: 1 }, { unique: true });

/**
 * Tarefa durável de sincronização. Não carrega dados da escala: a execução sempre lê o estado oficial mais
 * recente, então uma tarefa antiga nunca sobrescreve uma publicação posterior.
 */
@Schema({ collection: 'tarefasGoogleAgenda', timestamps: true, versionKey: false })
export class TarefaGoogleAgenda {
  @Prop({ type: Types.ObjectId, ref: 'Profissional', required: true }) profissionalId: Types.ObjectId;
  @Prop({ required: true, enum: ['publicacao', 'troca', 'conexao'] }) origem: OrigemTarefaGoogle;
  @Prop({ required: true, enum: StatusTarefaGoogle, default: StatusTarefaGoogle.PENDENTE }) status: StatusTarefaGoogle;
  @Prop({ required: true, min: 0, default: 0 }) tentativas: number;
  @Prop({ type: Date, required: true }) proximaTentativaEm: Date;
  @Prop({ type: Date, default: null }) bloqueadaAte: Date | null;
  @Prop({ type: String, default: null }) ultimoErro: string | null;
  @Prop({ type: Date, required: true }) criadaEm: Date;
  createdAt: Date;
  updatedAt: Date;
}
export type TarefaGoogleAgendaDocument = HydratedDocument<TarefaGoogleAgenda>;
export const TarefaGoogleAgendaSchema = SchemaFactory.createForClass(TarefaGoogleAgenda);
TarefaGoogleAgendaSchema.index({ status: 1, proximaTentativaEm: 1 });
TarefaGoogleAgendaSchema.index({ profissionalId: 1, status: 1 });

/** `state` do OAuth: uso único, vinculado ao profissional, guardado apenas como hash. */
@Schema({ collection: 'estadosOauthGoogle', timestamps: true, versionKey: false })
export class EstadoOauthGoogle {
  @Prop({ required: true }) stateHash: string;
  @Prop({ type: Types.ObjectId, ref: 'Profissional', required: true }) profissionalId: Types.ObjectId;
  @Prop({ type: Date, required: true }) expiraEm: Date;
  @Prop({ type: Date, default: null }) usadoEm: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type EstadoOauthGoogleDocument = HydratedDocument<EstadoOauthGoogle>;
export const EstadoOauthGoogleSchema = SchemaFactory.createForClass(EstadoOauthGoogle);
EstadoOauthGoogleSchema.index({ stateHash: 1 }, { unique: true });
EstadoOauthGoogleSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 });
