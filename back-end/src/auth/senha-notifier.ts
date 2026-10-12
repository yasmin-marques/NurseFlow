import { Injectable, Logger } from '@nestjs/common';

/**
 * Canal de entrega do token de redefinição de senha.
 * Esta etapa não inclui envio de e-mail: a implementação padrão apenas registra o token em log
 * (fora de produção). Para integrar um provedor de e-mail, forneça outra implementação deste token.
 */
export abstract class SenhaNotifier {
  abstract enviarTokenRedefinicao(email: string, token: string, expiraEm: Date): Promise<void>;
}

@Injectable()
export class LogSenhaNotifier extends SenhaNotifier {
  private readonly logger = new Logger(LogSenhaNotifier.name);

  enviarTokenRedefinicao(email: string, token: string, expiraEm: Date): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(`Redefinição de senha solicitada para ${email}, mas nenhum canal de envio está configurado.`);
    } else {
      this.logger.log(`[DEV] Token de redefinição para ${email} (expira em ${expiraEm.toISOString()}): ${token}`);
    }
    return Promise.resolve();
  }
}
