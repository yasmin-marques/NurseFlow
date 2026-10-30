import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { UsuarioAtual } from '../common/decorators';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { EscalasService } from './escalas.service';

@ApiTags('Notificações de escala')
@ApiBearerAuth()
@Controller('notificacoes/escalas')
export class NotificacoesEscalaController {
  constructor(private readonly service: EscalasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as notificações de escala do usuário autenticado' })
  @ApiOkResponse({ description: 'Retorna as notificações recentes e a quantidade não lida.' })
  listar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.listarNotificacoes(usuario.id);
  }

  @Get(':escalaId/versoes/:numero')
  @ApiOperation({ summary: 'Consulta uma versão oficial vinculada a uma notificação do usuário' })
  @ApiOkResponse({ description: 'Retorna os metadados e o snapshot imutável notificado ao usuário.' })
  @ApiNotFoundResponse({ description: 'A versão não está disponível para o usuário autenticado.' })
  obterVersaoNotificada(
    @Param('escalaId', ParseObjectIdPipe) escalaId: string,
    @Param('numero', ParseIntPipe) numero: number,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.service.obterVersaoNotificada(escalaId, numero, usuario.id);
  }

  @Patch(':id/lida')
  @ApiOperation({ summary: 'Marca uma notificação própria como lida' })
  @ApiOkResponse({ description: 'Retorna a notificação marcada como lida.' })
  @ApiNotFoundResponse({ description: 'Notificação não encontrada para o usuário autenticado.' })
  marcarLida(
    @Param('id', ParseObjectIdPipe) id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.service.marcarNotificacaoLida(id, usuario.id);
  }
}
