import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module';
import { Restricao, RestricaoSchema } from '../restricoes/restricao.schema';
import { ExtraProgramado, ExtraProgramadoSchema } from '../extras/extras.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { EscalasController } from './escalas.controller';
import { EscalasService } from './escalas.service';
import { EscalaAuditoriaService } from './escala-auditoria.service';
import { EscalaGeracaoService } from './escala-geracao.service';
import { EscalaPdfService } from './escala-pdf.service';
import { EscalaSnapshotsModule } from './escala-snapshots.module';
import { EscalaProfissionalController } from './escala-profissional.controller';
import { EscalaProfissionalService } from './escala-profissional.service';
import { MinhaEscalaController } from './minha-escala.controller';
import { OtimizadorEscala, OtimizadorHttp } from './otimizador/otimizador';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import {
  AuditoriaEscala,
  AuditoriaEscalaSchema,
  Escala,
  EscalaSchema,
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
    EscalaSnapshotsModule,
    NotificacoesModule,
    MongooseModule.forFeature([
      { name: AuditoriaEscala.name, schema: AuditoriaEscalaSchema },
      { name: Escala.name, schema: EscalaSchema },
      { name: Plantao.name, schema: PlantaoSchema },
      { name: PlantaoProfissional.name, schema: PlantaoProfissionalSchema },
      { name: VersaoEscala.name, schema: VersaoEscalaSchema },
      { name: Setor.name, schema: SetorSchema },
      { name: Restricao.name, schema: RestricaoSchema },
      { name: ExtraProgramado.name, schema: ExtraProgramadoSchema },
    ]),
  ],
  controllers: [EscalasController, EscalaProfissionalController, MinhaEscalaController],
  providers: [
    EscalasService,
    EscalaProfissionalService,
    EscalaPdfService,
    EscalaAuditoriaService,
    EscalaGeracaoService,
    { provide: OtimizadorEscala, useClass: OtimizadorHttp },
  ],
})
export class EscalasModule {}
