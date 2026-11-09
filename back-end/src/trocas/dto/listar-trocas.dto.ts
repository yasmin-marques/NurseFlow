import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const FILTROS_TROCA = ['pendentes', 'aprovadas', 'recusadas'] as const;
export type FiltroTroca = (typeof FILTROS_TROCA)[number];

export class ListarTrocasDto {
  @ApiPropertyOptional({ enum: FILTROS_TROCA, default: 'pendentes' })
  @IsOptional() @IsIn(FILTROS_TROCA) status: FiltroTroca = 'pendentes';

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) mes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 9999 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(9999) ano?: number;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
}
