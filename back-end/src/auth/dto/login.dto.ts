import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Perfil } from '../../common/enums/perfil.enum';
import { semAcentos } from '../../common/utils/text';

export class LoginDto {
  @ApiProperty({ example: 'coordenacao@exemplo.com' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({ example: 'minha-senha-forte' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha' })
  @MaxLength(72)
  senha: string;

  @ApiPropertyOptional({
    enum: Perfil,
    description: 'Perfil escolhido na tela de login. Aceita também as grafias do front ("coordenação", "técnico"). Se omitido, é inferido da conta.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? semAcentos(value).trim().toLowerCase() : value))
  @IsEnum(Perfil, { message: 'Perfil inválido' })
  perfil?: Perfil;
}
