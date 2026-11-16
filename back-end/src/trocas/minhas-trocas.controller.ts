import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { Perfis, UsuarioAtual } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { TrocasService } from './trocas.service';

@ApiTags('Minhas trocas')
@ApiBearerAuth()
@Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO)
@Controller('trocas/minhas')
export class MinhasTrocasController {
  constructor(private readonly service: TrocasService) {}

  @Get('contagem')
  @ApiOperation({ summary: 'Conta solicitações de troca aguardando resposta do profissional autenticado' })
  @ApiOkResponse({ description: 'Quantidade de solicitações recebidas ainda sem resposta.' })
  contar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.contarTrocasRecebidas(usuario.profissionalId ?? '');
  }
}
