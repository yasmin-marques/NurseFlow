import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type AcaoImportacao = 'criar' | 'atualizar' | 'sem_alteracao' | 'invalido';

export class ErroLinhaDto {
  @ApiProperty({ example: 'CPF', description: 'Rótulo da coluna da planilha.' }) campo: string;
  @ApiProperty({ example: 'CPF inválido.' }) mensagem: string;
}

export class AlteracaoCampoDto {
  @ApiProperty({ example: 'Tipo de vínculo' }) campo: string;
  @ApiProperty({ nullable: true, type: String, example: 'CLT' }) atual: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'RPA' }) novo: string | null;
}

export class LinhaImportacaoDto {
  @ApiProperty({ description: 'Número da linha na planilha (1 = cabeçalho).' }) linha: number;
  @ApiProperty() nome: string;
  @ApiProperty({ description: 'CPF formatado quando válido; caso contrário, o texto informado.' }) cpf: string;
  @ApiProperty({ enum: ['criar', 'atualizar', 'sem_alteracao', 'invalido'] }) acao: AcaoImportacao;
  @ApiProperty({ type: [AlteracaoCampoDto], description: 'Preenchido apenas para atualizações.' }) alteracoes: AlteracaoCampoDto[];
  @ApiProperty({ type: [ErroLinhaDto] }) erros: ErroLinhaDto[];
  @ApiProperty({ type: [String], description: 'Observações que não impedem a importação.' }) avisos: string[];
}

export class ResumoPreviaDto {
  @ApiProperty() total: number;
  @ApiProperty() novos: number;
  @ApiProperty() atualizar: number;
  @ApiProperty() semAlteracao: number;
  @ApiProperty() invalidos: number;
}

export class PreviaImportacaoDto {
  @ApiProperty({ type: ResumoPreviaDto }) resumo: ResumoPreviaDto;
  @ApiProperty({ type: [LinhaImportacaoDto] }) linhas: LinhaImportacaoDto[];
  @ApiProperty({ description: 'false quando há registros inválidos: a confirmação é bloqueada.' }) podeConfirmar: boolean;
}

export class ResumoImportacaoDto {
  @ApiProperty() total: number;
  @ApiProperty() cadastrados: number;
  @ApiProperty() atualizados: number;
  @ApiProperty({ description: 'Linhas sem alterações em relação ao cadastro atual.' }) ignorados: number;
}

export class ResultadoImportacaoDto {
  @ApiProperty({ type: ResumoImportacaoDto }) resumo: ResumoImportacaoDto;
  @ApiPropertyOptional({ type: [LinhaImportacaoDto] }) linhas: LinhaImportacaoDto[];
}
