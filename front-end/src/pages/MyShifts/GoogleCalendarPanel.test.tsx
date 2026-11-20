// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GoogleCalendarStatus } from '../../services/googleCalendar'
import { GoogleCalendarPanel } from './GoogleCalendarPanel'

const { getGoogleCalendarStatus, startGoogleCalendarConnection, syncGoogleCalendar, disableGoogleCalendar } = vi.hoisted(() => ({
  getGoogleCalendarStatus: vi.fn(),
  startGoogleCalendarConnection: vi.fn(),
  syncGoogleCalendar: vi.fn(),
  disableGoogleCalendar: vi.fn(),
}))
vi.mock('../../services/googleCalendar', () => ({ getGoogleCalendarStatus, startGoogleCalendarConnection, syncGoogleCalendar, disableGoogleCalendar }))

const status = (overrides: Partial<GoogleCalendarStatus> = {}): GoogleCalendarStatus => ({
  configurada: true,
  estado: 'nao_conectada',
  ultimaSincronizacaoEm: null,
  pendentes: 0,
  reconexaoNecessaria: false,
  ultimoResultado: null,
  ...overrides,
})
const resultado = (overrides: Record<string, unknown> = {}) => ({
  resultado: 'sucesso', mensagem: 'Agenda sincronizada: 2 criado(s), 0 atualizado(s), 0 removido(s).', em: '2026-12-01T10:00:00Z',
  criados: 2, atualizados: 0, removidos: 0, falhas: 0, reconexaoNecessaria: false, estado: status({ estado: 'conectada' }), ...overrides,
})

describe('GoogleCalendarPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/')
  })
  afterEach(() => cleanup())

  it('offers only "Conectar Google Agenda" when not connected and redirects to the Google consent URL', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status())
    startGoogleCalendarConnection.mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc' })
    const redirect = vi.fn()
    render(<GoogleCalendarPanel redirect={redirect} />)
    const connect = await screen.findByRole('button', { name: 'Conectar Google Agenda' })
    expect(screen.getByTestId('google-calendar-state').textContent).toBe('Não conectado')
    expect(screen.queryByRole('button', { name: 'Sincronizar agora' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Desativar sincronização' })).toBeNull()
    await userEvent.setup().click(connect)
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=abc'))
  })

  it('disables connecting and explains when the integration is not configured on the server', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status({ configurada: false }))
    render(<GoogleCalendarPanel redirect={vi.fn()} />)
    expect(((await screen.findByRole('button', { name: 'Conectar Google Agenda' })) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/ainda não foi configurada neste ambiente/)).not.toBeNull()
  })

  it('shows the connected state with last sync and queue, and reports a successful manual sync', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status({ estado: 'conectada', ultimaSincronizacaoEm: '2026-12-01T10:00:00Z', pendentes: 1 }))
    syncGoogleCalendar.mockResolvedValue(resultado())
    render(<GoogleCalendarPanel redirect={vi.fn()} />)
    const sync = await screen.findByRole('button', { name: 'Sincronizar agora' })
    expect(screen.getByTestId('google-calendar-state').textContent).toMatch(/^Conectado · última sincronização em .* · 1 atualização\(ões\) na fila$/)
    expect(screen.getByRole('button', { name: 'Desativar sincronização' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Conectar Google Agenda' })).toBeNull()
    await userEvent.setup().click(sync)
    const message = await screen.findByRole('status')
    expect(message.textContent).toContain('Agenda sincronizada: 2 criado(s)')
  })

  it('does not mask partial or total failures as success', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status({ estado: 'conectada' }))
    syncGoogleCalendar
      .mockResolvedValueOnce(resultado({ resultado: 'parcial', falhas: 1, mensagem: 'Sincronização parcial: 1 operação(ões) falharam e serão tentadas novamente.' }))
      .mockResolvedValueOnce(resultado({ resultado: 'falha', falhas: 2, mensagem: 'Não foi possível sincronizar com o Google Agenda.' }))
    render(<GoogleCalendarPanel redirect={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Sincronizar agora' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Sincronização parcial')
    expect(screen.queryByRole('status')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Sincronizar agora' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Não foi possível sincronizar'))
  })

  it('shows a request error instead of success when the sync call fails', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status({ estado: 'conectada' }))
    syncGoogleCalendar.mockRejectedValue(new Error('A integração com o Google Agenda não está ativa.'))
    render(<GoogleCalendarPanel redirect={vi.fn()} />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sincronizar agora' }))
    expect((await screen.findByRole('alert')).textContent).toContain('não está ativa')
  })

  it('asks for reconnection when the authorization expired and offers Reconectar', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status({ estado: 'reconexao_necessaria', reconexaoNecessaria: true }))
    startGoogleCalendarConnection.mockResolvedValue({ url: 'https://accounts.google.com/auth' })
    const redirect = vi.fn()
    render(<GoogleCalendarPanel redirect={redirect} />)
    const reconnect = await screen.findByRole('button', { name: 'Reconectar' })
    expect(screen.getByRole('alert').textContent).toContain('expirou ou foi revogada')
    expect(screen.queryByRole('button', { name: 'Sincronizar agora' })).toBeNull()
    await userEvent.setup().click(reconnect)
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://accounts.google.com/auth'))
  })

  it('disables the synchronization and says that exported events are kept', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status({ estado: 'conectada' }))
    disableGoogleCalendar.mockResolvedValue(status({ estado: 'desativada' }))
    render(<GoogleCalendarPanel redirect={vi.fn()} />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Desativar sincronização' }))
    expect((await screen.findByRole('status')).textContent).toContain('eventos já enviados permanecem')
    expect(screen.getByTestId('google-calendar-state').textContent).toBe('Sincronização desativada')
    expect(screen.getByRole('button', { name: 'Conectar Google Agenda' })).not.toBeNull()
  })

  it.each([
    ['conectada', /Google Agenda conectado/],
    ['negada', /autorização não foi concedida/],
    ['estado_invalido', /expirou ou já foi usado/],
  ])('shows the OAuth return result "%s" and removes it from the URL', async (codigo, texto) => {
    window.history.replaceState(null, '', `/?google_agenda=${codigo}`)
    getGoogleCalendarStatus.mockResolvedValue(status())
    render(<GoogleCalendarPanel redirect={vi.fn()} />)
    expect((await screen.findByText(texto)).textContent).toMatch(texto)
    expect(window.location.search).toBe('')
  })

  it('reports a status load failure with retry and has no accessibility violations', async () => {
    getGoogleCalendarStatus.mockRejectedValueOnce(new Error('Não foi possível conectar ao servidor.')).mockResolvedValueOnce(status({ estado: 'conectada' }))
    const { container } = render(<GoogleCalendarPanel redirect={vi.fn()} />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível carregar o estado da integração.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByRole('button', { name: 'Sincronizar agora' })
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
    expect(result.violations.map((violation) => violation.id)).toEqual([])
  })
})
