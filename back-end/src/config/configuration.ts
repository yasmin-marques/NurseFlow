export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  mongodbUri: string;
  jwt: { secret: string; expiresInSeconds: number };
  login: { maxAttempts: number; lockMinutes: number };
  passwordResetTtlMinutes: number;
  otimizador: { url: string; timeoutMs: number; tempoLimiteSegundos: number };
}

type Env = Record<string, unknown>;

function toInt(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Variável de ambiente ${name} deve ser um inteiro positivo.`);
  }
  return parsed;
}

/** Valida as variáveis de ambiente na inicialização (falha rápida em caso de configuração inválida). */
export function validateEnv(env: Env): Env {
  if (typeof env.MONGODB_URI !== 'string' || env.MONGODB_URI === '') {
    throw new Error('Variável de ambiente MONGODB_URI é obrigatória.');
  }
  if (typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 16) {
    throw new Error('Variável de ambiente JWT_SECRET é obrigatória e deve ter ao menos 16 caracteres.');
  }
  toInt(env.PORT, 3000, 'PORT');
  toInt(env.JWT_EXPIRES_IN_SECONDS, 28800, 'JWT_EXPIRES_IN_SECONDS');
  toInt(env.LOGIN_MAX_ATTEMPTS, 5, 'LOGIN_MAX_ATTEMPTS');
  toInt(env.LOGIN_LOCK_MINUTES, 15, 'LOGIN_LOCK_MINUTES');
  toInt(env.PASSWORD_RESET_TTL_MINUTES, 30, 'PASSWORD_RESET_TTL_MINUTES');
  toInt(env.OPTIMIZER_TIMEOUT_MS, 120000, 'OPTIMIZER_TIMEOUT_MS');
  toInt(env.OPTIMIZER_TIME_LIMIT_SECONDS, 30, 'OPTIMIZER_TIME_LIMIT_SECONDS');
  return env;
}

export default (): AppConfig => {
  const env = process.env;
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: toInt(env.PORT, 3000, 'PORT'),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    mongodbUri: env.MONGODB_URI as string,
    jwt: {
      secret: env.JWT_SECRET as string,
      expiresInSeconds: toInt(env.JWT_EXPIRES_IN_SECONDS, 28800, 'JWT_EXPIRES_IN_SECONDS'),
    },
    login: {
      maxAttempts: toInt(env.LOGIN_MAX_ATTEMPTS, 5, 'LOGIN_MAX_ATTEMPTS'),
      lockMinutes: toInt(env.LOGIN_LOCK_MINUTES, 15, 'LOGIN_LOCK_MINUTES'),
    },
    passwordResetTtlMinutes: toInt(env.PASSWORD_RESET_TTL_MINUTES, 30, 'PASSWORD_RESET_TTL_MINUTES'),
    otimizador: {
      url: env.OPTIMIZER_URL || 'http://localhost:8000',
      timeoutMs: toInt(env.OPTIMIZER_TIMEOUT_MS, 120000, 'OPTIMIZER_TIMEOUT_MS'),
      tempoLimiteSegundos: toInt(env.OPTIMIZER_TIME_LIMIT_SECONDS, 30, 'OPTIMIZER_TIME_LIMIT_SECONDS'),
    },
  };
};
