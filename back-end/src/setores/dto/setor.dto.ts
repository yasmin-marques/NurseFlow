import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { normalizarEspacos } from '../../common/utils/text';

const LIMITE_QUANTITATIVO = 99;

export class QuantitativoDto {
  @ApiProperty({ minimum: 0, maximum: LIMITE_QUANTITATIVO, example: 2, description: 'Inclui o chefe do plantão.' })
  @IsInt({ message: 'Informe um número inteiro' })
  @Min(0)
  @Max(LIMITE_QUANTITATIVO)
  enfermeiros: number;

  @ApiProperty({ minimum: 0, maximum: LIMITE_QUANTITATIVO, example: 3 })
  @IsInt({ message: 'Informe um número inteiro' })
  @Min(0)
  @Max(LIMITE_QUANTITATIVO)
  tecnicos: number;
}

export class TurnosDto {
  @ApiProperty({ type: QuantitativoDto, description: 'Turno diurno (07h–19h).' })
  @IsDefined({ message: 'diurno é obrigatório' })
  @ValidateNested()
  @Type(() => QuantitativoDto)
  diurno: QuantitativoDto;

  @ApiProperty({ type: QuantitativoDto, description: 'Turno noturno (19h–07h).' })
  @IsDefined({ message: 'noturno é obrigatório' })
  @ValidateNested()
  @Type(() => QuantitativoDto)
  noturno: QuantitativoDto;
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

  @ApiProperty({ type: TurnosDto })
  @IsDefined({ message: 'turnos é obrigatório' })
  @ValidateNested()
  @Type(() => TurnosDto)
  turnos: TurnosDto;
}

class QuantitativoParcialDto extends PartialType(QuantitativoDto) {}

class TurnosParcialDto {
  @ApiPropertyOptional({ type: QuantitativoParcialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuantitativoParcialDto)
  diurno?: QuantitativoParcialDto;

  @ApiPropertyOptional({ type: QuantitativoParcialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuantitativoParcialDto)
  noturno?: QuantitativoParcialDto;
}

/** Edição parcial (DA08 permite alterar apenas um turno/função). */
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

  @ApiPropertyOptional({ type: TurnosParcialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TurnosParcialDto)
  turnos?: TurnosParcialDto;
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

export class SetorResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() nome: string;
  @ApiPropertyOptional() descricao?: string;
  @ApiProperty() ativo: boolean;
  @ApiProperty({ type: TurnosDto }) turnos: TurnosDto;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
