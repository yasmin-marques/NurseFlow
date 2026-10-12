import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ErroResposta {
  statusCode: number;
  error: string;
  message: string;
  /** Lista de problemas (ex.: erros de validação por campo). */
  details?: string[];
  path: string;
  timestamp: string;
  /** Dados adicionais do erro (ex.: `plantoes` que impedem a desativação). */
  [extra: string]: unknown;
}

const MONGO_DUPLICATE_KEY = 11000;

function isMongoDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === MONGO_DUPLICATE_KEY;
}

/** Formato único de erro para toda a API. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { statusCode, message, details, extras } = this.normalizar(exception);
    if (statusCode >= 500) {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    const body: ErroResposta = {
      ...extras,
      statusCode,
      error: HttpStatus[statusCode]?.replace(/_/g, ' ').toLowerCase() ?? 'error',
      message,
      ...(details ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }

  private normalizar(exception: unknown): {
    statusCode: number;
    message: string;
    details?: string[];
    extras?: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const resposta = exception.getResponse();
      if (typeof resposta === 'string') return { statusCode, message: resposta };

      const { message, ...extras } = resposta as { message?: string | string[]; [chave: string]: unknown };
      if (Array.isArray(message)) return { statusCode, message: 'Dados inválidos.', details: message };
      const { error: _error, statusCode: _status, ...resto } = extras;
      return { statusCode, message: message ?? exception.message, extras: resto };
    }
    if (isMongoDuplicateKey(exception)) {
      return { statusCode: HttpStatus.CONFLICT, message: 'Registro já cadastrado.' };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Erro interno do servidor.' };
  }
}
