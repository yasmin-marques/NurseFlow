import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Escala, EscalaSchema, VersaoEscala, VersaoEscalaSchema } from '../escalas/schemas';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { GoogleAgendaController } from './google-agenda.controller';
import {
  EstadoOauthGoogle,
  EstadoOauthGoogleSchema,
  EventoGoogleAgenda,
  EventoGoogleAgendaSchema,
  IntegracaoGoogleAgenda,
  IntegracaoGoogleAgendaSchema,
  TarefaGoogleAgenda,
  TarefaGoogleAgendaSchema,
} from './google-agenda.schemas';
import { GoogleAgendaService } from './google-agenda.service';
import { GoogleAgendaSincronizacaoService } from './google-agenda-sincronizacao.service';
import { GoogleCalendarClient, HttpGoogleCalendarClient } from './google-calendar.client';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegracaoGoogleAgenda.name, schema: IntegracaoGoogleAgendaSchema },
      { name: EventoGoogleAgenda.name, schema: EventoGoogleAgendaSchema },
      { name: TarefaGoogleAgenda.name, schema: TarefaGoogleAgendaSchema },
      { name: EstadoOauthGoogle.name, schema: EstadoOauthGoogleSchema },
      { name: Escala.name, schema: EscalaSchema },
      { name: VersaoEscala.name, schema: VersaoEscalaSchema },
      { name: Setor.name, schema: SetorSchema },
      { name: Profissional.name, schema: ProfissionalSchema },
    ]),
  ],
  controllers: [GoogleAgendaController],
  providers: [
    GoogleAgendaService,
    GoogleAgendaSincronizacaoService,
    { provide: GoogleCalendarClient, useClass: HttpGoogleCalendarClient },
  ],
  exports: [GoogleAgendaSincronizacaoService],
})
export class GoogleAgendaModule {}
