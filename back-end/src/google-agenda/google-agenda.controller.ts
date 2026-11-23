import { Controller, ForbiddenException, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { Perfis, Public, UsuarioAtual } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { GoogleAgendaService } from './google-agenda.service';

function profissionalDe(usuario: UsuarioAutenticado): string {
  if (!usuario.profissionalId) throw new ForbiddenException('A integração está disponível apenas para profissionais da escala.');
  return usuario.profissionalId;
}

/**
 * Integração com o Google Agenda para Enfermeiro e Técnico. Nenhuma rota recebe o id do profissional:
 * a identidade vem sempre do JWT, então cada profissional só alcança a própria conexão e os próprios plantões.
 */
@ApiTags('Google Agenda')
@Controller('integracoes/google-agenda')
export class GoogleAgendaController {
  constructor(private readonly service: GoogleAgendaService) {}

  @Get()
  @Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estado da integração do profissional autenticado' })
  @ApiOkResponse({ description: 'Estado, última sincronização e pendências. Nunca inclui credenciais.' })
  @ApiForbiddenResponse({ description: 'Perfil sem acesso (ex.: Coordenação).' })
  estado(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.estado(profissionalDe(usuario));
  }

  @Post('conectar')
  @HttpCode(200)
  @Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Inicia (ou reinicia) o consentimento OAuth e devolve a URL do Google' })
  conectar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.iniciarConexao(profissionalDe(usuario));
  }

  @Post('sincronizar')
  @HttpCode(200)
  @Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sincroniza agora os plantões oficiais do profissional autenticado' })
  sincronizar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.sincronizarAgora(profissionalDe(usuario));
  }

  @Post('desativar')
  @HttpCode(200)
  @Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desativa a sincronização, preservando os eventos já exportados' })
  desativar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.service.desativar(profissionalDe(usuario));
  }

  /** Redirecionamento do Google (navegador, sem JWT). A identidade vem do `state` de uso único. */
  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Callback OAuth do Google; redireciona de volta ao frontend' })
  async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('error') error: string | undefined, @Res() res: Response) {
    const destino = await this.service.concluirConexao({ code, state, error });
    res.redirect(302, destino);
  }
}
