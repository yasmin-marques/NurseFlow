import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { Perfis } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { UsuarioAtual } from '../common/decorators';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { AprovarTrocaDto, RecusarTrocaDto } from './dto/decidir-troca.dto';
import { ListarHistoricoTrocasDto } from './dto/listar-historico-trocas.dto';
import { ListarTrocasDto } from './dto/listar-trocas.dto';
import { TrocasService } from './trocas.service';

@ApiTags('Trocas') @ApiBearerAuth() @Perfis(Perfil.COORDENACAO) @Controller('trocas')
export class TrocasController {
  constructor(private readonly service: TrocasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista solicitações de troca da Coordenação com filtro de situação e período' })
  @ApiOkResponse({ description: 'Lista paginada e contagem global de solicitações aguardando Coordenação.' })
  listar(@Query() query: ListarTrocasDto) { return this.service.listar(query); }

  @Get('historico')
  @ApiOperation({ summary: 'Lista decisões de troca finalizadas no ano selecionado' })
  @ApiOkResponse({ description: 'Lista paginada de decisões aprovadas e recusadas.' })
  historico(@Query() query: ListarHistoricoTrocasDto) { return this.service.listarHistorico(query); }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta detalhes administrativos dos dois plantões e decisões registradas' })
  @ApiNotFoundResponse({ description: 'Solicitação não encontrada.' })
  detalhe(@Param('id', ParseObjectIdPipe) id: string) { return this.service.detalhe(id); }

  @Get(':id/validacao')
  @ApiOperation({ summary: 'Pré-valida elegibilidade, cobertura, limite e versão sem gravar alterações' })
  @ApiOkResponse({ description: 'Impedimentos e avisos estruturados; resultado informativo que será recalculado na decisão.' })
  validar(@Param('id', ParseObjectIdPipe) id: string) { return this.service.validar(id); }

  @Post(':id/aprovar') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprova e efetiva atomicamente uma troca previamente aceita' })
  @ApiOkResponse({ description: 'Nova versão oficial, decisão, auditoria e notificações confirmadas na transação.' })
  @ApiConflictResponse({ description: 'Solicitação ou versão atualizada por outra operação.' })
  @ApiUnprocessableEntityResponse({ description: 'Regra de elegibilidade, cobertura, revisão ou limite impede a aprovação.' })
  aprovar(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: AprovarTrocaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.aprovar(id, dto, usuario);
  }

  @Post(':id/recusar') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recusa uma solicitação aceita, registra o motivo e notifica os dois profissionais' })
  @ApiOkResponse({ description: 'Recusa confirmada; atribuições da escala permanecem inalteradas.' })
  @ApiConflictResponse({ description: 'Solicitação ou versão atualizada por outra operação.' })
  recusar(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: RecusarTrocaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.recusar(id, dto, usuario);
  }
}
