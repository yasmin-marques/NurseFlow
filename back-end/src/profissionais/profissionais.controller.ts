import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Perfis } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateProfissionalDto } from './dto/create-profissional.dto';
import { ListProfissionaisQueryDto } from './dto/list-profissionais-query.dto';
import { ProfissionalListaDto, ProfissionalResponseDto } from './dto/profissional-response.dto';
import { UpdateProfissionalDto } from './dto/update-profissional.dto';
import { PreviaImportacaoDto, ResultadoImportacaoDto } from './importacao/importacao.dto';
import { ProfissionaisImportacaoService } from './importacao/profissionais-importacao.service';
import { TAMANHO_MAXIMO_BYTES, validarArquivo, XLSX_MIME } from './importacao/planilha-profissionais';
import { ProfissionaisService } from './profissionais.service';

type ArquivoEnviado = Parameters<typeof validarArquivo>[0];

const uploadPlanilha = FileInterceptor('arquivo', { limits: { fileSize: TAMANHO_MAXIMO_BYTES, files: 1 } });
const corpoUpload = { schema: { type: 'object', required: ['arquivo'], properties: { arquivo: { type: 'string', format: 'binary' } } } };

@ApiTags('Profissionais')
@ApiBearerAuth()
@Perfis(Perfil.COORDENACAO)
@Controller('profissionais')
export class ProfissionaisController {
  constructor(
    private readonly profissionaisService: ProfissionaisService,
    private readonly importacaoService: ProfissionaisImportacaoService,
  ) {}

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

  // Rotas de importação declaradas antes de ':id' para não serem capturadas por ele.
  @Get('importacao/modelo')
  @ApiOperation({ summary: 'Baixa o modelo de planilha (.xlsx) para importação de profissionais' })
  @ApiProduces(XLSX_MIME)
  async baixarModelo(@Res() response: Response): Promise<void> {
    const buffer = await this.importacaoService.baixarModelo();
    response
      .set({ 'Content-Type': XLSX_MIME, 'Content-Disposition': 'attachment; filename="modelo-importacao-profissionais.xlsx"' })
      .send(buffer);
  }

  @Post('importacao/previa')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(uploadPlanilha)
  @ApiConsumes('multipart/form-data')
  @ApiBody(corpoUpload)
  @ApiOperation({ summary: 'Valida a planilha e informa o que seria cadastrado/atualizado, sem gravar nada' })
  @ApiResponse({ status: 200, type: PreviaImportacaoDto })
  async previaImportacao(@UploadedFile() arquivo?: ArquivoEnviado): Promise<PreviaImportacaoDto> {
    return this.importacaoService.previa(validarArquivo(arquivo));
  }

  @Post('importacao')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(uploadPlanilha)
  @ApiConsumes('multipart/form-data')
  @ApiBody(corpoUpload)
  @ApiOperation({ summary: 'Importa a planilha (cadastra novos e atualiza existentes por CPF) em uma única transação' })
  @ApiResponse({ status: 200, type: ResultadoImportacaoDto })
  @ApiUnprocessableEntityResponse({ description: 'A planilha possui registros inválidos; nada é gravado.' })
  async importar(@UploadedFile() arquivo?: ArquivoEnviado): Promise<ResultadoImportacaoDto> {
    return this.importacaoService.confirmar(validarArquivo(arquivo));
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
