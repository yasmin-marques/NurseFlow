import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators';
import type { Perfil } from '../enums/perfil.enum';
import type { RequestAutenticada } from '../auth/usuario-autenticado';

/** Guard global executado após o JwtAuthGuard: aplica @Perfis() quando presente. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const perfis = this.reflector.getAllAndOverride<Perfil[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!perfis || perfis.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<RequestAutenticada>();
    if (!user || !perfis.includes(user.perfil)) {
      throw new ForbiddenException('Seu perfil não tem permissão para esta operação.');
    }
    return true;
  }
}
