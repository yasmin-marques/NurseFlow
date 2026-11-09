import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CancelarExtraHttpDto {
  @ApiProperty({ minimum: 1, example: 1, description: 'Revisão esperada do documento para controle de concorrência' })
  @IsNotEmpty({ message: 'Revisão esperada é obrigatória.' })
  @IsInt({ message: 'Revisão esperada deve ser um número inteiro.' })
  @Min(1, { message: 'Revisão esperada deve ser no mínimo 1.' })
  revisaoEsperada: number;

  @ApiProperty({ minLength: 1, maxLength: 500, example: 'Substituto cancelou com antecedência' })
  @IsNotEmpty({ message: 'A justificativa do cancelamento é obrigatória.' })
  @IsString({ message: 'A justificativa do cancelamento deve ser um texto.' })
  @MaxLength(500, { message: 'A justificativa deve ter no máximo 500 caracteres.' })
  justificativa: string;
}

