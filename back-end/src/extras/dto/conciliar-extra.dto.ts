import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class ConciliarExtraHttpDto {
  @ApiPropertyOptional({
    description: 'ID da escala editável para conciliação (se omitido, o sistema busca a escala da competência da data do extra)',
    format: 'objectId',
  })
  @IsOptional()
  @IsMongoId()
  escalaId?: string;
}

