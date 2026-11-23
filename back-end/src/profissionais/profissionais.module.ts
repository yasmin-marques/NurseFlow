import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PlantoesFuturosChecker, SemEscalasPlantoesFuturosChecker } from './plantoes-futuros.checker';
import { ProfissionaisController } from './profissionais.controller';
import { ProfissionaisService } from './profissionais.service';

@Module({
  imports: [UsuariosModule],
  controllers: [ProfissionaisController],
  providers: [ProfissionaisService, { provide: PlantoesFuturosChecker, useClass: SemEscalasPlantoesFuturosChecker }],
})
export class ProfissionaisModule {}
