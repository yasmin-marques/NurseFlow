import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Escala, EscalaSchema, Plantao, PlantaoProfissional, PlantaoProfissionalSchema, PlantaoSchema } from '../escalas/schemas';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Administrador, AdministradorSchema } from './schemas/administrador.schema';
import { Setor, SetorSchema } from '../setores/schemas/setor.schema';
import { Usuario, UsuarioSchema } from './schemas/usuario.schema';
import { UsuariosService } from './usuarios.service';

/** Identidade: registra as coleções usuarios, administradores e profissionaisDaSaude. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Administrador.name, schema: AdministradorSchema },
      { name: Profissional.name, schema: ProfissionalSchema },
      { name: Escala.name, schema: EscalaSchema },
      { name: Plantao.name, schema: PlantaoSchema },
      { name: PlantaoProfissional.name, schema: PlantaoProfissionalSchema },
      { name: Setor.name, schema: SetorSchema },
    ]),
  ],
  providers: [UsuariosService],
  exports: [UsuariosService, MongooseModule],
})
export class UsuariosModule {}
