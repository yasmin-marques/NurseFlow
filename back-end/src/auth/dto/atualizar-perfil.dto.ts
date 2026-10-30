import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional } from 'class-validator';

export class AtualizarPerfilDto {
  @ApiPropertyOptional({ example: 'ana.souza@nurseflow.com' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;

  @ApiPropertyOptional({ description: 'Receber notificações de publicação de escala.' })
  @IsOptional()
  @IsBoolean()
  recebeNotificacoesEscala?: boolean;
}
