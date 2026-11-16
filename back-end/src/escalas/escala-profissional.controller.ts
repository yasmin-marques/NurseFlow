import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { UsuarioAtual } from '../common/decorators';
import { EscalaGeralDiaQueryDto, EscalaGeralQueryDto, MeusPlantoesQueryDto } from './dto/escala-profissional.dto';
import { EscalaProfissionalService } from './escala-profissional.service';

/** Leitura da escala oficial publicada por Enfermeiro/Técnico. A identidade vem sempre do JWT. */
@ApiTags('Escala do profissional')
@ApiBearerAuth()
@Controller('escala-profissional')
export class EscalaProfissionalController {
  constructor(private readonly service: EscalaProfissionalService) {}

  @Get('meus-plantoes')
  @ApiOperation({ summary: 'Plantões do profissional autenticado (próximos ou anteriores) na versão publicada' })
  @ApiOkResponse({ description: 'Página de plantões com equipe (somente nomes).' })
  @ApiForbiddenResponse({ description: 'Usuário sem vínculo de profissional.' })
  @ApiBadRequestResponse({ description: 'Parâmetros inválidos.' })
  meusPlantoes(@Query() query: MeusPlantoesQueryDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    const profissionalId = this.service.exigirProfissional(usuario);
    return this.service.meusPlantoes(profissionalId, query.situacao, query.pagina, query.limite);
  }

  @Get('geral')
  @ApiOperation({ summary: 'Resumo diário da escala publicada do mês, sem dados pessoais' })
  @ApiOkResponse({ description: 'Dias com turnos, chefe e setores; `publicada:false` quando não há versão publicada.' })
  @ApiForbiddenResponse({ description: 'Usuário sem vínculo de profissional.' })
  geral(@Query() query: EscalaGeralQueryDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    this.service.exigirProfissional(usuario);
    return this.service.escalaGeral(query.ano, query.mes);
  }

  @Get('geral/dia')
  @ApiOperation({ summary: 'Cobertura diária detalhada (chefe, enfermeiros e técnicos) sem dados pessoais' })
  @ApiOkResponse({ description: 'Detalhe do dia na versão publicada.' })
  @ApiForbiddenResponse({ description: 'Usuário sem vínculo de profissional.' })
  geralDia(@Query() query: EscalaGeralDiaQueryDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    this.service.exigirProfissional(usuario);
    return this.service.escalaGeralDia(query.data);
  }
}
