import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateProfissionalDto } from './dto/create-profissional.dto';
import { ListProfissionaisQueryDto } from './dto/list-profissionais-query.dto';
import { ProfissionalListaDto, ProfissionalResponseDto } from './dto/profissional-response.dto';
import { UpdateProfissionalDto } from './dto/update-profissional.dto';
import { ProfissionaisService } from './profissionais.service';

@ApiTags('Profissionais')
@ApiBearerAuth()
@Perfis(Perfil.COORDENACAO)
@Controller('profissionais')
export class ProfissionaisController {
  constructor(private readonly profissionaisService: ProfissionaisService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um profissional (DA02)' })
  @ApiResponse({ status: 201, type: ProfissionalResponseDto })
  @ApiConflictResponse({ description: 'Profissional já cadastrado (CPF ou COREN) ou e-mail em uso' })
  criar(@Body() dto: CreateProfissionalDto): Promise<ProfissionalResponseDto> {
    return this.profissionaisService.criar(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista/busca profissionais com filtros e ordenação (DA03)' })
  @ApiResponse({ status: 200, type: ProfissionalListaDto })
  listar(@Query() query: ListProfissionaisQueryDto): Promise<ProfissionalListaDto> {
    return this.profissionaisService.listar(query);
  }

  @Get('todos')
  @ApiOperation({ summary: 'Lista todos os profissionais, sem filtros nem paginação' })
  @ApiResponse({ status: 200, type: [ProfissionalResponseDto] })
  listarTodos(): Promise<ProfissionalResponseDto[]> {
    return this.profissionaisService.listarTodos();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um profissional' })
  @ApiResponse({ status: 200, type: ProfissionalResponseDto })
  @ApiNotFoundResponse({ description: 'Profissional não encontrado' })
  obter(@Param('id', ParseObjectIdPipe) id: string): Promise<ProfissionalResponseDto> {
    return this.profissionaisService.obter(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita um profissional (DA03)' })
  @ApiResponse({ status: 200, type: ProfissionalResponseDto })
  @ApiNotFoundResponse({ description: 'Profissional não encontrado' })
  @ApiConflictResponse({ description: 'CPF/COREN/e-mail já em uso, ou desativação impedida por plantões futuros publicados' })
  atualizar(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateProfissionalDto): Promise<ProfissionalResponseDto> {
    return this.profissionaisService.atualizar(id, dto);
  }

  @Patch(':id/desativar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativa logicamente um profissional, preservando o histórico (DA04)' })
  @ApiResponse({ status: 200, type: ProfissionalResponseDto })
  @ApiNotFoundResponse({ description: 'Profissional não encontrado' })
  @ApiConflictResponse({ description: 'Há plantões futuros publicados que precisam de cobertura' })
  desativar(@Param('id', ParseObjectIdPipe) id: string): Promise<ProfissionalResponseDto> {
    return this.profissionaisService.desativar(id);
  }
}
