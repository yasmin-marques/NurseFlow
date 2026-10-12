import { ApiProperty } from '@nestjs/swagger';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais.enums';

export class ProfissionalResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() nome: string;
  @ApiProperty({ example: '529.982.247-25' }) cpf: string;
  @ApiProperty() email: string;
  @ApiProperty({ example: 'COREN-CE 123456' }) coren: string;
  @ApiProperty({ enum: Formacao }) formacao: Formacao;
  @ApiProperty({ enum: TipoVinculo }) tipoVinculo: TipoVinculo;
  @ApiProperty({ enum: StatusProfissional }) status: StatusProfissional;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PaginacaoMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class ProfissionalListaDto {
  @ApiProperty({ type: [ProfissionalResponseDto] }) data: ProfissionalResponseDto[];
  @ApiProperty({ type: PaginacaoMetaDto }) meta: PaginacaoMetaDto;
}
