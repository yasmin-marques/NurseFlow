import { ApiProperty } from '@nestjs/swagger';
import { Perfil } from '../../common/enums/perfil.enum';

export class UsuarioSessaoDto {
  @ApiProperty() id: string;
  @ApiProperty() nome: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: Perfil }) perfil: Perfil;
}

export class PerfilUsuarioDto extends UsuarioSessaoDto {
  @ApiProperty({ nullable: true }) coren: string | null;
  @ApiProperty({ nullable: true }) formacao: string | null;
  @ApiProperty({ nullable: true }) tipoVinculo: string | null;
  @ApiProperty({ nullable: true }) proximoSetor: string | null;
  @ApiProperty() recebeNotificacoesEscala: boolean;
}

export class LoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ example: 'Bearer' }) tokenType: 'Bearer';
  @ApiProperty({ description: 'Validade do token em segundos.' }) expiresIn: number;
  @ApiProperty({ type: UsuarioSessaoDto }) usuario: UsuarioSessaoDto;
}

export class MensagemDto {
  @ApiProperty() mensagem: string;
}
