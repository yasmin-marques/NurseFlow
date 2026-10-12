import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Setor, SetorSchema } from './schemas/setor.schema';
import { SetoresController } from './setores.controller';
import { SetoresService } from './setores.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Setor.name, schema: SetorSchema }])],
  controllers: [SetoresController],
  providers: [SetoresService],
  exports: [SetoresService],
})
export class SetoresModule {}
