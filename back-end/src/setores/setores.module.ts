import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Setor, SetorSchema } from './schemas/setor.schema';
import { Subsetor, SubsetorSchema } from './schemas/subsetor.schema';
import { SetoresController } from './setores.controller';
import { SetoresService } from './setores.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Setor.name, schema: SetorSchema },
      { name: Subsetor.name, schema: SubsetorSchema },
      { name: Profissional.name, schema: ProfissionalSchema },
    ]),
  ],
  controllers: [SetoresController],
  providers: [SetoresService],
  exports: [SetoresService],
})
export class SetoresModule {}
