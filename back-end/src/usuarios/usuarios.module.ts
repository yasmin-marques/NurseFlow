import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Profissional, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { Administrador, AdministradorSchema } from './schemas/administrador.schema';
import { Usuario, UsuarioSchema } from './schemas/usuario.schema';
import { UsuariosService } from './usuarios.service';

/** Identidade: registra as coleções usuarios, administradores e profissionaisDaSaude. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Administrador.name, schema: AdministradorSchema },
      { name: Profissional.name, schema: ProfissionalSchema },
    ]),
  ],
  providers: [UsuariosService],
  exports: [UsuariosService, MongooseModule],
})
export class UsuariosModule {}
