import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TipoVinculo } from '../profissionais/profissionais.enums';

export class AtualizarLimitesDto {
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) limiteTrocas?: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) maxExtras?: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) limitePlantoes?: number;
}
export class DefinirCargaDto {
  @ApiProperty({ enum: TipoVinculo }) @IsEnum(TipoVinculo) vinculo: TipoVinculo;
  @ApiProperty({ enum: [28, 29, 30, 31] }) @IsInt() @Min(28) @Max(31) diasMes: number;
  @ApiProperty() @IsInt() @Min(0) plantoes24h: number;
  @ApiProperty() @IsInt() @Min(0) plantoes12h: number;
}
export class PeriodoDto {
  @ApiProperty({ example: 2026 }) @Type(() => Number) @IsInt() @Min(2000) @Max(2100) ano: number;
  @ApiProperty({ example: 10 }) @Type(() => Number) @IsInt() @Min(1) @Max(12) mes: number;
}
