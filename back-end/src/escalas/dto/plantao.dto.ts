import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsMongoId, IsOptional, Matches, Min, ValidateNested } from 'class-validator';
import { Formacao } from '../../profissionais/profissionais.enums';
import { OrigemCobertura, TipoPlantao } from '../schemas';

export const OPCOES_PLANTAO = ['24h', '12d', '12n'] as const;
export type OpcaoPlantaoManual = (typeof OPCOES_PLANTAO)[number];

export class ProfissionalPlantaoDto {
  @ApiProperty({ format: 'objectId' })
  @IsMongoId()
  profissionalId: string;

  @ApiProperty({ enum: Formacao })
  @IsEnum(Formacao)
  funcao: Formacao;

  @ApiPropertyOptional({ default: false, description: 'Indica o enfermeiro responsável por este plantão.' })
  @IsOptional() @IsBoolean()
  lideranca?: boolean;

  @ApiPropertyOptional({ enum: OrigemCobertura, default: OrigemCobertura.REGULAR })
  @IsOptional() @IsEnum(OrigemCobertura)
  origemCobertura?: OrigemCobertura;
}

export class PlantaoDto {
  @ApiProperty({ minimum: 1, description: 'Revisão atualmente exibida pelo cliente.' })
  @Type(() => Number) @IsInt() @Min(1)
  revisaoEsperada: number;

  @ApiProperty({ format: 'objectId' })
  @IsMongoId()
  setorId: string;

  @ApiProperty({ example: '2026-10-01', format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  data: string;

  @ApiProperty({ enum: OPCOES_PLANTAO })
  @IsIn(OPCOES_PLANTAO)
  opcao: OpcaoPlantaoManual;

  @ApiProperty({ enum: TipoPlantao })
  @IsEnum(TipoPlantao)
  tipo: TipoPlantao;

  @ApiProperty({ type: [ProfissionalPlantaoDto], minItems: 1 })
  @IsArray() @ArrayMinSize(1) @ArrayUnique((item: ProfissionalPlantaoDto) => item.profissionalId)
  @ValidateNested({ each: true }) @Type(() => ProfissionalPlantaoDto)
  equipe: ProfissionalPlantaoDto[];
}

export class PlantaoAlteracaoDto extends OmitType(PlantaoDto, ['revisaoEsperada'] as const) {
  @ApiPropertyOptional({ format: 'objectId', description: 'Identificador do plantão existente; omitido para incluir um novo.' })
  @IsOptional() @IsMongoId()
  plantaoId?: string;
}

export class LotePlantoesDto {
  @ApiProperty({ minimum: 1, description: 'Revisão atualmente exibida pelo cliente.' })
  @Type(() => Number) @IsInt() @Min(1)
  revisaoEsperada: number;

  @ApiProperty({ type: [PlantaoAlteracaoDto], minItems: 1 })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => PlantaoAlteracaoDto)
  alteracoes: PlantaoAlteracaoDto[];
}
