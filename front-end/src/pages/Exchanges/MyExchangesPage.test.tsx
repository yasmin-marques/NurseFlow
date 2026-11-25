// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MyExchangesPage } from './MyExchangesPage'
import { criarMinhaTroca, executarAcaoTroca, listarCandidatosTroca, listarMeusPlantoes, listarMinhasTrocas } from '../../services/my-exchanges'

vi.mock('../../services/my-exchanges', () => ({ listarMinhasTrocas: vi.fn(), listarMeusPlantoes: vi.fn(), listarCandidatosTroca: vi.fn(), criarMinhaTroca: vi.fn(), executarAcaoTroca: vi.fn() }))

const shift = { vinculoId: 'link-a', plantaoId: 'shift-a', data: '2026-12-20T00:00:00.000Z', horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, setorId: 'Bloco A', setor: 'Bloco A', funcao: 'enfermeiro', versaoOficialEsperada: 3 }
const request = { id: 'request-1', status: 'aguardando_resposta', direcao: 'recebida' as const, criadaEm: '2026-11-17T00:00:00.000Z', solicitante: { nome: 'Ana' }, profissionalSolicitado: { nome: 'Beatriz' }, plantaoSolicitante: shift, plantaoSolicitado: { ...shift, vinculoId: 'link-b', plantaoId: 'shift-b' } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listarMinhasTrocas).mockResolvedValue({ itens: [], total: 0, pagina: 1, limite: 50, totalPaginas: 0 })
  vi.mocked(listarMeusPlantoes).mockResolvedValue({ itens: [shift] })
  vi.mocked(listarCandidatosTroca).mockResolvedValue({ itens: [{ ...shift, vinculoId: 'link-b', plantaoId: 'shift-b', profissional: { id: 'p2', nome: 'Beatriz' } }] })
  vi.mocked(criarMinhaTroca).mockResolvedValue(request)
  vi.mocked(executarAcaoTroca).mockResolvedValue(request)
  vi.stubGlobal('crypto', { randomUUID: () => 'operation-1' })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('MyExchangesPage', () => {
  it.each(['Enfermeiro', 'Técnico'])('renders green-accented selectable cards for %s exchange requests', async () => {
    const user = userEvent.setup()
    render(<MyExchangesPage />)
    await user.click(await screen.findByRole('button', { name: 'Nova solicitação' }))

    const shiftCard = await screen.findByRole('button', { name: /Bloco A/ })
    expect(shiftCard.className).toContain('border-l-4')
    expect(shiftCard.className).toContain('border-l-primary')
    expect(shiftCard.className).toContain('pl-5')

    await user.click(shiftCard)
    const candidateCard = await screen.findByRole('button', { name: /Beatriz/ })
    expect(candidateCard.className).toContain('border-l-4')
    expect(candidateCard.className).toContain('border-l-primary')
    expect(candidateCard.className).toContain('pl-5')
    await user.click(candidateCard)
    expect(await screen.findByText(/A escala oficial não muda com o aceite/)).not.toBeNull()
  })

  it('sends only after the nurse completes the three review steps', async () => {
    const user = userEvent.setup()
    render(<MyExchangesPage />)
    await user.click(await screen.findByRole('button', { name: 'Nova solicitação' }))
    await user.click(await screen.findByRole('button', { name: /Bloco A/ }))
    expect(listarCandidatosTroca).toHaveBeenCalledWith('link-a')
    await user.click(await screen.findByRole('button', { name: /Beatriz/ }))
    expect(screen.getByText(/A escala oficial não muda com o aceite/)).not.toBeNull()
    expect(criarMinhaTroca).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }))
    expect(await screen.findByRole('status')).not.toBeNull()
    expect(criarMinhaTroca).toHaveBeenCalledWith(expect.objectContaining({ vinculoSolicitanteId: 'link-a', vinculoSolicitadoId: 'link-b', versaoOficialEsperada: 3 }))
  })

  it('requires explicit confirmation before accepting and shows coordination pending', async () => {
    vi.mocked(listarMinhasTrocas).mockResolvedValue({ itens: [request], total: 1, pagina: 1, limite: 50, totalPaginas: 1 })
    const user = userEvent.setup()
    render(<MyExchangesPage />)
    await user.click(await screen.findByRole('button', { name: 'Aceitar' }))
    expect(screen.getByText('Você aceitará a troca de plantão. A escala só muda após a decisão da Coordenação.')).not.toBeNull()
    expect(screen.queryByText(/Beatriz/)).toBeNull()
    expect(executarAcaoTroca).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(executarAcaoTroca).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Aceitar' }))
    await user.click(screen.getByRole('button', { name: 'Não' }))
    expect(executarAcaoTroca).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Aceitar' }))
    await user.click(screen.getByRole('button', { name: 'Sim, quero aceitar' }))
    expect(await screen.findByText('Solicitação aceita. Aguardando Coordenação.')).not.toBeNull()
    expect(executarAcaoTroca).toHaveBeenCalledWith('request-1', 'aceite', 'operation-1')
  })

  it('shows the correct colleague rejection perspective in received, sent, and coordination cases', async () => {
    vi.mocked(listarMinhasTrocas).mockImplementation(async (tab) => ({
      itens: tab === 'recebidas'
        ? [{ ...request, status: 'recusada_pelo_profissional', direcao: 'recebida' as const, solicitante: { nome: 'Karina Alves' }, profissionalSolicitado: { nome: 'Beatriz Lima' } }]
        : tab === 'enviadas'
          ? [{ ...request, status: 'recusada_pelo_profissional', direcao: 'enviada' as const, solicitante: { nome: 'Beatriz Lima' }, profissionalSolicitado: { nome: 'Karina Alves' } }]
          : [{ ...request, status: 'recusada_pela_coordenacao', direcao: 'recebida' as const }],
      total: 1, pagina: 1, limite: 50, totalPaginas: 1,
    }))
    render(<MyExchangesPage />)

    expect(await screen.findByText('Você recusou')).not.toBeNull()
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Enviadas' }))
    expect(await screen.findByText('Recusada por Karina')).not.toBeNull()
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(await screen.findByText('Recusada pela Coordenação')).not.toBeNull()
  })

  it('has no automated WCAG A/AA violations in the initial view', async () => {
    const { container } = render(<MyExchangesPage />)
    await screen.findByRole('tab', { name: 'Recebidas' })
    const results = await axe.run(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
    expect(results.violations).toEqual([])
  })
})
