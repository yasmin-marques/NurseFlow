import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class HistoricoEscalasDto {
  @ApiProperty({ example: 2026, minimum: 1, maximum: 9999 })
  @Type(() => Number) @IsInt() @Min(1) @Max(9999)
  ano: number;
}
