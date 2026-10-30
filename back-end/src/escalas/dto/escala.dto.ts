import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Equals, IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PeriodoEscalaDto {
  @ApiProperty({ example: 2026, minimum: 1, maximum: 9999 })
  @Type(() => Number) @IsInt() @Min(1) @Max(9999)
  ano: number;

  @ApiProperty({ example: 10, minimum: 1, maximum: 12 })
  @Type(() => Number) @IsInt() @Min(1) @Max(12)
  mes: number;
}

export class RevisaoEscalaDto {
  @ApiProperty({ minimum: 1, description: 'Revisão atualmente exibida pelo cliente.' })
  @Type(() => Number) @IsInt() @Min(1)
  revisaoEsperada: number;
}

export class PublicarEscalaDto extends RevisaoEscalaDto {
  @ApiPropertyOptional({ default: false, description: 'Confirma a publicação com pendências e alertas aceitos.' })
  @IsOptional() @IsBoolean()
  confirmarPendencias?: boolean;
}

export class ConfirmarRemocaoEscalaDto extends RevisaoEscalaDto {
  @ApiProperty({ enum: [true], description: 'Deve ser true para confirmar a remoção do rascunho.' })
  @Equals(true, { message: 'A remoção exige confirmação explícita.' })
  confirmar: boolean;
}
