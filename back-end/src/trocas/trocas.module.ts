import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Configuracao, ConfiguracaoSchema } from '../configuracoes/configuracao.schema';
import { AuditoriaEscala, AuditoriaEscalaSchema, AuditoriaTroca, AuditoriaTrocaSchema, Escala, EscalaSchema, NotificacaoTroca, NotificacaoTrocaSchema, Plantao, PlantaoProfissional, PlantaoProfissionalSchema, PlantaoSchema, SolicitacaoTroca, SolicitacaoTrocaSchema, VersaoEscala, VersaoEscalaSchema } from '../escalas/schemas';
import { Restricao, RestricaoSchema } from '../restricoes/restricao.schema';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { Usuario, UsuarioSchema } from '../usuarios/schemas/usuario.schema';
import { Administrador, AdministradorSchema } from '../usuarios/schemas/administrador.schema';
import { TrocasController } from './trocas.controller';
import { MinhasTrocasController } from './minhas-trocas.controller';
import { TrocasService } from './trocas.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: SolicitacaoTroca.name, schema: SolicitacaoTrocaSchema },
    { name: AuditoriaTroca.name, schema: AuditoriaTrocaSchema },
    { name: AuditoriaEscala.name, schema: AuditoriaEscalaSchema },
    { name: NotificacaoTroca.name, schema: NotificacaoTrocaSchema },
    { name: VersaoEscala.name, schema: VersaoEscalaSchema },
    { name: PlantaoProfissional.name, schema: PlantaoProfissionalSchema },
    { name: Plantao.name, schema: PlantaoSchema },
    { name: Escala.name, schema: EscalaSchema },
    { name: Profissional.name, schema: ProfissionalSchema },
    { name: Usuario.name, schema: UsuarioSchema },
    { name: Administrador.name, schema: AdministradorSchema },
    { name: Configuracao.name, schema: ConfiguracaoSchema },
    { name: Setor.name, schema: SetorSchema },
    { name: Restricao.name, schema: RestricaoSchema },
  ])],
  controllers: [TrocasController, MinhasTrocasController],
  providers: [TrocasService],
})
export class TrocasModule {}
