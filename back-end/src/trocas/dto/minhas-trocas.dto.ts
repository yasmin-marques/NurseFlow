import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const ABAS_TROCAS_PROFISSIONAL = ['recebidas', 'enviadas', 'historico'] as const;
export class ListarMinhasTrocasDto {
  @ApiPropertyOptional({ enum: ABAS_TROCAS_PROFISSIONAL, default: 'recebidas' })
  @IsOptional() @IsIn(ABAS_TROCAS_PROFISSIONAL) aba: typeof ABAS_TROCAS_PROFISSIONAL[number] = 'recebidas';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
}
export class CriarMinhaTrocaDto {
  @ApiProperty() @IsString() vinculoSolicitanteId: string;
  @ApiProperty() @IsString() vinculoSolicitadoId: string;
  @ApiProperty() @IsInt() @Min(1) versaoOficialEsperada: number;
  @ApiProperty() @IsUUID('4') operacaoId: string;
}
export class OperacaoTrocaProfissionalDto {
  @ApiProperty() @IsUUID('4') operacaoId: string;
}
