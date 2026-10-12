import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../config/configuration';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LogSenhaNotifier, SenhaNotifier } from './senha-notifier';

@Module({
  imports: [
    UsuariosModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwt.secret', { infer: true }),
        signOptions: { expiresIn: config.get('jwt.expiresInSeconds', { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: SenhaNotifier, useClass: LogSenhaNotifier }],
  exports: [AuthService],
})
export class AuthModule {}
