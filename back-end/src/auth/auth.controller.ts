import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { Public, UsuarioAtual } from '../common/decorators';
import { AuthService } from './auth.service';
import { LoginResponseDto, MensagemDto, PerfilUsuarioDto, UsuarioSessaoDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RecuperarSenhaDto, RedefinirSenhaDto } from './dto/recuperacao-senha.dto';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login com e-mail profissional, senha e perfil (DA01)' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'E-mail, senha ou perfil inválidos' })
  @ApiResponse({ status: 403, description: 'Profissional desativado' })
  @ApiResponse({ status: 429, description: 'Acesso temporariamente bloqueado após tentativas inválidas' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  @ApiResponse({ status: 200, type: UsuarioSessaoDto })
  me(@UsuarioAtual() usuario: UsuarioAutenticado): UsuarioSessaoDto {
    return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  }

  @Get('me/perfil')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil pessoal do usuário autenticado' })
  @ApiResponse({ status: 200, type: PerfilUsuarioDto })
  obterPerfil(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<PerfilUsuarioDto> {
    return this.authService.obterPerfil(usuario.id);
  }

  @Patch('me/perfil')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza e-mail e preferências de notificação do usuário autenticado' })
  @ApiResponse({ status: 200, type: PerfilUsuarioDto })
  @ApiResponse({ status: 409, description: 'E-mail já utilizado por outra conta' })
  atualizarPerfil(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: AtualizarPerfilDto,
  ): Promise<PerfilUsuarioDto> {
    return this.authService.atualizarPerfil(usuario.id, dto);
  }

  @Public()
  @Post('recuperar-senha')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicita a recuperação de senha (resposta idêntica para e-mails existentes ou não)' })
  @ApiResponse({ status: 202, type: MensagemDto })
  async recuperarSenha(@Body() dto: RecuperarSenhaDto): Promise<MensagemDto> {
    await this.authService.solicitarRecuperacaoSenha(dto.email);
    return { mensagem: 'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.' };
  }

  @Public()
  @Post('redefinir-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Define uma nova senha usando o token de recuperação' })
  @ApiResponse({ status: 200, type: MensagemDto })
  @ApiResponse({ status: 400, description: 'Token inválido ou expirado' })
  async redefinirSenha(@Body() dto: RedefinirSenhaDto): Promise<MensagemDto> {
    await this.authService.redefinirSenha(dto.token, dto.novaSenha);
    return { mensagem: 'Senha redefinida com sucesso.' };
  }
}
