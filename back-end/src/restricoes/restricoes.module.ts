import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Restricao, RestricaoSchema } from './restricao.schema';
import { RestricoesController } from './restricoes.controller';
import { RestricoesService } from './restricoes.service';
@Module({ imports: [MongooseModule.forFeature([{ name: Restricao.name, schema: RestricaoSchema }, { name: Profissional.name, schema: ProfissionalSchema }])],
 controllers: [RestricoesController], providers: [RestricoesService], exports: [RestricoesService] })
export class RestricoesModule {}
