import { HttpException, HttpStatus, Injectable, UnauthorizedException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { Model } from 'mongoose';
import type { AppConfig } from '../config/configuration';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import type { Perfil } from '../common/enums/perfil.enum';
import { StatusProfissional } from '../profissionais/profissionais.enums';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { LoginDto } from './dto/login.dto';
import type { LoginResponseDto } from './dto/auth-response.dto';
import type { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { SenhaNotifier } from './senha-notifier';

const BCRYPT_ROUNDS = 10;
const MENSAGEM_CREDENCIAIS_INVALIDAS = 'E-mail, senha ou perfil inválidos.';
// Hash descartável usado para manter o tempo de resposta quando o e-mail não existe.
const HASH_FALSO = bcrypt.hashSync('nurseflow-hash-falso', BCRYPT_ROUNDS);

interface JwtPayload {
  sub: string;
  perfil: Perfil;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<Usuario>,
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly notifier: SenhaNotifier,
  ) {}

  static gerarHashSenha(senha: string): Promise<string> {
    return bcrypt.hash(senha, BCRYPT_ROUNDS);
  }

  async obterPerfil(usuarioId: string) {
    const usuario = await this.usuariosService.buscarPorId(usuarioId);
    if (!usuario) throw new UnauthorizedException('Sessão inválida.');
    const resolvido = await this.usuariosService.resolverPerfil(usuario);
    if (!resolvido) throw new UnauthorizedException('Sessão inválida.');
    const profissional = await this.usuariosService.buscarProfissionalDoUsuario(usuarioId);
    const proximoSetor = profissional && resolvido.profissional
      ? await this.usuariosService.buscarProximoSetor(resolvido.profissional._id.toString())
      : null;
    return {
      id: usuario._id.toString(),
      nome: usuario.nome,
      email: usuario.email,
      perfil: resolvido.perfil,
      coren: profissional?.coren ?? null,
      formacao: profissional?.formacao ?? null,
      tipoVinculo: profissional?.tipoVinculo ?? null,
      proximoSetor,
      recebeNotificacoesEscala: usuario.recebeNotificacoesEscala ?? true,
    };
  }

  async atualizarPerfil(usuarioId: string, dto: AtualizarPerfilDto) {
    if (dto.email === undefined && dto.recebeNotificacoesEscala === undefined) {
      throw new BadRequestException('Informe ao menos um dado para atualizar.');
    }

    const usuario = await this.usuariosService.buscarPorId(usuarioId);
    if (!usuario) throw new UnauthorizedException('Sessão inválida.');

    if (dto.email !== undefined && dto.email !== usuario.email) {
      const emailEmUso = await this.usuariosService.buscarPorEmail(dto.email);
      if (emailEmUso && emailEmUso._id.toString() !== usuarioId) {
        throw new ConflictException('Este e-mail já está sendo usado por outra conta.');
      }
      usuario.email = dto.email;
    }
    if (dto.recebeNotificacoesEscala !== undefined) {
      usuario.recebeNotificacoesEscala = dto.recebeNotificacoesEscala;
    }
    await usuario.save();
    return this.obterPerfil(usuarioId);
  }

  /** DA01: valida credenciais e perfil, controla bloqueio temporário e emite o JWT. */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const usuario = await this.usuariosService.buscarPorEmail(dto.email, true);
    if (!usuario) {
      await bcrypt.compare(dto.senha, HASH_FALSO);
      throw new UnauthorizedException(MENSAGEM_CREDENCIAIS_INVALIDAS);
    }

    if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
      const minutos = Math.ceil((usuario.bloqueadoAte.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        `Acesso temporariamente bloqueado por tentativas inválidas. Tente novamente em ${minutos} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const senhaConfere = await bcrypt.compare(dto.senha, usuario.senha);
    const resolvido = senhaConfere ? await this.usuariosService.resolverPerfil(usuario) : null;
    if (!resolvido || (dto.perfil && dto.perfil !== resolvido.perfil)) {
      await this.registrarFalha(usuario._id.toString());
      throw new UnauthorizedException(MENSAGEM_CREDENCIAIS_INVALIDAS);
    }

    if (resolvido.profissional?.status === StatusProfissional.DESATIVADO) {
      throw new ForbiddenException('Profissional desativado. Procure a Coordenação.');
    }

    await this.usuarioModel.updateOne(
      { _id: usuario._id },
      { $set: { tentativasFalhasLogin: 0, bloqueadoAte: null, ultimoLoginEm: new Date() } },
    );

    const expiresIn = this.config.get('jwt.expiresInSeconds', { infer: true });
    const payload: JwtPayload = { sub: usuario._id.toString(), perfil: resolvido.perfil };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn,
      usuario: { id: usuario._id.toString(), nome: usuario.nome, email: usuario.email, perfil: resolvido.perfil },
    };
  }

  /** Valida o JWT e confirma que a conta ainda existe e não foi desativada. */
  async validarToken(token: string): Promise<UsuarioAutenticado> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    const usuario = await this.usuariosService.buscarPorId(payload.sub);
    const resolvido = usuario ? await this.usuariosService.resolverPerfil(usuario) : null;
    if (!usuario || !resolvido || resolvido.profissional?.status === StatusProfissional.DESATIVADO) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    return {
      id: usuario._id.toString(),
      nome: usuario.nome,
      email: usuario.email,
      perfil: resolvido.perfil,
      profissionalId: resolvido.profissional?._id.toString(),
    };
  }

  /** Gera um token de uso único. A resposta é sempre a mesma para não revelar quais e-mails existem. */
  async solicitarRecuperacaoSenha(email: string): Promise<void> {
    const usuario = await this.usuariosService.buscarPorEmail(email);
    if (!usuario) return;
    const resolvido = await this.usuariosService.resolverPerfil(usuario);
    if (!resolvido || resolvido.profissional?.status === StatusProfissional.DESATIVADO) return;

    const token = randomBytes(32).toString('hex');
    const ttl = this.config.get('passwordResetTtlMinutes', { infer: true });
    const expiraEm = new Date(Date.now() + ttl * 60_000);
    await this.usuarioModel.updateOne(
      { _id: usuario._id },
      { $set: { redefinicaoSenha: { tokenHash: this.hashToken(token), expiraEm } } },
    );
    await this.notifier.enviarTokenRedefinicao(usuario.email, token, expiraEm);
  }

  async redefinirSenha(token: string, novaSenha: string): Promise<void> {
    const resultado = await this.usuarioModel.updateOne(
      { 'redefinicaoSenha.tokenHash': this.hashToken(token), 'redefinicaoSenha.expiraEm': { $gt: new Date() } },
      {
        $set: {
          senha: await AuthService.gerarHashSenha(novaSenha),
          senhaTemporaria: false,
          tentativasFalhasLogin: 0,
          bloqueadoAte: null,
        },
        $unset: { redefinicaoSenha: '' },
      },
    );
    if (resultado.modifiedCount === 0) throw new BadRequestException('Token de redefinição inválido ou expirado.');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async registrarFalha(usuarioId: string): Promise<void> {
    const { maxAttempts, lockMinutes } = this.config.get('login', { infer: true });
    const atualizado = await this.usuarioModel.findOneAndUpdate(
      { _id: usuarioId },
      { $inc: { tentativasFalhasLogin: 1 } },
      { returnDocument: 'after' },
    );
    if (atualizado && atualizado.tentativasFalhasLogin >= maxAttempts) {
      await this.usuarioModel.updateOne(
        { _id: usuarioId },
        { $set: { bloqueadoAte: new Date(Date.now() + lockMinutes * 60_000), tentativasFalhasLogin: 0 } },
      );
    }
  }
}
