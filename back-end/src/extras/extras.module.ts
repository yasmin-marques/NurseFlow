import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditoriaExtra, AuditoriaExtraSchema, ExtraProgramado, ExtraProgramadoSchema } from './extras.schema';
import { ExtrasService } from './extras.service';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { Restricao, RestricaoSchema } from '../restricoes/restricao.schema';
import {
  Escala,
  EscalaSchema,
  Plantao,
  PlantaoProfissional,
  PlantaoProfissionalSchema,
  PlantaoSchema,
  VersaoEscala,
  VersaoEscalaSchema,
} from '../escalas/schemas';
import { Configuracao, ConfiguracaoSchema } from '../configuracoes/configuracao.schema';
import { Usuario, UsuarioSchema } from '../usuarios/schemas/usuario.schema';
import { ExtrasController } from './extras.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExtraProgramado.name, schema: ExtraProgramadoSchema },
      { name: AuditoriaExtra.name, schema: AuditoriaExtraSchema },
      { name: Profissional.name, schema: ProfissionalSchema },
      { name: Setor.name, schema: SetorSchema },
      { name: Restricao.name, schema: RestricaoSchema },
      { name: Plantao.name, schema: PlantaoSchema },
      { name: PlantaoProfissional.name, schema: PlantaoProfissionalSchema },
      { name: Escala.name, schema: EscalaSchema },
      { name: VersaoEscala.name, schema: VersaoEscalaSchema },
      { name: Configuracao.name, schema: ConfiguracaoSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
  ],
  controllers: [ExtrasController],
  providers: [ExtrasService],
  exports: [ExtrasService],
})
export class ExtrasModule {}
