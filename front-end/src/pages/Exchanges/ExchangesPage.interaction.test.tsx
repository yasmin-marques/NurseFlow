// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExchangesPage } from './ExchangesPage'

const { listarTrocas, obterTroca, validarTroca, aprovarTroca, recusarTroca } = vi.hoisted(() => ({
  listarTrocas: vi.fn(), obterTroca: vi.fn(), validarTroca: vi.fn(), aprovarTroca: vi.fn(), recusarTroca: vi.fn(),
}))
vi.mock('../../services/trocas', () => ({ listarTrocas, obterTroca, validarTroca, aprovarTroca, recusarTroca }))

const request = {
  id: 'exchange-1', status: 'aguardando_coordenacao', criadaEm: '2026-11-01T12:00:00.000Z',
  solicitante: { nome: 'Ana Souza' }, profissionalSolicitado: { nome: 'Beatriz Lima' },
  aceite: { aceito: true, aceitoEm: '2026-11-01T12:00:00.000Z' }, decisaoCoordenacao: null, historico: [],
  plantaoSolicitante: { profissional: 'Ana Souza', funcao: 'enfermeiro', lideranca: true, origemCobertura: 'regular', data: '2026-11-05T00:00:00.000Z', horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: 'regular', setor: 'UTI', escala: { ano: 2026, mes: 11, status: 'publicada', revisao: 4, versaoPublicada: 3 } },
  plantaoSolicitado: { profissional: 'Beatriz Lima', funcao: 'enfermeiro', lideranca: false, origemCobertura: 'regular', data: '2026-11-18T00:00:00.000Z', horarioInicio: '19:00', horarioFim: '07:00', duracaoHoras: 12, tipo: 'regular', setor: 'Emergência', escala: { ano: 2026, mes: 11, status: 'publicada', revisao: 4, versaoPublicada: 3 } },
}
const page = { itens: [request], pagina: 1, limite: 50, total: 1, totalPaginas: 1, contadores: { pendentes: 1, aprovadas: 0, recusadas: 0, aguardandoCoordenacao: 1 } }

describe('ExchangesPage accessibility and interaction', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('crypto', { randomUUID: () => 'operation-uuid' })
    listarTrocas.mockImplementation(({ status }: { status: 'pendentes' | 'aprovadas' | 'recusadas' }) => Promise.resolve({
      ...page,
      itens: status === 'pendentes' ? [request] : [{ ...request, status: status === 'aprovadas' ? 'aprovada' : 'recusada_pela_coordenacao' }],
      contadores: { pendentes: 1, aprovadas: 1, recusadas: 1, aguardandoCoordenacao: 1 },
    }))
    obterTroca.mockResolvedValue(request)
    validarTroca.mockResolvedValue({ apta: true, impedimentos: [], avisos: [], revisaoEsperada: 4 })
    aprovarTroca.mockResolvedValue({ ...request, status: 'aprovada' })
    recusarTroca.mockResolvedValue({ ...request, status: 'recusada_pela_coordenacao' })
  })

  it('supports tab navigation, clear active state, and restores focus after Escape', async () => {
    const user = userEvent.setup()
    render(<ExchangesPage />)
    const tablist = screen.getByRole('tablist', { name: 'Situação das solicitações' })
    const pending = within(tablist).getByRole('tab', { name: /^Pendentes/ })
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).not.toBeNull())
    expect(pending.getAttribute('aria-selected')).toBe('true')
    pending.focus()
    await user.keyboard('{ArrowRight}')
    const approved = within(tablist).getByRole('tab', { name: /^Aprovadas/ })
    await waitFor(() => expect(document.activeElement).toBe(approved))
    expect(approved.getAttribute('aria-selected')).toBe('true')
    expect(listarTrocas).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'aprovadas' }))
    await user.click(within(tablist).getByRole('tab', { name: /^Pendentes/ }))
    const decision = await screen.findByRole('button', { name: 'Aprovar' })
    await user.click(decision)
    const dialog = await screen.findByRole('dialog', { name: 'Tem certeza que deseja aprovar?' })
    expect(within(dialog).getByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').trim() === 'Ana Souza → Beatriz Lima')).not.toBeNull()
    expect(within(dialog).queryByText(/Plantão do solicitante/)).toBeNull()
    expect(within(dialog).queryByText(/Emergência/)).toBeNull()
    expect(within(dialog).getByText('A troca será aplicada à escala oficial.')).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(decision))
    expect(aprovarTroca).not.toHaveBeenCalled()
  })

  it('requires a refusal reason and traps keyboard focus inside the confirmation dialog', async () => {
    const user = userEvent.setup()
    render(<ExchangesPage />)
    const reject = await screen.findByRole('button', { name: 'Recusar' })
    await user.click(reject)
    const dialog = await screen.findByRole('dialog', { name: 'Tem certeza que deseja recusar?' })
    expect(within(dialog).getByText('A troca não será realizada.')).not.toBeNull()
    expect(within(dialog).queryByText(/Plantão do solicitante/)).toBeNull()
    expect(within(dialog).queryByText(/Emergência/)).toBeNull()
    const confirm = within(dialog).getByRole('button', { name: '✕ Sim' })
    const cancel = within(dialog).getByRole('button', { name: 'Não' })
    const reason = within(dialog).getByRole('textbox', { name: 'Motivo da recusa' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    reason.focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(document.activeElement).toBe(cancel)
    await user.type(reason, 'Cobertura insuficiente')
    expect((confirm as HTMLButtonElement).disabled).toBe(false)
    confirm.focus()
    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(reason)
    await user.click(confirm)
    await waitFor(() => expect(recusarTroca).toHaveBeenCalledWith('exchange-1', expect.objectContaining({ justificativa: 'Cobertura insuficiente' })))
    expect((await screen.findByRole('status')).textContent).toContain('Troca recusada e confirmada pelo servidor.')
  })

  it('loads all final states and applies the selected period', async () => {
    const user = userEvent.setup()
    render(<ExchangesPage />)
    const tablist = screen.getByRole('tablist', { name: 'Situação das solicitações' })
    await screen.findByRole('button', { name: 'Aprovar' })
    await user.click(within(tablist).getByRole('tab', { name: /^Aprovadas/ }))
    expect(await screen.findByText('Solicitação aprovada')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
    await user.click(within(tablist).getByRole('tab', { name: /^Recusadas/ }))
    expect(await screen.findByText('Solicitação recusada')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Recusar' })).toBeNull()
    await user.selectOptions(screen.getByLabelText('Mês'), '10')
    await waitFor(() => expect(listarTrocas).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'recusadas', mes: 10 })))
  })

  it('expands details below the summary in all tabs and keeps real impediments visible', async () => {
    const user = userEvent.setup()
    validarTroca.mockResolvedValue({ apta: false, impedimentos: [{ codigo: 'COBERTURA_AGRAVADA', mensagem: 'A cobertura do setor seria agravada.' }], avisos: [{ codigo: 'COBERTURA_INSUFICIENTE', mensagem: '124 posições de cobertura permanecerão sem preencher.' }], revisaoEsperada: 4 })
    const { container } = render(<ExchangesPage />)

    const pendingCard = (await screen.findByRole('button', { name: 'Aprovar' })).closest('li')!
    expect(within(pendingCard).queryByText('Aguardando Coordenação')).toBeNull()
    expect(within(pendingCard).getAllByRole('button').map((button) => button.textContent)).toEqual(['Detalhes', 'Recusar', 'Aprovar'])
    const actionGroup = pendingCard.children[0].children[2] as HTMLElement
    const detailsButton = within(actionGroup).getByRole('button', { name: 'Detalhes' })
    expect(actionGroup.className).toContain('justify-end')
    expect(detailsButton.className).toContain('text-[11px]')
    expect(detailsButton.className).toContain('px-3')
    expect(within(actionGroup).getByRole('button', { name: 'Recusar' }).className).toContain('px-4')
    await user.click(within(pendingCard).getByRole('button', { name: 'Detalhes' }))
    const pendingDetails = await within(pendingCard).findByRole('region', { name: 'Detalhes da troca' })
    expect(within(pendingDetails).getByText('Aguardando Coordenação')).not.toBeNull()
    expect(pendingCard.children[1].contains(pendingDetails)).toBe(true)
    expect(within(pendingDetails).getByText('A cobertura do setor seria agravada.')).not.toBeNull()
    expect(within(pendingDetails).queryByText(/posições de cobertura permanecerão/)).toBeNull()
    expect(within(pendingDetails).queryByText('Profissional apto')).toBeNull()
    expect(within(pendingDetails).queryByRole('button', { name: 'Detalhes' })).toBeNull()
    expect(within(pendingDetails).getByRole('button', { name: 'Fechar detalhes' }).className).toContain('text-[11px]')
    expect(pendingDetails.querySelector('.grid.sm\\:grid-cols-2')).not.toBeNull()

    await user.click(within(pendingDetails).getByRole('button', { name: 'Fechar detalhes' }))
    await user.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /^Aprovadas/ }))
    obterTroca.mockResolvedValueOnce({ ...request, status: 'aprovada', decisaoCoordenacao: { resultado: 'aprovada', decididaEm: '2026-11-02T12:00:00Z', justificativa: null } })
    const approvedCard = (await screen.findByText('Solicitação aprovada')).closest('li')!
    await user.click(within(approvedCard).getByRole('button', { name: 'Detalhes' }))
    const approvedDetails = await within(approvedCard).findByRole('region', { name: 'Detalhes da troca' })
    expect(within(approvedDetails).getByText('Solicitação aprovada')).not.toBeNull()
    expect(within(approvedCard).queryByRole('button', { name: 'Aprovar' })).toBeNull()
    expect(within(approvedCard).queryByRole('button', { name: 'Recusar' })).toBeNull()

    await user.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /^Recusadas/ }))
    obterTroca.mockResolvedValueOnce({ ...request, status: 'recusada_pela_coordenacao', decisaoCoordenacao: { resultado: 'recusada', decididaEm: '2026-11-02T12:00:00Z', justificativa: 'Cobertura necessária no setor.' } })
    const rejectedCard = (await screen.findByText('Solicitação recusada')).closest('li')!
    await user.click(within(rejectedCard).getByRole('button', { name: 'Detalhes' }))
    const rejectedDetails = await within(rejectedCard).findByRole('region', { name: 'Detalhes da troca' })
    expect(within(rejectedDetails).getByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').trim() === 'Motivo da recusa: Cobertura necessária no setor.')).not.toBeNull()
    expect(within(rejectedCard).queryByRole('button', { name: 'Aprovar' })).toBeNull()
    expect(within(rejectedCard).queryByRole('button', { name: 'Recusar' })).toBeNull()

    for (const width of [375, 768, 1024, 1440]) {
      window.innerWidth = width
      window.dispatchEvent(new Event('resize'))
      expect(container.querySelector('.sm\\:grid-cols-2')).not.toBeNull()
      expect(container.querySelector('.min-w-0')).not.toBeNull()
    }
  })

  it('announces list network errors and reloads from the service after retry', async () => {
    const user = userEvent.setup()
    listarTrocas.mockRejectedValueOnce(new Error('Falha de rede'))
    render(<ExchangesPage />)
    expect((await screen.findByRole('alert')).textContent).toContain('Falha de rede')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText(/Ana Souza/)).not.toBeNull()
    expect(listarTrocas).toHaveBeenCalledTimes(2)
  })

  it('only confirms approval after the API responds and refreshes the persisted list', async () => {
    const user = userEvent.setup()
    render(<ExchangesPage />)
    await user.click(await screen.findByRole('button', { name: 'Aprovar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tem certeza que deseja aprovar?' })
    await user.click(within(dialog).getByRole('button', { name: '✓ Sim' }))
    await waitFor(() => expect(aprovarTroca).toHaveBeenCalledWith('exchange-1', expect.objectContaining({ revisaoEsperada: 4 })))
    expect((await screen.findByRole('status')).textContent).toContain('Troca aprovada e confirmada pelo servidor.')
    expect(listarTrocas).toHaveBeenCalledTimes(2)
  })

  it('has no automated axe violations in the administrative screen and decision dialog', async () => {
    const user = userEvent.setup()
    render(<ExchangesPage />)
    await screen.findByRole('button', { name: 'Aprovar' })
    await user.click(screen.getByRole('button', { name: 'Aprovar' }))
    await screen.findByRole('dialog', { name: 'Tem certeza que deseja aprovar?' })
    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
