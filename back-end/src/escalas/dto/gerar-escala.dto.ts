import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsMongoId, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const TURNOS_ESCALA = ['diurno', 'noturno'] as const;
export type TurnoEscala = (typeof TURNOS_ESCALA)[number];

export class GerarEscalaDto {
  @ApiProperty({ minimum: 1, maximum: 12, example: 11 })
  @IsInt() @Min(1) @Max(12)
  mes: number;

  @ApiProperty({ minimum: 1, maximum: 9999, example: 2026 })
  @IsInt() @Min(1) @Max(9999)
  ano: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Identificador usado para cancelar esta geração em andamento.' })
  @IsOptional() @IsUUID('4')
  operacaoId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Se já existir um rascunho ou uma escala em revisão no período, substitui seu conteúdo por uma nova geração. Escalas validadas, publicadas ou finalizadas nunca são substituídas.',
  })
  @IsOptional() @IsBoolean()
  substituirRascunho?: boolean;

  @ApiPropertyOptional({ type: [String], format: 'objectId', description: 'Setores ativos a incluir. Omitido significa todos os setores ativos.' })
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsMongoId({ each: true })
  setorIds?: string[];

  @ApiPropertyOptional({
    enum: TURNOS_ESCALA,
    isArray: true,
    description: 'Turnos a otimizar. Omitido significa diurno e noturno.',
  })
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsIn(TURNOS_ESCALA, { each: true })
  turnos?: TurnoEscala[];
}
