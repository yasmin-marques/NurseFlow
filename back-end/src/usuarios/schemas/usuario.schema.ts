import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export enum TipoUsuario {
  ADMINISTRADOR = 'administrador',
  PROFISSIONAL_DA_SAUDE = 'profissionalDaSaude',
}

export class RedefinicaoSenha {
  tokenHash: string;
  expiraEm: Date;
}

@Schema({ collection: 'usuarios', timestamps: true, versionKey: false })
export class Usuario {
  @Prop({ required: true, trim: true })
  nome: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  /** Hash bcrypt. Nunca selecionado por padrão. */
  @Prop({ required: true, select: false })
  senha: string;

  /** Somente dígitos. */
  @Prop({ required: true })
  cpf: string;

  @Prop()
  telefone?: string;

  @Prop({ required: true, enum: TipoUsuario })
  tipoUsuario: TipoUsuario;

  /** Senha gerada pelo sistema no cadastro; o usuário deve defini-la via recuperação de senha. */
  @Prop({ default: false })
  senhaTemporaria: boolean;

  @Prop({ default: 0 })
  tentativasFalhasLogin: number;

  @Prop({ type: Date, default: null })
  bloqueadoAte: Date | null;

  @Prop({ type: Date, default: null })
  ultimoLoginEm: Date | null;

  @Prop({ type: { tokenHash: String, expiraEm: Date }, _id: false, select: false, default: undefined })
  redefinicaoSenha?: RedefinicaoSenha;
}

export type UsuarioDocument = HydratedDocument<Usuario>;
export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
