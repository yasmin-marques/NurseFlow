import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ResumoExtrasDto {
  @ApiProperty({ minimum: 1, maximum: 9999, example: 2027 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  ano: number;

  @ApiProperty({ minimum: 1, maximum: 12, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;
}

