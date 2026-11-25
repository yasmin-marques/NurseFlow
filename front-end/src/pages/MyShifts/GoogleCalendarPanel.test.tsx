// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GoogleCalendarStatus } from '../../services/googleCalendar'
import { GoogleCalendarPanel } from './GoogleCalendarPanel'

const { getGoogleCalendarStatus, startGoogleCalendarConnection, disableGoogleCalendar } = vi.hoisted(() => ({
  getGoogleCalendarStatus: vi.fn(),
  startGoogleCalendarConnection: vi.fn(),
  disableGoogleCalendar: vi.fn(),
}))
vi.mock('../../services/googleCalendar', () => ({ getGoogleCalendarStatus, startGoogleCalendarConnection, disableGoogleCalendar }))

const status = (overrides: Partial<GoogleCalendarStatus> = {}): GoogleCalendarStatus => ({
  configurada: true,
  estado: 'nao_conectada',
  ultimaSincronizacaoEm: null,
  pendentes: 0,
  reconexaoNecessaria: false,
  ultimoResultado: null,
  ...overrides,
})

describe('GoogleCalendarPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/')
  })
  afterEach(() => cleanup())

  it('shows one compact sync action while disconnected and starts Google consent', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status())
    startGoogleCalendarConnection.mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc' })
    const redirect = vi.fn()
    render(<GoogleCalendarPanel redirect={redirect} />)

    const sync = await screen.findByRole('button', { name: 'Sincronizar' })
    expect(screen.getByTestId('google-calendar-state').textContent).toContain('Não conectado')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await userEvent.setup().click(sync)
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=abc'))
  })

  it('disables the action and explains when the integration is not configured', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status({ configurada: false }))
    render(<GoogleCalendarPanel redirect={vi.fn()} />)
    expect((await screen.findByRole('button', { name: 'Sincronizar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/ainda não foi configurada neste ambiente/)).not.toBeNull()
  })

  it('shows one unsync action when connected and lets the professional turn it off', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status({
      estado: 'conectada',
      ultimaSincronizacaoEm: '2026-12-01T10:00:00Z',
      pendentes: 1,
    }))
    disableGoogleCalendar.mockResolvedValue(status({ estado: 'desativada' }))
    render(<GoogleCalendarPanel redirect={vi.fn()} />)

    expect((await screen.findByTestId('google-calendar-state')).textContent).toMatch(/^Google Agenda · Conectado · última sincronização em .* · 1 atualização\(ões\) na fila$/)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Dessincronizar' }))
    expect((await screen.findByRole('status')).textContent).toContain('eventos já enviados permanecem')
    expect(screen.getByTestId('google-calendar-state').textContent).toContain('Sincronização desativada')
    expect(screen.getByRole('button', { name: 'Sincronizar' })).not.toBeNull()
  })

  it('asks the professional to reconnect when authorization expired', async () => {
    getGoogleCalendarStatus.mockResolvedValue(status({ estado: 'reconexao_necessaria', reconexaoNecessaria: true }))
    startGoogleCalendarConnection.mockResolvedValue({ url: 'https://accounts.google.com/auth' })
    const redirect = vi.fn()
    render(<GoogleCalendarPanel redirect={redirect} />)
    expect((await screen.findByRole('alert')).textContent).toContain('expirou ou foi revogada')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sincronizar' }))
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://accounts.google.com/auth'))
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

  it('reports status load errors with retry and has no accessibility violations', async () => {
    getGoogleCalendarStatus.mockRejectedValueOnce(new Error('Não foi possível conectar ao servidor.')).mockResolvedValueOnce(status())
    const { container } = render(<GoogleCalendarPanel redirect={vi.fn()} />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível carregar o estado da integração.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByTestId('google-calendar-state')
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
    expect(result.violations.map((violation) => violation.id)).toEqual([])
  })
})
