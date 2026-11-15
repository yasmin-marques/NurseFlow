// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralSchedulePage } from './GeneralSchedulePage'

const { getGeneralMonth, getGeneralDay } = vi.hoisted(() => ({ getGeneralMonth: vi.fn(), getGeneralDay: vi.fn() }))
vi.mock('../../services/professionalSchedule', () => ({ getGeneralMonth, getGeneralDay }))

const dia = (data: string, extra: Record<string, unknown> = {}) => ({
  data, turnos: [{ turno: 'diurno', horarioInicio: '07:00', horarioFim: '19:00' }], chefe: { nome: 'Ana Ribeiro' }, setores: ['Bloco A'], ...extra,
})
const staff = (nome: string, regime = '24 horas · 07h—07h') => ({ nome, cargo: 'Técnico de enfermagem', setores: ['Setor A'], regime })
const details = {
  data: '2026-06-10', publicada: true,
  chefe: { nome: 'Lucas Mendes', setores: ['Setor A', 'Setor B'], regime: '24 horas · 07h—07h' },
  enfermeiros: [{ nome: 'Lucas Mendes', cargo: 'Enfermeiro chefe', setores: ['Setor A', 'Setor B'], regime: '24 horas · 07h—07h' }],
  tecnicos: [staff('Heitor Vaz'), staff('André Silva', 'Diurno · 07h—19h · restrição'), staff('Célia Luz', 'Noturno · 19h—07h · cobertura')],
  contagens: { enfermeiros: 1, tecnicos: 3 },
}

describe('GeneralSchedulePage', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 10, 12))
    getGeneralMonth.mockImplementation((ano: number, mes: number) =>
      Promise.resolve({ ano, mes, publicada: true, versao: { numero: 1, publicadoEm: '2026-05-30T00:00:00Z' },
        dias: [dia('2026-06-07'), dia('2026-06-08'), dia('2026-06-10', { turnos: [{ turno: '24h', horarioInicio: '07:00', horarioFim: '07:00' }], chefe: { nome: 'Lucas Mendes' } })] }))
    getGeneralDay.mockResolvedValue(details)
  })

  it('renders the current week with a card per day and a privacy notice', async () => {
    render(<GeneralSchedulePage />)
    expect(screen.getByText('Veja quem estará de plantão. Dados pessoais não são exibidos.')).not.toBeNull()
    expect(await screen.findByText('Lucas Mendes')).not.toBeNull()
    expect(screen.getByText('Junho de 2026')).not.toBeNull()
    expect(screen.getByText('7—13 de junho')).not.toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByText('24 HORAS · 07h—07h')).not.toBeNull()
    expect(screen.getAllByText('Sem escala publicada neste dia').length).toBe(4)
    expect(getGeneralMonth).toHaveBeenCalledWith(2026, 6)
  })

  it('navigates weeks across months and via the month selector', async () => {
    const user = userEvent.setup()
    render(<GeneralSchedulePage />)
    await screen.findByText('Lucas Mendes')
    await user.click(screen.getByRole('button', { name: /Próxima semana/ }))
    expect(await screen.findByText('14—20 de junho')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await screen.findByText('Julho de 2026')).not.toBeNull()
    await waitFor(() => expect(getGeneralMonth).toHaveBeenCalledWith(2026, 7))
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(await screen.findByText('Junho de 2026')).not.toBeNull()
    // Semana que cruza meses consulta os dois meses.
    getGeneralMonth.mockClear()
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: /Próxima semana/ }))
    expect(await screen.findByText('28 de junho — 4 de julho')).not.toBeNull()
    await waitFor(() => expect(getGeneralMonth).toHaveBeenCalledWith(2026, 7))
    expect(getGeneralMonth).toHaveBeenCalledWith(2026, 6)
  })

  it('says when the month has no published schedule', async () => {
    getGeneralMonth.mockImplementation((ano: number, mes: number) => Promise.resolve({ ano, mes, publicada: false, versao: null, dias: [] }))
    render(<GeneralSchedulePage />)
    expect(await screen.findByText('A escala deste período ainda não foi publicada.')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows an error with retry', async () => {
    getGeneralMonth.mockRejectedValueOnce(new Error('Não foi possível conectar ao servidor.'))
    render(<GeneralSchedulePage />)
    const alert = await screen.findByRole('alert')
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Lucas Mendes')).not.toBeNull()
  })

  it('opens a scrollable day dialog, labels restriction/coverage in text, and returns focus on Escape', async () => {
    const user = userEvent.setup()
    const { container } = render(<GeneralSchedulePage />)
    const card = (await screen.findByText('Lucas Mendes')).closest('button') as HTMLButtonElement
    card.focus()
    await user.click(card)
    const dialog = await screen.findByRole('dialog', { name: 'Cobertura do dia 10 de junho de 2026' })
    expect(getGeneralDay).toHaveBeenCalledWith('2026-06-10')
    expect(await within(dialog).findByText('Enfermeiro chefe · Liderança geral')).not.toBeNull()
    expect(within(dialog).getByText('Cobertura diária')).not.toBeNull()
    expect(within(dialog).getByText('Técnicos · 3')).not.toBeNull()
    expect(within(dialog).getByText('Diurno · 07h—19h · restrição')).not.toBeNull()
    expect(within(dialog).getByText('Noturno · 19h—07h · cobertura')).not.toBeNull()
    expect(within(dialog).getByTestId('modal-body').className).toContain('overflow-y-auto')
    expect(document.body.style.overflow).toBe('hidden')
    const result = await axe.run(container.ownerDocument.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
    expect(result.violations.map((violation) => violation.id)).toEqual([])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(card)
  })

  it('shows an error inside the dialog and allows retrying', async () => {
    getGeneralDay.mockRejectedValueOnce(new Error('Falha.'))
    const user = userEvent.setup()
    render(<GeneralSchedulePage />)
    await user.click((await screen.findByText('Lucas Mendes')).closest('button') as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')
    const alert = await within(dialog).findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    expect(await within(dialog).findByText('Enfermeiro chefe · Liderança geral')).not.toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Fechar detalhes do dia' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
