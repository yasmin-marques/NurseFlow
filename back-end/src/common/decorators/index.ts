import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Perfil } from '../enums/perfil.enum';
import type { RequestAutenticada, UsuarioAutenticado } from '../auth/usuario-autenticado';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'perfis';

/** Libera a rota da autenticação JWT (que é global). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe a rota aos perfis informados (qualquer usuário autenticado se omitido). */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(ROLES_KEY, perfis);

export const UsuarioAtual = createParamDecorator((_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
  const request = ctx.switchToHttp().getRequest<RequestAutenticada>();
  return request.user as UsuarioAutenticado;
});
