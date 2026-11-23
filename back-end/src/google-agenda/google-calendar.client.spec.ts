import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import {
  ESCOPO_GOOGLE_EVENTOS,
  GoogleReconexaoNecessariaError,
  GoogleRejeicaoError,
  GoogleTemporarioError,
  HttpGoogleCalendarClient,
} from './google-calendar.client';
import { montarEvento } from './plantao-evento';

const config = {
  get: () => ({ clientId: 'cliente-id', clientSecret: 'cliente-segredo', redirectUri: 'http://localhost:3000/integracoes/google-agenda/callback' }),
} as unknown as ConfigService<AppConfig, true>;

const evento = montarEvento({
  profissionalId: 'p1', plantaoId: 'pl1', data: new Date('2026-12-05T00:00:00Z'), horarioInicio: '07:00',
  duracaoHoras: 12, setorNome: 'UTI', funcao: 'enfermeiro', lideranca: false, tipo: 'regular',
}).corpo;

const resposta = (status: number, corpo?: unknown) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });

describe('HttpGoogleCalendarClient', () => {
  let fetchMock: jest.Mock<typeof fetch>;
  const cliente = new HttpGoogleCalendarClient(config);
  const metodos = () => fetchMock.mock.calls.map(([, init]) => init?.method);

  beforeEach(() => {
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('monta a URL de consentimento com acesso offline, escopo mínimo e state', () => {
    const url = new URL(cliente.urlAutorizacao('estado-123'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe(ESCOPO_GOOGLE_EVENTOS);
    expect(url.searchParams.get('state')).toBe('estado-123');
    expect(url.searchParams.get('client_id')).toBe('cliente-id');
    expect(url.searchParams.get('redirect_uri')).toContain('/integracoes/google-agenda/callback');
  });

  it('atualiza um evento existente (PUT) com id fixo', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { id: 'x' }));
    await expect(cliente.gravarEvento('at', 'primary', 'nf123', evento)).resolves.toBe('atualizado');
    expect(metodos()).toEqual(['PUT']);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/calendars/primary/events/nf123');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).id).toBe('nf123');
  });

  it('cria (POST com o mesmo id) quando o evento não existe e trata 409 como atualização', async () => {
    fetchMock.mockResolvedValueOnce(resposta(404, { error: { code: 404 } })).mockResolvedValueOnce(resposta(200, {}));
    await expect(cliente.gravarEvento('at', 'primary', 'nf123', evento)).resolves.toBe('criado');
    expect(metodos()).toEqual(['PUT', 'POST']);

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(resposta(404, {}))
      .mockResolvedValueOnce(resposta(409, {}))
      .mockResolvedValueOnce(resposta(200, {}));
    await expect(cliente.gravarEvento('at', 'primary', 'nf123', evento)).resolves.toBe('atualizado');
    expect(metodos()).toEqual(['PUT', 'POST', 'PUT']);
  });

  it('classifica erros: 401/permissão => reconexão; 429/5xx/rede => temporário; demais 4xx => rejeição', async () => {
    fetchMock.mockResolvedValueOnce(resposta(401, { error: { code: 401 } }));
    await expect(cliente.gravarEvento('at', 'primary', 'id', evento)).rejects.toBeInstanceOf(GoogleReconexaoNecessariaError);
    fetchMock.mockResolvedValueOnce(resposta(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } }));
    await expect(cliente.gravarEvento('at', 'primary', 'id', evento)).rejects.toBeInstanceOf(GoogleReconexaoNecessariaError);
    fetchMock.mockResolvedValueOnce(resposta(403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }));
    await expect(cliente.gravarEvento('at', 'primary', 'id', evento)).rejects.toBeInstanceOf(GoogleTemporarioError);
    fetchMock.mockResolvedValueOnce(resposta(503, {}));
    await expect(cliente.gravarEvento('at', 'primary', 'id', evento)).rejects.toBeInstanceOf(GoogleTemporarioError);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed: https://segredo?token=abc'));
    const erro = await cliente.gravarEvento('at', 'primary', 'id', evento).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(GoogleTemporarioError);
    expect((erro as Error).message).not.toContain('abc');
    fetchMock.mockResolvedValueOnce(resposta(400, { error: { errors: [{ reason: 'invalid' }] } }));
    await expect(cliente.gravarEvento('at', 'primary', 'id', evento)).rejects.toBeInstanceOf(GoogleRejeicaoError);
  });

  it('remove o evento e trata 404/410 como já removido', async () => {
    fetchMock.mockResolvedValueOnce(resposta(204)).mockResolvedValueOnce(resposta(404, {})).mockResolvedValueOnce(resposta(410, {}));
    await cliente.removerEvento('at', 'primary', 'id');
    await cliente.removerEvento('at', 'primary', 'id');
    await cliente.removerEvento('at', 'primary', 'id');
    expect(metodos()).toEqual(['DELETE', 'DELETE', 'DELETE']);
    fetchMock.mockResolvedValueOnce(resposta(500, {}));
    await expect(cliente.removerEvento('at', 'primary', 'id')).rejects.toBeInstanceOf(GoogleTemporarioError);
  });

  it('troca o código e renova o acesso; invalid_grant exige reconexão', async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { refresh_token: 'rt', scope: ESCOPO_GOOGLE_EVENTOS, access_token: 'at' }));
    await expect(cliente.trocarCodigo('codigo')).resolves.toEqual({ refreshToken: 'rt', escopo: ESCOPO_GOOGLE_EVENTOS });
    fetchMock.mockResolvedValueOnce(resposta(200, { access_token: 'novo-at' }));
    await expect(cliente.renovarAcesso('rt')).resolves.toBe('novo-at');
    fetchMock.mockResolvedValueOnce(resposta(400, { error: 'invalid_grant' }));
    await expect(cliente.renovarAcesso('rt')).rejects.toBeInstanceOf(GoogleReconexaoNecessariaError);
    fetchMock.mockResolvedValueOnce(resposta(503, {}));
    await expect(cliente.renovarAcesso('rt')).rejects.toBeInstanceOf(GoogleTemporarioError);
  });
});
