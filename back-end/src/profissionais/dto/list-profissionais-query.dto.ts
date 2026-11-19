import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais.enums';

export enum Ordem {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListProfissionaisQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome, CPF (com ou sem máscara) ou COREN.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  busca?: string;

  @ApiPropertyOptional({ enum: Formacao })
  @IsOptional()
  @IsEnum(Formacao)
  formacao?: Formacao;

  @ApiPropertyOptional({ enum: StatusProfissional })
  @IsOptional()
  @IsEnum(StatusProfissional)
  status?: StatusProfissional;

  @ApiPropertyOptional({ enum: TipoVinculo })
  @IsOptional()
  @IsEnum(TipoVinculo)
  tipoVinculo?: TipoVinculo;

  @ApiPropertyOptional({ enum: Ordem, default: Ordem.ASC, description: 'Ordenação por nome.' })
  @IsOptional()
  @IsEnum(Ordem)
  ordem: Ordem = Ordem.ASC;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
