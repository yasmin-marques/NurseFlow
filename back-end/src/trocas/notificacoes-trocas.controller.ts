import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsuarioAtual, Perfis } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { MinhasTrocasService } from './minhas-trocas.service';

@ApiTags('Notificações de troca') @ApiBearerAuth() @Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO) @Controller('notificacoes/trocas')
export class NotificacoesTrocasController {
  constructor(private readonly service: MinhasTrocasService) {}
  @Get() listar(@UsuarioAtual() usuario: UsuarioAutenticado) { return this.service.listarNotificacoes(usuario); }
  @Patch(':id/lida') marcarLida(@Param('id', ParseObjectIdPipe) id: string, @UsuarioAtual() usuario: UsuarioAutenticado) { return this.service.marcarNotificacaoLida(usuario, id); }
}
