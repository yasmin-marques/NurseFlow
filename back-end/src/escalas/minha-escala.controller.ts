import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { Perfis, UsuarioAtual } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { EscalasService } from './escalas.service';

@ApiTags('Minha escala')
@ApiBearerAuth()
@Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO)
@Controller('minha-escala')
export class MinhaEscalaController {
  constructor(private readonly service: EscalasService) {}

  @Get('plantoes')
  @ApiOperation({ summary: 'Lista os próximos plantões oficiais do profissional autenticado' })
  @ApiOkResponse({ description: 'Plantões futuros vinculados ao profissional autenticado.' })
  listarPlantoes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.listarMeusPlantoes(usuario.profissionalId ?? '');
  }
}
