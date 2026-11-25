import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { Subsetor, SubsetorSchema } from '../setores/schemas/subsetor.schema';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ProfissionaisImportacaoService } from './importacao/profissionais-importacao.service';
import { PlantoesFuturosChecker, SemEscalasPlantoesFuturosChecker } from './plantoes-futuros.checker';
import { ProfissionaisController } from './profissionais.controller';
import { ProfissionaisService } from './profissionais.service';

@Module({
  imports: [
    UsuariosModule,
    MongooseModule.forFeature([
      { name: Setor.name, schema: SetorSchema },
      { name: Subsetor.name, schema: SubsetorSchema },
    ]),
  ],
  controllers: [ProfissionaisController],
  providers: [ProfissionaisService, ProfissionaisImportacaoService, { provide: PlantoesFuturosChecker, useClass: SemEscalasPlantoesFuturosChecker }],
})
export class ProfissionaisModule {}
