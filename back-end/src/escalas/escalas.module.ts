import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module';
import { Restricao, RestricaoSchema } from '../restricoes/restricao.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { EscalasController } from './escalas.controller';
import { EscalasService } from './escalas.service';
import { OtimizadorEscala, OtimizadorHttp } from './otimizador/otimizador';
import { Escala, EscalaSchema, Plantao, PlantaoProfissional, PlantaoProfissionalSchema, PlantaoSchema } from './schemas';

@Module({
  imports: [
    UsuariosModule,
    ConfiguracoesModule,
    MongooseModule.forFeature([
      { name: Escala.name, schema: EscalaSchema },
      { name: Plantao.name, schema: PlantaoSchema },
      { name: PlantaoProfissional.name, schema: PlantaoProfissionalSchema },
      { name: Setor.name, schema: SetorSchema },
      { name: Restricao.name, schema: RestricaoSchema },
    ]),
  ],
  controllers: [EscalasController],
  providers: [EscalasService, { provide: OtimizadorEscala, useClass: OtimizadorHttp }],
})
export class EscalasModule {}
