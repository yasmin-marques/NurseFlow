import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Perfil } from '../common/enums/perfil.enum';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

function contexto(authorization?: string) {
  const request: { headers: { authorization?: string }; user?: object } = {
    headers: { authorization },
  };
  const executionContext = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { executionContext, request };
}

describe('JwtAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const authService = { validarToken: jest.fn() };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(reflector as unknown as Reflector, authService as unknown as AuthService);
  });

  it('libera rotas públicas sem validar token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { executionContext } = contexto();

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(authService.validarToken).not.toHaveBeenCalled();
  });

  it.each([undefined, 'Basic token', 'Bearer'])('rejeita cabeçalho de autorização inválido (%s)', async (authorization) => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { executionContext } = contexto(authorization);

    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.validarToken).not.toHaveBeenCalled();
  });

  it('valida o token Bearer e anexa o usuário à requisição', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const usuario = { id: 'usuario-1', nome: 'Ana', email: 'ana@example.test', perfil: Perfil.COORDENACAO };
    authService.validarToken.mockResolvedValue(usuario);
    const { executionContext, request } = contexto('Bearer token-valido');

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(authService.validarToken).toHaveBeenCalledWith('token-valido');
    expect(request.user).toEqual(usuario);
  });

  it('propaga a falha ao validar um token', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const erro = new UnauthorizedException('Token inválido ou expirado.');
    authService.validarToken.mockRejectedValue(erro);
    const { executionContext } = contexto('Bearer token-invalido');

    await expect(guard.canActivate(executionContext)).rejects.toBe(erro);
  });
});
