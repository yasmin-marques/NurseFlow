import { validateEnv } from './configuration';

const ambienteValido = {
  MONGODB_URI: 'mongodb://localhost:27017/nurseflow',
  JWT_SECRET: 'segredo-com-pelo-menos-16-caracteres',
};

describe('validateEnv', () => {
  it('aceita as variáveis obrigatórias e deixa as opcionais usarem seus padrões', () => {
    const env = { ...ambienteValido };

    expect(validateEnv(env)).toBe(env);
  });

  it.each([
    [{ JWT_SECRET: ambienteValido.JWT_SECRET }, 'MONGODB_URI'],
    [{ MONGODB_URI: ambienteValido.MONGODB_URI }, 'JWT_SECRET'],
    [{ ...ambienteValido, MONGODB_URI: '' }, 'MONGODB_URI'],
    [{ ...ambienteValido, JWT_SECRET: 'curta' }, 'JWT_SECRET'],
  ])('rejeita configuração obrigatória inválida: %s', (env, nomeVariavel) => {
    expect(() => validateEnv(env)).toThrow(nomeVariavel);
  });

  it.each([
    'PORT',
    'JWT_EXPIRES_IN_SECONDS',
    'LOGIN_MAX_ATTEMPTS',
    'LOGIN_LOCK_MINUTES',
    'PASSWORD_RESET_TTL_MINUTES',
    'OPTIMIZER_TIMEOUT_MS',
    'OPTIMIZER_TIME_LIMIT_SECONDS',
  ])('rejeita valor não positivo ou não inteiro em %s', (nomeVariavel) => {
    for (const valor of ['0', '-1', '1.5', 'inválido']) {
      expect(() => validateEnv({ ...ambienteValido, [nomeVariavel]: valor })).toThrow(nomeVariavel);
    }
  });
});
