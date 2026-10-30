import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module';
import { Restricao, RestricaoSchema } from '../restricoes/restricao.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { EscalasController } from './escalas.controller';
import { EscalasService } from './escalas.service';
import { EscalaPdfService } from './escala-pdf.service';
import { NotificacoesEscalaController } from './notificacoes-escalas.controller';
import { OtimizadorEscala, OtimizadorHttp } from './otimizador/otimizador';
import {
  AuditoriaEscala,
  AuditoriaEscalaSchema,
  Escala,
  EscalaSchema,
  NotificacaoEscala,
  NotificacaoEscalaSchema,
  Plantao,
  PlantaoProfissional,
  PlantaoProfissionalSchema,
  PlantaoSchema,
  VersaoEscala,
  VersaoEscalaSchema,
} from './schemas';

@Module({
  imports: [
    UsuariosModule,
    ConfiguracoesModule,
    MongooseModule.forFeature([
      { name: AuditoriaEscala.name, schema: AuditoriaEscalaSchema },
      { name: Escala.name, schema: EscalaSchema },
      { name: NotificacaoEscala.name, schema: NotificacaoEscalaSchema },
      { name: Plantao.name, schema: PlantaoSchema },
      { name: PlantaoProfissional.name, schema: PlantaoProfissionalSchema },
      { name: VersaoEscala.name, schema: VersaoEscalaSchema },
      { name: Setor.name, schema: SetorSchema },
      { name: Restricao.name, schema: RestricaoSchema },
    ]),
  ],
  controllers: [EscalasController, NotificacoesEscalaController],
  providers: [EscalasService, EscalaPdfService, { provide: OtimizadorEscala, useClass: OtimizadorHttp }],
})
export class EscalasModule {}
