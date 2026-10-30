import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { Perfis, UsuarioAtual } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { ConfirmarRemocaoEscalaDto, PeriodoEscalaDto, PublicarEscalaDto, RevisaoEscalaDto } from './dto/escala.dto';
import { GerarEscalaDto } from './dto/gerar-escala.dto';
import { ExportarEscalaPdfDto } from './dto/exportar-escala-pdf.dto';
import { LotePlantoesDto, PlantaoDto } from './dto/plantao.dto';
import { EscalasService } from './escalas.service';
import { EscalaPdfService } from './escala-pdf.service';

@ApiTags('Escalas') @ApiBearerAuth() @Perfis(Perfil.COORDENACAO)
@Controller('escalas')
export class EscalasController {
  constructor(
    private readonly service: EscalasService,
    private readonly pdfService: EscalaPdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista a escala existente para um mês e ano' })
  @ApiOkResponse({ description: 'Retorna a escala do período em uma lista; lista vazia quando não existe escala.' })
  @ApiBadRequestResponse({ description: 'Ano ou mês inválido' })
  listar(@Query() periodo: PeriodoEscalaDto) {
    return this.service.listarPorPeriodo(periodo.ano, periodo.mes);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um rascunho vazio para montagem manual' })
  @ApiCreatedResponse({ description: 'Rascunho criado e retornado com a estrutura de consulta da escala.' })
  @ApiBadRequestResponse({ description: 'Ano ou mês inválido' })
  @ApiConflictResponse({ description: 'Já existe uma escala para o período informado' })
  criarRascunho(@Body() periodo: PeriodoEscalaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.criarRascunho(periodo, usuario);
  }

  @Post('gerar') @HttpCode(201)
  @ApiOperation({
    summary: 'Gera a escala mensal automaticamente (RF005/US07)',
    description:
      'Otimiza o mês inteiro (todos os setores ativos e profissionais ativos) com OR-Tools CP-SAT, usando as configurações vigentes do período. ' +
      'Salva como rascunho e devolve a escala, as vagas descobertas (pendências) e os conflitos. Pode substituir explicitamente um rascunho ou uma escala em revisão; versões validadas, publicadas ou finalizadas são preservadas.',
  })
  gerar(@Body() dto: GerarEscalaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.gerar(dto, usuario);
  }

  @Delete('gerar/:operacaoId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Interrompe uma geração em andamento e impede que ela seja salva' })
  @ApiAcceptedResponse({ description: 'O cancelamento foi encaminhado ao otimizador.' })
  @ApiConflictResponse({ description: 'A geração já está sendo salva ou não pode ser cancelada.' })
  @ApiNotFoundResponse({ description: 'Não há geração em andamento com esse identificador.' })
  cancelarGeracao(@Param('operacaoId', new ParseUUIDPipe({ version: '4' })) operacaoId: string) {
    return this.service.cancelarGeracao(operacaoId);
  }

  @Post(':id/plantoes')
  @ApiOperation({ summary: 'Inclui um plantão e sua equipe em um rascunho' })
  @ApiCreatedResponse({ description: 'Plantão incluído após validação de função, disponibilidade, descanso e carga.' })
  @ApiBadRequestResponse({ description: 'Dados do plantão inválidos' })
  @ApiNotFoundResponse({ description: 'Escala, setor ou profissional não encontrado' })
  @ApiConflictResponse({ description: 'Escala publicada/finalizada ou revisão concorrente' })
  incluirPlantao(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: PlantaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.service.incluirPlantao(id, dto, usuario);
  }

  @Post(':id/plantoes/validar-lote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pré-valida alterações em lote sem persistir plantões' })
  @ApiOkResponse({ description: 'Retorna a revisão consultada, o resultado da validação e os conflitos encontrados.' })
  @ApiConflictResponse({ description: 'Escala publicada/finalizada ou revisão concorrente.' })
  validarLotePlantoes(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: LotePlantoesDto) {
    return this.service.validarLotePlantoes(id, dto);
  }

  @Post(':id/plantoes/lote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grava alterações de plantões em uma única transação e revisão' })
  @ApiOkResponse({ description: 'Retorna a escala após salvar todas as alterações do lote.' })
  @ApiBadRequestResponse({ description: 'Dados do lote inválidos.' })
  @ApiNotFoundResponse({ description: 'Escala, plantão, setor ou profissional não encontrado.' })
  @ApiConflictResponse({ description: 'Escala publicada/finalizada ou revisão concorrente.' })
  @ApiUnprocessableEntityResponse({ description: 'Uma alteração viola as regras da escala; nenhuma alteração é persistida.' })
  salvarLotePlantoes(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: LotePlantoesDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.service.salvarLotePlantoes(id, dto, usuario);
  }

  @Patch(':id/plantoes/:plantaoId')
  @ApiOperation({ summary: 'Edita o plantão e sua equipe em um rascunho' })
  @ApiOkResponse({ description: 'Plantão atualizado após revalidação das regras da escala.' })
  @ApiBadRequestResponse({ description: 'Dados do plantão inválidos' })
  @ApiNotFoundResponse({ description: 'Escala, plantão, setor ou profissional não encontrado' })
  @ApiConflictResponse({ description: 'Escala publicada/finalizada ou revisão concorrente' })
  editarPlantao(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('plantaoId', ParseObjectIdPipe) plantaoId: string,
    @Body() dto: PlantaoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.service.editarPlantao(id, plantaoId, dto, usuario);
  }

  @Post(':id/revisao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia a revisão de um rascunho ou da última versão publicada' })
  @ApiOkResponse({ description: 'Escala movida para revisão a partir do rascunho ou snapshot oficial mais recente.' })
  @ApiConflictResponse({ description: 'Estado inválido ou revisão desatualizada' })
  iniciarRevisao(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RevisaoEscalaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.service.iniciarRevisao(id, dto.revisaoEsperada, usuario);
  }

  @Post(':id/validar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Valida conflitos e cobertura da escala em revisão' })
  @ApiOkResponse({ description: 'Escala validada com resultado e percentual de cobertura persistidos.' })
  @ApiUnprocessableEntityResponse({ description: 'A escala contém conflitos bloqueantes ou dados inválidos.' })
  @ApiConflictResponse({ description: 'A escala não está em revisão ou a revisão está desatualizada' })
  validarEscala(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RevisaoEscalaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.service.validarEscala(id, dto.revisaoEsperada, usuario);
  }

  @Post(':id/publicar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publica uma escala validada e preserva um snapshot imutável' })
  @ApiOkResponse({ description: 'Escala publicada com versão e evento de auditoria registrados.' })
  @ApiConflictResponse({ description: 'Estado inválido, revisão desatualizada ou confirmação de pendências ausente.' })
  @ApiUnprocessableEntityResponse({ description: 'A escala contém conflitos bloqueantes.' })
  publicarEscala(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: PublicarEscalaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.service.publicarEscala(id, dto, usuario);
  }

  @Get(':id/versao-oficial')
  @ApiOperation({ summary: 'Consulta o snapshot oficial mais recente da escala' })
  @ApiOkResponse({ description: 'Retorna os metadados e o snapshot imutável da versão publicada mais recente.' })
  @ApiNotFoundResponse({ description: 'Escala ou versão oficial não encontrada' })
  obterVersaoOficial(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.obterVersaoOficial(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Exporta a versão oficial da escala em PDF ou arquivo ZIP por setor' })
  @ApiProduces('application/pdf', 'application/zip')
  @ApiNotFoundResponse({ description: 'Escala não publicada ou setor sem conteúdo nesta versão.' })
  @ApiBadRequestResponse({ description: 'Parâmetros de exportação incompatíveis ou inválidos.' })
  async exportarPdf(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: ExportarEscalaPdfDto,
    @Res() response: Response,
  ) {
    if (query.setorId && query.separarPorSetor === 'true') {
      throw new BadRequestException('Escolha um setor específico ou a exportação separada por todos os setores.');
    }

    const dados = await this.service.obterDadosPdf(id);
    if (query.separarPorSetor === 'true') {
      const buffer = await this.pdfService.porTodosSetores(dados);
      return response
        .set({
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="escala-${dados.escala.ano}-${String(dados.escala.mes).padStart(2, '0')}-setores.zip"`,
        })
        .send(buffer);
    }
    if (query.setorId) {
      const setor = await this.pdfService.porSetor(dados, query.setorId);
      return response
        .set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="escala-${dados.escala.ano}-${String(dados.escala.mes).padStart(2, '0')}-${setor.nomeArquivo}.pdf"`,
        })
        .send(setor.buffer);
    }

    const buffer = await this.pdfService.geral(dados);
    return response
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="escala-${dados.escala.ano}-${String(dados.escala.mes).padStart(2, '0')}-geral.pdf"`,
      })
      .send(buffer);
  }

  @Get(':id/auditoria')
  @ApiOperation({ summary: 'Lista o histórico de alterações e transições da escala' })
  @ApiOkResponse({ description: 'Retorna os eventos de auditoria mais recentes primeiro.' })
  @ApiNotFoundResponse({ description: 'Escala não encontrada' })
  listarAuditoria(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.listarAuditoria(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma escala gerada (plantões, pendências e conflitos)' })
  obter(@Param('id', ParseObjectIdPipe) id: string) {
    return this.service.obter(id);
  }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove um rascunho após confirmação explícita' })
  @ApiNoContentResponse({ description: 'Rascunho e plantões relacionados removidos.' })
  @ApiBadRequestResponse({ description: 'Confirmação ausente ou inválida' })
  @ApiNotFoundResponse({ description: 'Escala não encontrada' })
  @ApiConflictResponse({ description: 'Somente escalas em rascunho podem ser removidas' })
  remover(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: ConfirmarRemocaoEscalaDto) {
    return this.service.removerRascunho(id, dto.confirmar, dto.revisaoEsperada);
  }
}
