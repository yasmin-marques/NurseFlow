import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ExtraOpcao } from '../extras.schema';

export class AtualizarExtraHttpDto {
  @ApiProperty({ minimum: 1, example: 1, description: 'Revisão esperada do documento para controle de concorrência' })
  @IsNotEmpty({ message: 'Revisão esperada é obrigatória.' })
  @IsInt({ message: 'Revisão esperada deve ser um número inteiro.' })
  @Min(1, { message: 'Revisão esperada deve ser no mínimo 1.' })
  revisaoEsperada: number;

  @ApiPropertyOptional({ example: '2027-03-26' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data deve estar no formato AAAA-MM-DD.' })
  data?: string;

  @ApiPropertyOptional({ enum: ExtraOpcao })
  @IsOptional()
  @IsEnum(ExtraOpcao, { message: 'Opção de jornada inválida.' })
  opcao?: ExtraOpcao;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  setorId?: string;

  @ApiPropertyOptional({ enum: ['enfermeiro', 'tecnico'] })
  @IsOptional()
  @IsIn(['enfermeiro', 'tecnico'], { message: 'Função inválida. Deve ser enfermeiro ou tecnico.' })
  funcao?: 'enfermeiro' | 'tecnico';

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsString()
  substitutoId?: string;

  @ApiPropertyOptional({ example: 'reforco' })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439013' })
  @IsOptional()
  @IsString()
  cobertoId?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439014' })
  @IsOptional()
  @IsString()
  restricaoId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

