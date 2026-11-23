import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PlantoesFuturosChecker, SemEscalasPlantoesFuturosChecker } from './plantoes-futuros.checker';
import { ProfissionaisController } from './profissionais.controller';
import { ProfissionaisService } from './profissionais.service';

@Module({
  imports: [UsuariosModule, MongooseModule.forFeature([{ name: Setor.name, schema: SetorSchema }])],
  controllers: [ProfissionaisController],
  providers: [ProfissionaisService, { provide: PlantoesFuturosChecker, useClass: SemEscalasPlantoesFuturosChecker }],
})
export class ProfissionaisModule {}
