import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { TipoRestricao } from "./restricao.schema";

const turnoValues = ["diurno", "noturno", "flexivel"] as const;

export class CriarRestricaoDto {
  @ApiProperty({ enum: TipoRestricao })
  @IsEnum(TipoRestricao)
  tipo: TipoRestricao;

  @ApiProperty({ example: "2026-10-01T00:00:00.000Z" })
  @IsDateString()
  inicio: string;

  @ApiProperty({ example: "2026-10-31T23:59:59.999Z" })
  @IsDateString()
  fim: string;

  @ApiPropertyOptional({
    type: [Number],
    description: "0=domingo; dias da semana recorrentes dentro do intervalo",
    example: [1, 3],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[] | null;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 6,
    description: "Compatibilidade com registros legados: dia da semana único",
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana?: number | null;

  @ApiPropertyOptional({
    enum: turnoValues,
    description: "Turno explícito da restrição ou vínculo",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsEnum(turnoValues as readonly string[])
  turno?: "diurno" | "noturno" | "flexivel" | null;

  @ApiPropertyOptional({
    description: "Motivo estruturado da ausência ou disponibilidade",
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  motivo?: string | null;

  @ApiPropertyOptional({
    description: "Observação complementar",
    maxLength: 300,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacao?: string | null;

  @ApiPropertyOptional({
    description: "Instituição vinculada ao compromisso externo",
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  instituicao?: string | null;

  @ApiPropertyOptional({
    description: "Tipo do vínculo externo",
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tipoVinculo?: string | null;
}

export class AtualizarRestricaoDto {
  @ApiPropertyOptional({ enum: TipoRestricao })
  @IsOptional()
  @IsEnum(TipoRestricao)
  tipo?: TipoRestricao;

  @ApiPropertyOptional({ example: "2026-10-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  inicio?: string;

  @ApiPropertyOptional({ example: "2026-10-31T23:59:59.999Z" })
  @IsOptional()
  @IsDateString()
  fim?: string;

  @ApiPropertyOptional({
    type: [Number],
    description: "0=domingo; dias da semana recorrentes dentro do intervalo",
    example: [1, 3],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[] | null;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 6,
    description: "Compatibilidade com registros legados: dia da semana único",
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana?: number | null;

  @ApiPropertyOptional({
    enum: turnoValues,
    description: "Turno explícito da restrição ou vínculo",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsEnum(turnoValues as readonly string[])
  turno?: "diurno" | "noturno" | "flexivel" | null;

  @ApiPropertyOptional({
    description: "Motivo estruturado da ausência ou disponibilidade",
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  motivo?: string | null;

  @ApiPropertyOptional({
    description: "Observação complementar",
    maxLength: 300,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacao?: string | null;

  @ApiPropertyOptional({
    description: "Instituição vinculada ao compromisso externo",
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  instituicao?: string | null;

  @ApiPropertyOptional({
    description: "Tipo do vínculo externo",
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tipoVinculo?: string | null;
}
