// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }))
vi.mock('./services/auth', () => ({ currentUser, logout: vi.fn() }))
vi.mock('./services/api', () => ({ api: vi.fn().mockResolvedValue({ contadores: { aguardandoCoordenacao: 2 } }), UNAUTHORIZED_EVENT: 'nurseflow:unauthorized' }))
vi.mock('./components/layout/NotificationCenter', () => ({ NotificationCenter: () => <button type="button" aria-label="Notificações" /> }))
vi.mock('./pages/MyShifts/MyShiftsPage', () => ({ MyShiftsPage: () => <h1>Tela Meus plantões</h1> }))
vi.mock('./pages/GeneralSchedule/GeneralSchedulePage', () => ({ GeneralSchedulePage: () => <h1>Tela Escala geral</h1> }))
vi.mock('./pages/Scale/ScalePage', () => ({ ScalePage: () => <h1>Gestão de escala</h1> }))
vi.mock('./pages/Exchanges/ExchangesPage', () => ({ ExchangesPage: () => <h1>Trocas da Coordenação</h1> }))

const session = (perfil: string, nome = 'Camila Souza') => ({ id: 'u1', nome, email: 'c@x.com', perfil })

describe('App routing by profile', () => {
  afterEach(() => cleanup())
  beforeEach(() => vi.clearAllMocks())

  it('gives Enfermeiro/Técnico top navigation with their own areas and no management items', async () => {
    currentUser.mockResolvedValue(session('tecnico'))
    const user = userEvent.setup()
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Áreas do profissional' })
    expect(within(nav).getAllByRole('button').map((button) => button.textContent)).toEqual(['Início', 'Meus plantões', 'Escala geral', 'Trocas'])
    expect(within(nav).getByRole('button', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    for (const hidden of ['Profissionais', 'Disponibilidade', 'Setores', 'Configurações', 'Histórico']) expect(screen.queryByRole('link', { name: hidden })).toBeNull()
    expect(screen.getByRole('button', { name: /Abrir meu perfil — Camila Souza, Técnico/ })).not.toBeNull()

    await user.click(within(nav).getByRole('button', { name: 'Meus plantões' }))
    expect(screen.getByRole('heading', { name: 'Tela Meus plantões' })).not.toBeNull()
    expect(within(nav).getByRole('button', { name: 'Meus plantões' }).getAttribute('aria-current')).toBe('page')

    await user.click(within(nav).getByRole('button', { name: 'Escala geral' }))
    expect(screen.getByRole('heading', { name: 'Tela Escala geral' })).not.toBeNull()
    expect(screen.queryByText('Esta área ainda está sendo preparada.')).toBeNull()
  })

  it('shows Trocas as upcoming for professionals, with no fabricated counter or data', async () => {
    currentUser.mockResolvedValue(session('enfermeiro', 'Ana Ribeiro'))
    const user = userEvent.setup()
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Áreas do profissional' })
    await user.click(within(nav).getByRole('button', { name: 'Trocas' }))
    expect(screen.getByRole('heading', { name: 'Trocas' })).not.toBeNull()
    expect(screen.getByText(/ainda está sendo preparada/)).not.toBeNull()
    expect(within(nav).getByRole('button', { name: 'Trocas' }).textContent).toBe('Trocas')
    expect(screen.queryByText('Trocas da Coordenação')).toBeNull()
  })

  it('keeps the existing side-menu layout for the Coordenação', async () => {
    currentUser.mockResolvedValue(session('coordenacao', 'Paloma Ferreira'))
    render(<App />)
    expect(await screen.findByText('Profissionais')).not.toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Áreas do profissional' })).toBeNull()
  })
})
