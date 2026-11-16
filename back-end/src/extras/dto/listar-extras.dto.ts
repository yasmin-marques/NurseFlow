import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ExtraProgramadoSituacao } from '../extras.schema';

export class ListarExtrasDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 9999, example: 2027 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  ano?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12, example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  @ApiPropertyOptional({ description: 'ID do setor' })
  @IsOptional()
  @IsString()
  setorId?: string;

  @ApiPropertyOptional({ description: 'ID do profissional substituto ou coberto' })
  @IsOptional()
  @IsString()
  profissionalId?: string;

  @ApiPropertyOptional({ description: 'Motivo do extra (ex: ferias, ausencia, atestado, reforco)' })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({ enum: ExtraProgramadoSituacao })
  @IsOptional()
  @IsEnum(ExtraProgramadoSituacao)
  situacao?: ExtraProgramadoSituacao;

  @ApiPropertyOptional({ description: 'Busca textual por nome de substituto/coberto, observação ou motivo' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;
}

