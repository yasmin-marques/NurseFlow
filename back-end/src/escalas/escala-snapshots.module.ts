import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { Subsetor, SubsetorSchema } from '../setores/schemas/subsetor.schema';
import { Usuario, UsuarioSchema } from '../usuarios/schemas/usuario.schema';
import {
  Plantao,
  PlantaoProfissional,
  PlantaoProfissionalSchema,
  PlantaoSchema,
} from './schemas';
import { EscalaSnapshotService } from './escala-snapshot.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Plantao.name, schema: PlantaoSchema },
      { name: PlantaoProfissional.name, schema: PlantaoProfissionalSchema },
      { name: Profissional.name, schema: ProfissionalSchema },
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Setor.name, schema: SetorSchema },
      { name: Subsetor.name, schema: SubsetorSchema },
    ]),
  ],
  providers: [EscalaSnapshotService],
  exports: [EscalaSnapshotService],
})
export class EscalaSnapshotsModule {}
