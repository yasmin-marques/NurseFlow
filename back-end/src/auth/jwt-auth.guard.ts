import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators';
import type { RequestAutenticada } from '../common/auth/usuario-autenticado';
import { AuthService } from './auth.service';

/** Guard global: exige `Authorization: Bearer <jwt>` em toda rota não marcada com @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (publica) return true;

    const request = context.switchToHttp().getRequest<RequestAutenticada>();
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Token de acesso ausente.');

    request.user = await this.authService.validarToken(token);
    return true;
  }
}
