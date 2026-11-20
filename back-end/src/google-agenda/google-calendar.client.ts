import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import type { EventoGoogle } from './plantao-evento';

/** Escopo mínimo para criar/atualizar/remover eventos; não dá acesso às configurações de agendas nem a contatos. */
export const ESCOPO_GOOGLE_EVENTOS = 'https://www.googleapis.com/auth/calendar.events';

/** O refresh token foi revogado/expirou ou a permissão foi retirada: o profissional precisa reconectar. */
export class GoogleReconexaoNecessariaError extends Error {
  constructor(detalhe = 'Autorização do Google Agenda expirada ou revogada.') {
    super(detalhe);
    this.name = 'GoogleReconexaoNecessariaError';
  }
}

/** Falha possivelmente passageira (rede, 429, 5xx): vale tentar de novo. */
export class GoogleTemporarioError extends Error {
  constructor(detalhe: string) {
    super(detalhe);
    this.name = 'GoogleTemporarioError';
  }
}

/** Falha que o Google rejeitou explicitamente (4xx não recuperável). */
export class GoogleRejeicaoError extends Error {
  constructor(detalhe: string) {
    super(detalhe);
    this.name = 'GoogleRejeicaoError';
  }
}

export interface TrocaDeCodigo {
  refreshToken: string | null;
  escopo: string;
}

/**
 * Porta para a API do Google. A implementação HTTP é injetada em produção; os testes substituem por um mock,
 * então nenhuma chamada real é feita na suíte automatizada.
 */
export abstract class GoogleCalendarClient {
  abstract urlAutorizacao(state: string): string;
  abstract trocarCodigo(codigo: string): Promise<TrocaDeCodigo>;
  abstract renovarAcesso(refreshToken: string): Promise<string>;
  abstract revogar(token: string): Promise<void>;
  /** Cria ou atualiza o evento de id fixo; devolve o que de fato aconteceu após a confirmação do Google. */
  abstract gravarEvento(accessToken: string, calendarId: string, eventId: string, evento: EventoGoogle): Promise<'criado' | 'atualizado'>;
  /** Remove o evento; "já não existe" (404/410) é sucesso. */
  abstract removerEvento(accessToken: string, calendarId: string, eventId: string): Promise<void>;
}

const URL_AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_REVOGACAO = 'https://oauth2.googleapis.com/revoke';
const URL_CALENDARIO = 'https://www.googleapis.com/calendar/v3/calendars';
const TIMEOUT_MS = 15_000;
const MOTIVOS_LIMITE = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded', 'backendError']);
const MOTIVOS_AUTORIZACAO = new Set(['insufficientPermissions', 'authError', 'forbiddenForNonOrganizer']);

interface RespostaGoogle {
  status: number;
  corpo: Record<string, unknown> | null;
}

@Injectable()
export class HttpGoogleCalendarClient extends GoogleCalendarClient {
  constructor(private readonly config: ConfigService<AppConfig, true>) {
    super();
  }

  private get credenciais() {
    return this.config.get('googleAgenda', { infer: true });
  }

  urlAutorizacao(state: string): string {
    const { clientId, redirectUri } = this.credenciais;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: ESCOPO_GOOGLE_EVENTOS,
      // offline + consent garantem um refresh token para sincronizar sem o usuário presente.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'false',
      state,
    });
    return `${URL_AUTORIZACAO}?${params.toString()}`;
  }

  async trocarCodigo(codigo: string): Promise<TrocaDeCodigo> {
    const { clientId, clientSecret, redirectUri } = this.credenciais;
    const resposta = await this.chamar(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: codigo, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    if (resposta.status !== 200) throw this.erroOAuth(resposta);
    return {
      refreshToken: typeof resposta.corpo?.refresh_token === 'string' ? resposta.corpo.refresh_token : null,
      escopo: typeof resposta.corpo?.scope === 'string' ? resposta.corpo.scope : '',
    };
  }

  async renovarAcesso(refreshToken: string): Promise<string> {
    const { clientId, clientSecret } = this.credenciais;
    const resposta = await this.chamar(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    });
    if (resposta.status !== 200 || typeof resposta.corpo?.access_token !== 'string') throw this.erroOAuth(resposta);
    return resposta.corpo.access_token;
  }

  async revogar(token: string): Promise<void> {
    await this.chamar(URL_REVOGACAO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  }

  async gravarEvento(accessToken: string, calendarId: string, eventId: string, evento: EventoGoogle): Promise<'criado' | 'atualizado'> {
    const colecao = `${URL_CALENDARIO}/${encodeURIComponent(calendarId)}/events`;
    const atualizar = () => this.chamarApi(`${colecao}/${encodeURIComponent(eventId)}`, accessToken, 'PUT', { ...evento, id: eventId });
    let resposta = await atualizar();
    if (resposta.status === 200) return 'atualizado';
    if (resposta.status === 404) {
      resposta = await this.chamarApi(colecao, accessToken, 'POST', { ...evento, id: eventId });
      if (resposta.status === 200) return 'criado';
      // Outra execução inseriu o mesmo id entre o PUT e o POST: o id fixo evita a duplicata, basta atualizar.
      if (resposta.status === 409) {
        const segunda = await atualizar();
        if (segunda.status === 200) return 'atualizado';
        throw this.erroApi(segunda);
      }
    }
    throw this.erroApi(resposta);
  }

  async removerEvento(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    const resposta = await this.chamarApi(
      `${URL_CALENDARIO}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      accessToken,
      'DELETE',
    );
    if (resposta.status === 204 || resposta.status === 200 || resposta.status === 404 || resposta.status === 410) return;
    throw this.erroApi(resposta);
  }

  private chamarApi(url: string, accessToken: string, method: string, corpo?: unknown): Promise<RespostaGoogle> {
    return this.chamar(url, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
  }

  private async chamar(url: string, init: RequestInit): Promise<RespostaGoogle> {
    try {
      const resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const texto = await resposta.text();
      let corpo: Record<string, unknown> | null = null;
      try {
        corpo = texto ? (JSON.parse(texto) as Record<string, unknown>) : null;
      } catch {
        corpo = null;
      }
      return { status: resposta.status, corpo };
    } catch (erro) {
      // Mensagem genérica: a URL/corpo podem conter códigos e tokens.
      throw new GoogleTemporarioError(`Falha de rede ao acessar o Google (${erro instanceof Error ? erro.name : 'erro'}).`);
    }
  }

  private erroOAuth(resposta: RespostaGoogle): Error {
    const codigo = typeof resposta.corpo?.error === 'string' ? resposta.corpo.error : '';
    if (codigo === 'invalid_grant') return new GoogleReconexaoNecessariaError();
    if (resposta.status >= 500 || resposta.status === 429) return new GoogleTemporarioError(`O Google recusou temporariamente a autorização (HTTP ${resposta.status}).`);
    return new GoogleRejeicaoError(`O Google recusou a autorização (${codigo || `HTTP ${resposta.status}`}).`);
  }

  private erroApi(resposta: RespostaGoogle): Error {
    const erro = resposta.corpo?.error as { errors?: { reason?: string }[]; message?: string } | undefined;
    const motivo = erro?.errors?.[0]?.reason ?? '';
    if (resposta.status === 401 || MOTIVOS_AUTORIZACAO.has(motivo)) return new GoogleReconexaoNecessariaError();
    if (resposta.status === 429 || resposta.status >= 500 || MOTIVOS_LIMITE.has(motivo)) {
      return new GoogleTemporarioError(`O Google Agenda está indisponível ou limitou as requisições (HTTP ${resposta.status}).`);
    }
    return new GoogleRejeicaoError(`O Google Agenda rejeitou a operação (HTTP ${resposta.status}${motivo ? `, ${motivo}` : ''}).`);
  }
}
