import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class MeusPlantoesQueryDto {
  @ApiPropertyOptional({ enum: ['proximos', 'anteriores'], default: 'proximos' })
  @IsOptional() @IsIn(['proximos', 'anteriores'])
  situacao?: 'proximos' | 'anteriores';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000)
  pagina?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limite?: number;
}

export class EscalaGeralQueryDto {
  @ApiProperty({ example: 2026, minimum: 1, maximum: 9999 })
  @Type(() => Number) @IsInt() @Min(1) @Max(9999)
  ano: number;

  @ApiProperty({ example: 11, minimum: 1, maximum: 12 })
  @Type(() => Number) @IsInt() @Min(1) @Max(12)
  mes: number;
}

export class EscalaGeralDiaQueryDto {
  @ApiProperty({ example: '2026-11-10', description: 'Dia de início dos plantões (AAAA-MM-DD).' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'data deve estar no formato AAAA-MM-DD.' })
  data: string;
}
