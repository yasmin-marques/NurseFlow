import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { Perfis, UsuarioAtual } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { GerarEscalaDto } from './dto/gerar-escala.dto';
import { EscalasService } from './escalas.service';

@ApiTags('Escalas') @ApiBearerAuth() @Perfis(Perfil.COORDENACAO)
@Controller('escalas')
export class EscalasController {
  constructor(private readonly service: EscalasService) {}

  @Post('gerar') @HttpCode(201)
  @ApiOperation({
    summary: 'Gera a escala mensal automaticamente (RF005/US07)',
    description:
      'Otimiza o mês inteiro (todos os setores ativos e profissionais ativos) com OR-Tools CP-SAT, usando as configurações vigentes do período. ' +
      'Salva como rascunho e devolve a escala, as vagas descobertas (pendências) e os conflitos. Um período só admite uma escala.',
  })
  gerar(@Body() dto: GerarEscalaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.gerar(dto, usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma escala gerada (plantões, pendências e conflitos)' })
  obter(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.obter(id);
  }
}
