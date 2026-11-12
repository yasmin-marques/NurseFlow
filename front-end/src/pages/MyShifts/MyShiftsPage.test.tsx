// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MyShiftsPage } from './MyShiftsPage'

const { getMyShifts } = vi.hoisted(() => ({ getMyShifts: vi.fn() }))
vi.mock('../../services/professionalSchedule', () => ({ getMyShifts }))

const shift = (overrides: Record<string, unknown> = {}) => ({
  plantaoId: 'p1', data: '2026-11-01', horarioInicio: '07:00', horarioFim: '07:00', duracaoHoras: 24, tipo: 'regular',
  setor: { id: 's1', nome: 'Setor A' }, funcao: 'tecnico', lideranca: false, status: 'trabalhando',
  chefe: { nome: 'Ana Ribeiro' }, enfermeiros: [{ nome: 'Ana Ribeiro', lideranca: true }, { nome: 'Marina Freitas', lideranca: false }],
  tecnicos: [{ nome: 'Bruno Lima' }, { nome: 'Lívia Reis' }], ...overrides,
})
const page = (itens: unknown[], extra: Record<string, unknown> = {}) => ({ itens, pagina: 1, limite: 20, total: itens.length, totalPaginas: 1, ...extra })

describe('MyShiftsPage', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    vi.clearAllMocks()
    getMyShifts.mockImplementation((situacao: string) =>
      Promise.resolve(situacao === 'proximos' ? page([shift()]) : page([shift({ plantaoId: 'p0', data: '2026-10-09', status: 'trabalhado', tipo: 'extra' })])))
  })

  it('shows upcoming shifts with team, status text and a disabled Google Agenda button', async () => {
    render(<MyShiftsPage />)
    expect(screen.getByRole('heading', { name: 'Meus plantões' })).not.toBeNull()
    expect(await screen.findByText('Setor A')).not.toBeNull()
    expect(screen.getByText('24 horas · 07h—07h')).not.toBeNull()
    expect(screen.getByText('Trabalhando')).not.toBeNull()
    expect(screen.getByText('Enfermeiro chefe: Ana Ribeiro')).not.toBeNull()
    expect(screen.getByText('Ana Ribeiro · Marina Freitas')).not.toBeNull()
    expect(screen.getByText('Outros técnicos')).not.toBeNull()
    expect(screen.getByText('Bruno Lima · Lívia Reis')).not.toBeNull()
    const agenda = screen.getByRole('button', { name: /Google Agenda/ }) as HTMLButtonElement
    expect(agenda.disabled).toBe(true)
    const user = userEvent.setup()
    await user.click(agenda)
    expect(getMyShifts).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /editar|publicar|gerar|excluir/i })).toBeNull()
  })

  it('switches to previous shifts with keyboard navigation and labels extras and worked shifts', async () => {
    const user = userEvent.setup()
    render(<MyShiftsPage />)
    await screen.findByText('Trabalhando')
    const tablist = screen.getByRole('tablist', { name: 'Situação dos plantões' })
    const next = within(tablist).getByRole('tab', { name: 'Próximos' })
    next.focus()
    await user.keyboard('{ArrowRight}')
    const previous = within(tablist).getByRole('tab', { name: 'Anteriores' })
    await waitFor(() => expect(document.activeElement).toBe(previous))
    expect(previous.getAttribute('aria-selected')).toBe('true')
    expect(await screen.findByText('Trabalhado')).not.toBeNull()
    expect(screen.getByText('Extra')).not.toBeNull()
    expect(getMyShifts).toHaveBeenLastCalledWith('anteriores', 1)
  })

  it('distinguishes the empty state from a load failure and retries', async () => {
    getMyShifts.mockResolvedValueOnce(page([]))
    const { unmount } = render(<MyShiftsPage />)
    expect(await screen.findByText('Você não tem plantões próximos na escala publicada.')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    unmount()

    getMyShifts.mockRejectedValueOnce(new Error('Não foi possível conectar ao servidor.')).mockResolvedValueOnce(page([shift()]))
    render(<MyShiftsPage />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível carregar seus plantões.')
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Setor A')).not.toBeNull()
  })

  it('appends the next page and has no accessibility violations', async () => {
    getMyShifts
      .mockResolvedValueOnce(page([shift()], { totalPaginas: 2 }))
      .mockResolvedValueOnce(page([shift({ plantaoId: 'p2', data: '2026-11-09', setor: { id: 's2', nome: 'Setor B' } })], { pagina: 2, totalPaginas: 2 }))
    const { container } = render(<MyShiftsPage />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Carregar mais' }))
    expect(await screen.findByText('Setor B')).not.toBeNull()
    expect(screen.getByText('Setor A')).not.toBeNull()
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
    expect(result.violations.map((violation) => violation.id)).toEqual([])
  })
})
