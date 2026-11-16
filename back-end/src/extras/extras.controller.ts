import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Perfis, UsuarioAtual } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import {
  AtualizarExtraHttpDto,
  CancelarExtraHttpDto,
  ConciliarExtraHttpDto,
  CriarExtraHttpDto,
  ListarExtrasDto,
  ResumoExtrasDto,
} from './dto';
import { ExtrasService } from './extras.service';

@ApiTags('Extras')
@ApiBearerAuth()
@Controller('extras')
export class ExtrasController {
  constructor(private readonly extrasService: ExtrasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os extras programados com filtros e paginação' })
  @ApiOkResponse({ description: 'Lista paginada de extras programados.' })
  listar(@Query() query: ListarExtrasDto) {
    return this.extrasService.listar(query);
  }

  @Get('resumo')
  @ApiOperation({ summary: 'Obtém indicadores consolidados do mês (extras ativos, horas e RPAs)' })
  @ApiOkResponse({ description: 'Indicadores mensais consolidados.' })
  resumo(@Query() query: ResumoExtrasDto) {
    return this.extrasService.resumo(query.ano, query.mes);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtém os detalhes de um extra programado e seu histórico de auditoria' })
  @ApiOkResponse({ description: 'Detalhes do extra e histórico de auditoria.' })
  @ApiNotFoundResponse({ description: 'Extra programado não encontrado.' })
  detalhe(@Param('id', ParseObjectIdPipe) id: string) {
    return this.extrasService.detalhe(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Perfis(Perfil.COORDENACAO)
  @ApiOperation({ summary: 'Registra um novo extra programado (somente Coordenação)' })
  @ApiResponse({ status: 201, description: 'Extra programado criado com sucesso.' })
  @ApiConflictResponse({ description: 'Extra programado duplicado.' })
  @ApiUnprocessableEntityResponse({ description: 'Regra de negócio violada (elegibilidade, descanso ou limites).' })
  criar(
    @Body() dto: CriarExtraHttpDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.extrasService.criar(
      {
        ...dto,
        criadoPor: usuario.id,
      },
      { validar: true },
    );
  }

  @Patch(':id')
  @Perfis(Perfil.COORDENACAO)
  @ApiOperation({ summary: 'Edita um extra programado com controle de revisão (somente Coordenação)' })
  @ApiOkResponse({ description: 'Extra programado atualizado com sucesso.' })
  @ApiNotFoundResponse({ description: 'Extra programado não encontrado.' })
  @ApiConflictResponse({ description: 'Conflito de revisão ou extra já cancelado.' })
  @ApiUnprocessableEntityResponse({ description: 'Regra de negócio violada ao atualizar.' })
  atualizar(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AtualizarExtraHttpDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.extrasService.editar(
      id,
      {
        ...dto,
        atualizadoPor: usuario.id,
      },
      { validar: true },
    );
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @Perfis(Perfil.COORDENACAO)
  @ApiOperation({ summary: 'Cancela logicamente um extra programado com justificativa (somente Coordenação)' })
  @ApiOkResponse({ description: 'Extra programado cancelado com sucesso.' })
  @ApiNotFoundResponse({ description: 'Extra programado não encontrado.' })
  @ApiConflictResponse({ description: 'Conflito de revisão ou extra já cancelado.' })
  cancelar(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CancelarExtraHttpDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.extrasService.cancelar(id, {
      ...dto,
      canceladoPor: usuario.id,
    });
  }

  @Post(':id/conciliar')
  @HttpCode(HttpStatus.OK)
  @Perfis(Perfil.COORDENACAO)
  @ApiOperation({ summary: 'Concilia um extra programado com uma escala editável (somente Coordenação)' })
  @ApiOkResponse({ description: 'Extra programado conciliado com sucesso.' })
  @ApiNotFoundResponse({ description: 'Extra programado ou escala não encontrada.' })
  @ApiConflictResponse({ description: 'Escala em estado não editável ou extra cancelado.' })
  @ApiUnprocessableEntityResponse({ description: 'Data do extra incompatível com o período da escala.' })
  conciliar(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ConciliarExtraHttpDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.extrasService.conciliar(id, dto, usuario.id);
  }

  @Post(':id/desconciliar')
  @HttpCode(HttpStatus.OK)
  @Perfis(Perfil.COORDENACAO)
  @ApiOperation({ summary: 'Desvincula um extra programado da escala editável (somente Coordenação)' })
  @ApiOkResponse({ description: 'Extra programado desvinculado com sucesso.' })
  @ApiNotFoundResponse({ description: 'Extra programado não encontrado.' })
  @ApiConflictResponse({ description: 'Escala em estado não editável.' })
  desconciliar(
    @Param('id', ParseObjectIdPipe) id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.extrasService.desconciliar(id, usuario.id);
  }
}

