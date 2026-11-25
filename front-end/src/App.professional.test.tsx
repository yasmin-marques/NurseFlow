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
vi.mock('./pages/Overview/ProfessionalOverviewPage', () => ({
  ProfessionalOverviewPage: (props: { onNavigate: (id: 'escala-geral' | 'trocas') => void }) => (
    <>
      <h1>Visão geral profissional</h1>
      <button type="button" onClick={() => props.onNavigate('escala-geral')}>Atalho Escala geral</button>
    </>
  ),
}))
vi.mock('./pages/GeneralSchedule/GeneralSchedulePage', () => ({ GeneralSchedulePage: () => <h1>Tela Escala geral</h1> }))
vi.mock('./pages/Scale/ScalePage', () => ({ ScalePage: () => <h1>Gestão de escala</h1> }))
vi.mock('./pages/Exchanges/ExchangesPage', () => ({ ExchangesPage: () => <h1>Trocas da Coordenação</h1> }))
vi.mock('./pages/Exchanges/MyExchangesPage', () => ({ MyExchangesPage: () => <h1>Minhas trocas do profissional</h1> }))
vi.mock('./pages/History/HistoryPage', () => ({ HistoryPage: () => <h1>Histórico administrativo</h1> }))

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

  it('removes search and header screen titles for professional profiles', async () => {
    currentUser.mockResolvedValue(session('enfermeiro', 'Ana Ribeiro'))
    render(<App />)
    await screen.findByRole('navigation', { name: 'Áreas do profissional' })
    expect(screen.queryByRole('button', { name: 'Abrir pesquisa' })).toBeNull()
  })

  it('opens the same profile modal for Enfermeiro, Técnico, and Coordenação entry points', async () => {
    const user = userEvent.setup()
    currentUser.mockResolvedValue(session('enfermeiro', 'Ana Ribeiro'))
    const professional = render(<App />)
    await screen.findByRole('button', { name: /Abrir meu perfil — Ana Ribeiro, Enfermeiro/ })
    await user.click(screen.getByRole('button', { name: /Abrir meu perfil — Ana Ribeiro, Enfermeiro/ }))
    expect(await screen.findByRole('dialog', { name: 'Ana Ribeiro' })).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Fechar perfil' }))
    professional.unmount()

    currentUser.mockResolvedValue(session('coordenacao', 'Paloma Ferreira'))
    render(<App />)
    await screen.findByText('Profissionais')
    await user.click(screen.getByRole('button', { name: 'Abrir meu perfil' }))
    expect(await screen.findByRole('dialog', { name: 'Paloma Ferreira' })).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Paloma Ferreira' }).querySelector('[class*="border-primary"]')).not.toBeNull()
  })

  it('opens shared Minhas trocas for Enfermeiro', async () => {
    currentUser.mockResolvedValue(session('enfermeiro', 'Ana Ribeiro'))
    const user = userEvent.setup()
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Áreas do profissional' })
    await user.click(within(nav).getByRole('button', { name: 'Trocas' }))
    expect(screen.getByRole('heading', { name: 'Minhas trocas do profissional' })).not.toBeNull()
    expect(within(nav).getByRole('button', { name: 'Trocas' }).textContent).toBe('Trocas')
    expect(screen.queryByText('Trocas da Coordenação')).toBeNull()
  })

  it('opens shared Minhas trocas for Técnico', async () => {
    currentUser.mockResolvedValue(session('tecnico', 'Rafael Martins'))
    const user = userEvent.setup()
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Áreas do profissional' })
    await user.click(within(nav).getByRole('button', { name: 'Trocas' }))
    expect(screen.getByRole('heading', { name: 'Minhas trocas do profissional' })).not.toBeNull()
    expect(screen.queryByText('Esta área ainda está sendo preparada.')).toBeNull()
  })

  it.each(['enfermeiro', 'tecnico'])('opens Escala geral from the quick-access card for %s', async (perfil) => {
    currentUser.mockResolvedValue(session(perfil))
    const user = userEvent.setup()
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Áreas do profissional' })
    await user.click(screen.getByRole('button', { name: 'Atalho Escala geral' }))
    expect(screen.getByRole('heading', { name: 'Tela Escala geral' })).not.toBeNull()
    expect(within(nav).getByRole('button', { name: 'Escala geral' }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps the existing side-menu layout for the Coordenação', async () => {
    currentUser.mockResolvedValue(session('coordenacao', 'Paloma Ferreira'))
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('Profissionais')).not.toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Áreas do profissional' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir pesquisa' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Visão geral', level: 1 })).toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir meu perfil' }).querySelector('[class*="border-primary"]')).not.toBeNull()
    await user.click(screen.getByRole('link', { name: 'Histórico' }))
    expect(screen.getByRole('heading', { name: 'Histórico administrativo' })).not.toBeNull()
  })
})
