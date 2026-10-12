import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { somenteDigitos } from '../../common/utils/cpf';
import { normalizarEspacos } from '../../common/utils/text';
import { IsCpf } from '../../common/validators/is-cpf.validator';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais.enums';

export class CreateProfissionalDto {
  @ApiProperty({ example: 'Ana Clara Souza' })
  @Transform(({ value }) => normalizarEspacos(value))
  @IsString()
  @Length(3, 120, { message: 'O nome deve ter entre 3 e 120 caracteres' })
  nome: string;

  @ApiProperty({ example: '529.982.247-25', description: 'Aceita com ou sem máscara; é armazenado apenas com dígitos.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? somenteDigitos(value) : value))
  @IsCpf()
  cpf: string;

  @ApiProperty({ example: 'COREN-CE 123456' })
  @Transform(({ value }) => (typeof value === 'string' ? (normalizarEspacos(value) as string).toUpperCase() : value))
  @IsString()
  @Length(3, 30, { message: 'O COREN deve ter entre 3 e 30 caracteres' })
  coren: string;

  @ApiProperty({ example: 'ana.souza@nurseflow.com', description: 'E-mail profissional usado no login.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({ enum: Formacao })
  @IsEnum(Formacao, { message: 'Formação inválida' })
  formacao: Formacao;

  @ApiProperty({ enum: TipoVinculo })
  @IsEnum(TipoVinculo, { message: 'Tipo de vínculo inválido' })
  tipoVinculo: TipoVinculo;

  @ApiPropertyOptional({ enum: StatusProfissional, default: StatusProfissional.ATIVO })
  @IsOptional()
  @IsEnum(StatusProfissional, { message: 'Status inválido' })
  status?: StatusProfissional;

  @ApiPropertyOptional({
    minLength: 8,
    maxLength: 72,
    description: 'Senha inicial. Se omitida, o sistema gera uma senha temporária e o profissional define a sua via recuperação de senha.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres' })
  senha?: string;
}
