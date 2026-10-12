import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configurarApp, configurarSwagger } from './app.setup';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  app.enableCors({ origin: config.get('corsOrigins', { infer: true }) });
  configurarApp(app);
  configurarSwagger(app);

  const port = config.get('port', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`API em http://localhost:${port} — Swagger em http://localhost:${port}/docs`);
}

void bootstrap();
