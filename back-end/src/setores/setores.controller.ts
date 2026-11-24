import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import {
  CreateSetorDto,
  CreateSubsetorDto,
  ListSetoresQueryDto,
  SetorResponseDto,
  UpdateSetorDto,
  UpdateSubsetorDto,
} from './dto/setor.dto';
import { SetoresService } from './setores.service';

@ApiTags('Setores')
@ApiBearerAuth()
@Perfis(Perfil.COORDENACAO)
@Controller('setores')
export class SetoresController {
  constructor(private readonly setoresService: SetoresService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um setor com o quantitativo mínimo por turno (DA07)' })
  @ApiResponse({ status: 201, type: SetorResponseDto })
  @ApiConflictResponse({ description: 'Já existe um setor com este nome' })
  criar(@Body() dto: CreateSetorDto): Promise<SetorResponseDto> {
    return this.setoresService.criar(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os setores, ativos e inativos (somente Coordenação)' })
  @ApiResponse({ status: 200, type: [SetorResponseDto] })
  listar(@Query() query: ListSetoresQueryDto): Promise<SetorResponseDto[]> {
    return this.setoresService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um setor (somente Coordenação)' })
  @ApiResponse({ status: 200, type: SetorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  obter(@Param('id', ParseObjectIdPipe) id: string): Promise<SetorResponseDto> {
    return this.setoresService.obter(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita o setor e/ou o quantitativo mínimo por turno (DA07, DA08)' })
  @ApiResponse({ status: 200, type: SetorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  @ApiConflictResponse({ description: 'Já existe um setor com este nome' })
  atualizar(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateSetorDto): Promise<SetorResponseDto> {
    return this.setoresService.atualizar(id, dto);
  }

  @Patch(':id/inativar')
  @ApiOperation({ summary: 'Inativa o setor (sem exclusão física)' })
  @ApiResponse({ status: 200, type: SetorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  inativar(@Param('id', ParseObjectIdPipe) id: string): Promise<SetorResponseDto> {
    return this.setoresService.inativar(id);
  }

  @Patch(':id/ativar')
  @ApiOperation({ summary: 'Reativa um setor inativo' })
  @ApiResponse({ status: 200, type: SetorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  ativar(@Param('id', ParseObjectIdPipe) id: string): Promise<SetorResponseDto> {
    return this.setoresService.ativar(id);
  }

  @Post(':id/subsetores')
  @ApiOperation({ summary: 'Cadastra um subsetor com o mínimo de técnicos; devolve o setor atualizado' })
  @ApiResponse({ status: 201, type: SetorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor não encontrado' })
  @ApiConflictResponse({ description: 'Já existe um subsetor com este nome no setor' })
  criarSubsetor(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: CreateSubsetorDto): Promise<SetorResponseDto> {
    return this.setoresService.criarSubsetor(id, dto);
  }

  @Patch(':id/subsetores/:subsetorId')
  @ApiOperation({ summary: 'Edita nome, descrição e/ou mínimo de técnicos do subsetor' })
  @ApiResponse({ status: 200, type: SetorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor ou subsetor (do setor informado) não encontrado' })
  @ApiConflictResponse({ description: 'Já existe um subsetor com este nome no setor' })
  atualizarSubsetor(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('subsetorId', ParseObjectIdPipe) subsetorId: string,
    @Body() dto: UpdateSubsetorDto,
  ): Promise<SetorResponseDto> {
    return this.setoresService.atualizarSubsetor(id, subsetorId, dto);
  }

  @Patch(':id/subsetores/:subsetorId/inativar')
  @ApiOperation({ summary: 'Inativa o subsetor (bloqueado se houver profissionais vinculados ou se for o único ativo)' })
  @ApiResponse({ status: 200, type: SetorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor ou subsetor não encontrado' })
  @ApiConflictResponse({ description: 'Subsetor com profissionais vinculados ou único subsetor ativo' })
  inativarSubsetor(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('subsetorId', ParseObjectIdPipe) subsetorId: string,
  ): Promise<SetorResponseDto> {
    return this.setoresService.inativarSubsetor(id, subsetorId);
  }

  @Patch(':id/subsetores/:subsetorId/ativar')
  @ApiOperation({ summary: 'Reativa um subsetor inativo' })
  @ApiResponse({ status: 200, type: SetorResponseDto })
  @ApiNotFoundResponse({ description: 'Setor ou subsetor não encontrado' })
  ativarSubsetor(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('subsetorId', ParseObjectIdPipe) subsetorId: string,
  ): Promise<SetorResponseDto> {
    return this.setoresService.ativarSubsetor(id, subsetorId);
  }
}
