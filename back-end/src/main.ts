import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { rateLimitKey } from './rate-limit-key';
import { AppModule } from './app.module';
import { configurarApp, configurarSwagger } from './app.setup';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  app.set('trust proxy', 1);
  app.use(helmet());
  const windowMs = config.get('rateLimit.windowMs', { infer: true });
  const message = { statusCode: 429, message: 'Limite de requisições excedido. Tente novamente mais tarde.' };
  app.use(rateLimit({
    windowMs,
    limit: config.get('rateLimit.ipMaxRequests', { infer: true }),
    standardHeaders: true,
    legacyHeaders: false,
    message,
  }));
  app.use(rateLimit({
    windowMs,
    limit: config.get('rateLimit.maxRequests', { infer: true }),
    keyGenerator: (request) => rateLimitKey(request),
    standardHeaders: true,
    legacyHeaders: false,
    message,
  }));
  app.enableCors({ origin: config.get('corsOrigins', { infer: true }) });
  configurarApp(app);
  configurarSwagger(app);

  const port = config.get('port', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`API em http://localhost:${port} — Swagger em http://localhost:${port}/docs`);
}

void bootstrap();
