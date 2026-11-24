import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDefined, IsInt, IsMongoId, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { normalizarEspacos } from '../../common/utils/text';

const LIMITE_QUANTITATIVO = 99;

/**
 * Quantitativo mínimo do setor. `tecnicos` só vale para setor SEM subsetores (obrigatório nesse caso); em setor com
 * subsetores o mínimo de técnicos pertence a cada subsetor e o campo deve ser omitido (a regra é verificada no service).
 */
export class QuantitativoDto {
  @ApiProperty({ minimum: 0, maximum: LIMITE_QUANTITATIVO, example: 2, description: 'Inclui o chefe do plantão.' })
  @IsInt({ message: 'Informe um número inteiro' })
  @Min(0)
  @Max(LIMITE_QUANTITATIVO)
  enfermeiros: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: LIMITE_QUANTITATIVO,
    example: 3,
    description: 'Obrigatório em setor sem subsetores; não informar em setor com subsetores (o mínimo é de cada subsetor).',
  })
  @IsOptional()
  @IsInt({ message: 'Informe um número inteiro' })
  @Min(0)
  @Max(LIMITE_QUANTITATIVO)
  tecnicos?: number;
}

export class QuantitativoSubsetorDto {
  @ApiProperty({ minimum: 0, maximum: LIMITE_QUANTITATIVO, example: 2, description: 'Mínimo de técnicos de enfermagem do subsetor.' })
  @IsInt({ message: 'Informe um número inteiro' })
  @Min(0)
  @Max(LIMITE_QUANTITATIVO)
  tecnicos: number;
}

export class CreateSubsetorDto {
  @ApiProperty({ example: 'UTI Adulto' })
  @Transform(({ value }) => normalizarEspacos(value))
  @IsString()
  @Length(2, 80, { message: 'O nome do subsetor deve ter entre 2 e 80 caracteres' })
  nome: string;

  @ApiPropertyOptional({ example: 'Leitos de adultos' })
  @IsOptional()
  @Transform(({ value }) => normalizarEspacos(value))
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @ApiProperty({ type: QuantitativoSubsetorDto, description: 'Mínimo simultâneo por plantão de 24 horas.' })
  @IsDefined({ message: 'plantao24h é obrigatório' })
  @ValidateNested()
  @Type(() => QuantitativoSubsetorDto)
  plantao24h: QuantitativoSubsetorDto;
}

class QuantitativoSubsetorParcialDto extends PartialType(QuantitativoSubsetorDto) {}

export class UpdateSubsetorDto {
  @ApiPropertyOptional({ example: 'UTI Adulto' })
  @IsOptional()
  @Transform(({ value }) => normalizarEspacos(value))
  @IsString()
  @Length(2, 80, { message: 'O nome do subsetor deve ter entre 2 e 80 caracteres' })
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizarEspacos(value))
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @ApiPropertyOptional({ type: QuantitativoSubsetorParcialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuantitativoSubsetorParcialDto)
  plantao24h?: QuantitativoSubsetorParcialDto;
}

export class CreateSetorDto {
  @ApiProperty({ example: 'Emergência' })
  @Transform(({ value }) => normalizarEspacos(value))
  @IsString()
  @Length(2, 80, { message: 'O nome deve ter entre 2 e 80 caracteres' })
  nome: string;

  @ApiPropertyOptional({ example: 'Atendimento imediato e classificação de risco' })
  @IsOptional()
  @Transform(({ value }) => normalizarEspacos(value))
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @ApiProperty({ type: QuantitativoDto, description: 'Mínimo simultâneo por plantão de 24 horas.' })
  @IsDefined({ message: 'plantao24h é obrigatório' })
  @ValidateNested()
  @Type(() => QuantitativoDto)
  plantao24h: QuantitativoDto;

  @ApiPropertyOptional({
    type: [CreateSubsetorDto],
    description: 'Se informado (ao menos um), o setor passa a ter subsetores: os técnicos são dimensionados por subsetor.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSubsetorDto)
  subsetores?: CreateSubsetorDto[];
}

class QuantitativoParcialDto extends PartialType(QuantitativoDto) {}

/** Novo mínimo de técnicos de um subsetor já cadastrado do setor (usado na edição dos mínimos em uma só operação). */
export class MinimoSubsetorDto {
  @ApiProperty({ description: 'Id de um subsetor do próprio setor.' })
  @IsMongoId({ message: 'Subsetor inválido' })
  id: string;

  @ApiProperty({ type: QuantitativoSubsetorDto })
  @IsDefined({ message: 'plantao24h é obrigatório' })
  @ValidateNested()
  @Type(() => QuantitativoSubsetorDto)
  plantao24h: QuantitativoSubsetorDto;
}

/** Edição parcial do quantitativo por plantão de 24 horas. */
export class UpdateSetorDto {
  @ApiPropertyOptional({ example: 'Emergência' })
  @IsOptional()
  @Transform(({ value }) => normalizarEspacos(value))
  @IsString()
  @Length(2, 80, { message: 'O nome deve ter entre 2 e 80 caracteres' })
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizarEspacos(value))
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @ApiPropertyOptional({ type: QuantitativoParcialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuantitativoParcialDto)
  plantao24h?: QuantitativoParcialDto;

  @ApiPropertyOptional({
    type: [MinimoSubsetorDto],
    description: 'Novos mínimos de técnicos por subsetor, aplicados junto com o resto da edição (tudo ou nada).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MinimoSubsetorDto)
  subsetores?: MinimoSubsetorDto[];
}

export class ListSetoresQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  busca?: string;

  @ApiPropertyOptional({ description: 'Filtra por setores ativos (true) ou inativos (false). Se omitido, retorna todos.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'ativo deve ser true ou false' })
  ativo?: boolean;
}

export class QuantitativoRespostaDto {
  @ApiProperty() enfermeiros: number;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Mínimo próprio de técnicos. Nulo em setor com subsetores (o mínimo é de cada subsetor).',
  })
  tecnicos: number | null;
}

export class SubsetorResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() setorId: string;
  @ApiProperty() nome: string;
  @ApiPropertyOptional() descricao?: string;
  @ApiProperty() ativo: boolean;
  @ApiProperty({ type: QuantitativoSubsetorDto }) plantao24h: QuantitativoSubsetorDto;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class SetorResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() nome: string;
  @ApiPropertyOptional() descricao?: string;
  @ApiProperty() ativo: boolean;
  @ApiProperty() possuiSubsetores: boolean;
  @ApiProperty({ type: QuantitativoRespostaDto }) plantao24h: QuantitativoRespostaDto;
  @ApiProperty({ type: [SubsetorResponseDto], description: 'Subsetores (ativos e inativos), por nome.' }) subsetores: SubsetorResponseDto[];
  @ApiProperty({ description: 'Técnicos vinculados ao setor sem subsetor (pendência de adequação em setor com subsetores).' })
  tecnicosSemSubsetor: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
