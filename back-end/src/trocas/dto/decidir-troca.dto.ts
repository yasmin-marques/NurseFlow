import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class RevisaoTrocaDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) revisaoEsperada: number;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') operacaoId: string;
}

export class AprovarTrocaDto extends RevisaoTrocaDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() excecaoLimite?: boolean;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) justificativa?: string;
}

export class RecusarTrocaDto extends RevisaoTrocaDto {
  @ApiProperty({ minLength: 1, maxLength: 500 }) @IsString() @MaxLength(500) justificativa: string;
}
