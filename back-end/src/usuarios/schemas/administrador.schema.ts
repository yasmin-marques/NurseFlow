import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

/** Administrador = perfil Coordenação. */
@Schema({ collection: 'administradores', versionKey: false })
export class Administrador {
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  usuarioId: Types.ObjectId;
}

export type AdministradorDocument = HydratedDocument<Administrador>;
export const AdministradorSchema = SchemaFactory.createForClass(Administrador);
