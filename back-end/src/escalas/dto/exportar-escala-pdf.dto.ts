import { IsBooleanString, IsMongoId, IsOptional } from 'class-validator';

export class ExportarEscalaPdfDto {
  @IsOptional()
  @IsMongoId()
  setorId?: string;

  @IsOptional()
  @IsBooleanString()
  separarPorSetor?: string;
}
