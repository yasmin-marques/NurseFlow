export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  mongodbUri: string;
  rateLimit: { windowMs: number; maxRequests: number; ipMaxRequests: number };
  jwt: { secret: string; expiresInSeconds: number };
  login: { maxAttempts: number; lockMinutes: number };
  passwordResetTtlMinutes: number;
  otimizador: { url: string; timeoutMs: number; tempoLimiteSegundos: number };
  googleAgenda: {
    /** Verdadeiro somente quando todas as credenciais OAuth e a chave de criptografia estão definidas. */
    configurada: boolean;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    /** Chave AES-256 (32 bytes) usada para proteger os refresh tokens em repouso. */
    chaveCriptografia: Buffer | null;
    frontendUrl: string;
    workerAtivo: boolean;
    workerIntervaloMs: number;
  };
}

const VARIAVEIS_GOOGLE = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_TOKEN_ENCRYPTION_KEY'] as const;

/** Decodifica a chave AES-256 (base64 de 32 bytes); retorna null se ausente ou inválida. */
export function decodificarChaveCriptografia(valor: unknown): Buffer | null {
  if (typeof valor !== 'string' || valor === '') return null;
  const chave = Buffer.from(valor, 'base64');
  return chave.length === 32 ? chave : null;
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
  toInt(env.RATE_LIMIT_WINDOW_MS, 60000, 'RATE_LIMIT_WINDOW_MS');
  toInt(env.RATE_LIMIT_MAX_REQUESTS, 120, 'RATE_LIMIT_MAX_REQUESTS');
  toInt(env.RATE_LIMIT_IP_MAX_REQUESTS, 1200, 'RATE_LIMIT_IP_MAX_REQUESTS');
  toInt(env.OPTIMIZER_TIMEOUT_MS, 120000, 'OPTIMIZER_TIMEOUT_MS');
  toInt(env.OPTIMIZER_TIME_LIMIT_SECONDS, 30, 'OPTIMIZER_TIME_LIMIT_SECONDS');
  toInt(env.GOOGLE_SYNC_WORKER_INTERVAL_MS, 15000, 'GOOGLE_SYNC_WORKER_INTERVAL_MS');
  // A integração com o Google Agenda é opcional, mas a configuração parcial é um erro (falha rápida).
  // As credenciais disparam a exigência; redirect/chave sozinhos (sem credenciais) mantêm a integração desligada.
  const definidas = VARIAVEIS_GOOGLE.filter((nome) => typeof env[nome] === 'string' && env[nome] !== '');
  const comCredenciais = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].some((nome) => definidas.includes(nome));
  if (comCredenciais && definidas.length < VARIAVEIS_GOOGLE.length) {
    const faltantes = VARIAVEIS_GOOGLE.filter((nome) => !definidas.includes(nome));
    throw new Error(`Configuração do Google Agenda incompleta. Defina também: ${faltantes.join(', ')}.`);
  }
  if (comCredenciais && decodificarChaveCriptografia(env.GOOGLE_TOKEN_ENCRYPTION_KEY) === null) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY deve ser uma chave de 32 bytes codificada em base64.');
  }
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
    rateLimit: {
      windowMs: toInt(env.RATE_LIMIT_WINDOW_MS, 60000, 'RATE_LIMIT_WINDOW_MS'),
      maxRequests: toInt(env.RATE_LIMIT_MAX_REQUESTS, 120, 'RATE_LIMIT_MAX_REQUESTS'),
      ipMaxRequests: toInt(env.RATE_LIMIT_IP_MAX_REQUESTS, 1200, 'RATE_LIMIT_IP_MAX_REQUESTS'),
    },
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
    googleAgenda: {
      configurada: VARIAVEIS_GOOGLE.every((nome) => typeof env[nome] === 'string' && env[nome] !== ''),
      clientId: env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
      redirectUri: env.GOOGLE_REDIRECT_URI ?? '',
      chaveCriptografia: decodificarChaveCriptografia(env.GOOGLE_TOKEN_ENCRYPTION_KEY),
      frontendUrl: (env.FRONTEND_URL || (env.CORS_ORIGINS ?? 'http://localhost:5173').split(',')[0].trim()).replace(/\/+$/, ''),
      // O worker não roda sob Jest (NODE_ENV=test); os testes o acionam explicitamente.
      workerAtivo: env.GOOGLE_SYNC_WORKER_ENABLED ? env.GOOGLE_SYNC_WORKER_ENABLED !== 'false' : env.NODE_ENV !== 'test',
      workerIntervaloMs: toInt(env.GOOGLE_SYNC_WORKER_INTERVAL_MS, 15000, 'GOOGLE_SYNC_WORKER_INTERVAL_MS'),
    },
  };
};
