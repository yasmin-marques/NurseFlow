import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ExtraOpcao } from '../extras.schema';

export class CriarExtraHttpDto {
  @ApiProperty({ example: '2027-03-25', description: 'Data civil no formato AAAA-MM-DD' })
  @IsNotEmpty({ message: 'Data é obrigatória.' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data deve estar no formato AAAA-MM-DD.' })
  data: string;

  @ApiProperty({ enum: ExtraOpcao, example: ExtraOpcao.DOZE_DIA })
  @IsNotEmpty({ message: 'Opção de jornada é obrigatória.' })
  @IsEnum(ExtraOpcao, { message: 'Opção de jornada inválida.' })
  opcao: ExtraOpcao;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty({ message: 'Setor é obrigatório.' })
  @IsString()
  setorId: string;

  @ApiProperty({ enum: ['enfermeiro', 'tecnico'], example: 'enfermeiro' })
  @IsNotEmpty({ message: 'Função é obrigatória.' })
  @IsIn(['enfermeiro', 'tecnico'], { message: 'Função inválida. Deve ser enfermeiro ou tecnico.' })
  funcao: 'enfermeiro' | 'tecnico';

  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  @IsNotEmpty({ message: 'Substituto é obrigatório.' })
  @IsString()
  substitutoId: string;

  @ApiProperty({ example: 'reforco' })
  @IsNotEmpty({ message: 'Motivo é obrigatório.' })
  @IsString()
  motivo: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439013' })
  @IsOptional()
  @IsString()
  cobertoId?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439014' })
  @IsOptional()
  @IsString()
  restricaoId?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'Reforço para feriado' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

