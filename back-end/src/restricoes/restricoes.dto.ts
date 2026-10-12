import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TipoRestricao } from './restricao.schema';
export class CriarRestricaoDto {
  @ApiProperty({ enum: TipoRestricao }) @IsEnum(TipoRestricao) tipo: TipoRestricao;
  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' }) @IsDateString() inicio: string;
  @ApiProperty({ example: '2026-10-31T23:59:59.999Z' }) @IsDateString() fim: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 6, description: '0=domingo; recorrência semanal dentro do intervalo' })
  @IsOptional() @IsInt() @Min(0) @Max(6) diaSemana?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) observacao?: string;
}
export class AtualizarRestricaoDto extends CriarRestricaoDto {}
