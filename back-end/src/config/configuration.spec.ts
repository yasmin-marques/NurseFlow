import configuration, { validateEnv } from './configuration';

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
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
    'RATE_LIMIT_IP_MAX_REQUESTS',
    'OPTIMIZER_TIMEOUT_MS',
    'OPTIMIZER_TIME_LIMIT_SECONDS',
  ])('rejeita valor não positivo ou não inteiro em %s', (nomeVariavel) => {
    for (const valor of ['0', '-1', '1.5', 'inválido']) {
      expect(() => validateEnv({ ...ambienteValido, [nomeVariavel]: valor })).toThrow(nomeVariavel);
    }
  });

  describe('Google Agenda', () => {
    const chave = Buffer.alloc(32, 7).toString('base64');
    const google = {
      GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'segredo',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/integracoes/google-agenda/callback',
      GOOGLE_TOKEN_ENCRYPTION_KEY: chave,
    };

    it('é opcional: sem variáveis a integração fica não configurada', () => {
      expect(() => validateEnv({ ...ambienteValido })).not.toThrow();
      expect(configuration().googleAgenda.configurada).toBe(false);
    });

    it('aceita a configuração completa', () => {
      expect(() => validateEnv({ ...ambienteValido, ...google })).not.toThrow();
    });

    it('rejeita configuração parcial e chave de criptografia inválida', () => {
      expect(() => validateEnv({ ...ambienteValido, GOOGLE_CLIENT_ID: 'id' })).toThrow('GOOGLE_CLIENT_SECRET');
      expect(() => validateEnv({ ...ambienteValido, ...google, GOOGLE_TOKEN_ENCRYPTION_KEY: 'curta' })).toThrow('GOOGLE_TOKEN_ENCRYPTION_KEY');
    });
  });
});
