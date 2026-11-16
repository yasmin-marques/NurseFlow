import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Usuario, UsuarioSchema } from '../usuarios/schemas/usuario.schema';
import { EscalaSnapshotsModule } from '../escalas/escala-snapshots.module';
import { Escala, EscalaSchema, NotificacaoEscala, NotificacaoEscalaSchema, VersaoEscala, VersaoEscalaSchema } from '../escalas/schemas';
import { NotificacoesEscalaController } from './notificacoes-escalas.controller';
import { NotificacoesEscalaService } from './notificacoes-escalas.service';

@Module({
  imports: [
    EscalaSnapshotsModule,
    MongooseModule.forFeature([
      { name: Escala.name, schema: EscalaSchema },
      { name: NotificacaoEscala.name, schema: NotificacaoEscalaSchema },
      { name: VersaoEscala.name, schema: VersaoEscalaSchema },
      { name: Profissional.name, schema: ProfissionalSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
  ],
  controllers: [NotificacoesEscalaController],
  providers: [NotificacoesEscalaService],
  exports: [NotificacoesEscalaService],
})
export class NotificacoesModule {}
