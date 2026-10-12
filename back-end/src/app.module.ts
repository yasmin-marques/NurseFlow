import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { RolesGuard } from './common/guards/roles.guard';
import configuration, { type AppConfig, validateEnv } from './config/configuration';
import { ProfissionaisModule } from './profissionais/profissionais.module';
import { SetoresModule } from './setores/setores.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        uri: config.get('mongodbUri', { infer: true }),
        // Índices e validators são geridos pelas migrations (npm run migrate:up).
        autoIndex: false,
        autoCreate: false,
      }),
    }),
    UsuariosModule,
    AuthModule,
    ProfissionaisModule,
    SetoresModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // A ordem importa: autentica primeiro, depois autoriza por perfil.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
