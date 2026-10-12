import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Configuração compartilhada entre a aplicação real e os testes e2e. */
export function configurarApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}

export function configurarSwagger(app: INestApplication): void {
  const documento = new DocumentBuilder()
    .setTitle('NurseFlow API')
    .setDescription('Autenticação, Profissionais, Setores, Configurações e Restrições.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, documento), {
    swaggerOptions: { persistAuthorization: true },
  });
}
