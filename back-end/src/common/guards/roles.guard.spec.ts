import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Perfil } from '../enums/perfil.enum';
import { RolesGuard } from './roles.guard';

function contexto(perfilUsuario: Perfil | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: perfilUsuario ? { perfil: perfilUsuario } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('libera quando a rota não exige perfil', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contexto(Perfil.TECNICO))).toBe(true);
  });

  it('libera quando o perfil do usuário é permitido', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Perfil.COORDENACAO]);
    expect(guard.canActivate(contexto(Perfil.COORDENACAO))).toBe(true);
  });

  it('bloqueia perfil não permitido', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Perfil.COORDENACAO]);
    expect(() => guard.canActivate(contexto(Perfil.ENFERMEIRO))).toThrow(ForbiddenException);
  });
});
