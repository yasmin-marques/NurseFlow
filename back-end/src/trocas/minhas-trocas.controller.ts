import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { Perfis, UsuarioAtual } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { MinhasTrocasService } from './minhas-trocas.service';
import { CriarMinhaTrocaDto, ListarMinhasTrocasDto, OperacaoTrocaProfissionalDto } from './dto/minhas-trocas.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';

@ApiTags('Minhas trocas')
@ApiBearerAuth()
@Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO)
@Controller('trocas/minhas')
export class MinhasTrocasController {
  constructor(private readonly minhas: MinhasTrocasService) {}

  @Get('contagem')
  @ApiOperation({ summary: 'Conta solicitações de troca aguardando resposta do profissional autenticado' })
  @ApiOkResponse({ description: 'Quantidade de solicitações recebidas ainda sem resposta.' })
  contar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.minhas.contar(usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Lista solicitações profissionais visíveis ao participante autenticado por Recebidas, Enviadas ou Histórico.' })
  @ApiOkResponse({ description: 'Página filtrada pela direção e pelo estado da solicitação.' })
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() query: ListarMinhasTrocasDto) { return this.minhas.listar(usuario, query); }

  @Get('plantoes')
  @ApiOperation({ summary: 'Lista vínculos futuros da versão oficial vigente pertencentes ao profissional autenticado.' })
  plantoes(@UsuarioAtual() usuario: UsuarioAutenticado) { return this.minhas.plantoesProprios(usuario); }

  @Get('plantoes/:vinculoId/candidatos')
  @ApiOperation({ summary: 'Lista pares de colega e vínculo aptos para o plantão próprio selecionado.' })
  @ApiUnprocessableEntityResponse({ description: 'Nenhuma opção elegível para a seleção atual.' })
  candidatos(@Param('vinculoId', ParseObjectIdPipe) vinculoId: string, @UsuarioAtual() usuario: UsuarioAutenticado) { return this.minhas.candidatos(usuario, vinculoId); }

  @Post()
  @ApiOperation({ summary: 'Solicita uma troca sem alterar a escala; o destinatário é resolvido pelo vínculo escolhido.' })
  @ApiCreatedResponse({ description: 'Solicitação aguardando resposta do profissional solicitado.' })
  @ApiConflictResponse({ description: 'Versão oficial ou estado dos vínculos mudou.' })
  @ApiUnprocessableEntityResponse({ description: 'Regras de elegibilidade ou limite do solicitante impedem a abertura.' })
  criar(@Body() dto: CriarMinhaTrocaDto, @UsuarioAtual() usuario: UsuarioAutenticado) { return this.minhas.criar(usuario, dto); }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta os detalhes de uma solicitação participante, incluindo histórico e motivo de decisão administrativa.' })
  @ApiNotFoundResponse({ description: 'Solicitação inexistente ou não visível ao profissional autenticado.' })
  detalhe(@Param('id', ParseObjectIdPipe) id: string, @UsuarioAtual() usuario: UsuarioAutenticado) { return this.minhas.detalhe(id, usuario); }

  @Post(':id/aceite') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceite do profissional destinatário; encaminha o pedido à fila da Coordenação sem efetivar a escala.' })
  @ApiConflictResponse({ description: 'Estado, versão ou termos mudaram desde a solicitação.' })
  @ApiUnprocessableEntityResponse({ description: 'Regras atuais impedem o aceite.' })
  aceitar(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: OperacaoTrocaProfissionalDto, @UsuarioAtual() usuario: UsuarioAutenticado) { return this.minhas.aceitar(usuario, id, dto.operacaoId); }

  @Post(':id/recusar') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recusa pelo profissional destinatário; não exige justificativa administrativa e não altera a escala.' })
  recusar(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: OperacaoTrocaProfissionalDto, @UsuarioAtual() usuario: UsuarioAutenticado) { return this.minhas.recusar(usuario, id, dto.operacaoId); }

  @Post(':id/cancelar') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelamento pelo remetente enquanto o pedido aguarda resposta ou decisão da Coordenação.' })
  @ApiConflictResponse({ description: 'A solicitação já foi concluída ou alterada por outra operação.' })
  cancelar(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: OperacaoTrocaProfissionalDto, @UsuarioAtual() usuario: UsuarioAutenticado) { return this.minhas.cancelar(usuario, id, dto.operacaoId); }
}
