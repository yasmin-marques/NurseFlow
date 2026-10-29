import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GerarEscalaDto {
  @ApiProperty({ minimum: 1, maximum: 12, example: 11 })
  @IsInt() @Min(1) @Max(12)
  mes: number;

  @ApiProperty({ minimum: 2020, maximum: 2100, example: 2026 })
  @IsInt() @Min(2020) @Max(2100)
  ano: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Se já existir um RASCUNHO do período, substitui seu conteúdo por uma nova geração. Escalas publicadas nunca são substituídas.',
  })
  @IsOptional() @IsBoolean()
  substituirRascunho?: boolean;
}
