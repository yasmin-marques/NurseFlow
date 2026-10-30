import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { addShift, cancelScaleGeneration, createDraft, exportScalePdf, generateScale, getScale, listScales, publishScale, removeDraft, startReview, updateShift, validateScale } from './scales'
import { mockBackend } from '../test/fetchMock'

afterEach(() => vi.unstubAllGlobals())

const apiScale = {
  escala: {
    id: 'scale-1',
    ano: 2026,
    mes: 10,
    status: 'rascunho' as const,
    revisao: 2,
    validacao: null,
    administradorId: 'admin-1',
    dataCriacao: '2026-09-01T00:00:00.000Z',
  },
  resumo: { plantoes: 1, alocacoes: 1, vagasDescobertas: 0, extras: 0 },
  cobertura: { posicoesExigidas: 1, posicoesPreenchidas: 1, percentual: 100 },
  configuracaoUtilizada: null,
  escopo: { setorIds: ['sector-1'], turnos: ['diurno'] as const },
  plantoes: [
    {
      id: 'shift-1',
      data: '2026-10-01',
      setor: { id: 'sector-1', nome: 'UTI' },
      horarioInicio: '07:00',
      horarioFim: '19:00',
      duracaoHoras: 12,
      tipo: 'regular' as const,
      profissionais: [{ id: 'professional-1', nome: 'Ana', formacao: 'enfermeiro' as const, vinculo: 'clt' as const }],
    },
  ],
  pendencias: [],
  conflitos: [],
  avisos: [],
  cargas: [],
}

describe('services/scales', () => {
  it('lista por período e mantém tipados os dados de escala e cobertura', async () => {
    const { calls } = mockBackend((call) => ({ body: call.url.includes('?') ? [apiScale] : apiScale }))
    const [scale] = await listScales(2026, 10)
    const detail = await getScale('scale-1')

    expect(calls.map(({ url, method }) => [url, method])).toEqual([
      ['/api/escalas?ano=2026&mes=10', 'GET'],
      ['/api/escalas/scale-1', 'GET'],
    ])
    expect(scale).toMatchObject({
      escala: { id: 'scale-1', status: 'rascunho', revisao: 2 },
      cobertura: { percentual: 100 },
      plantoes: [{
        id: 'shift-1',
        profissionais: [{
          id: 'professional-1',
          formacao: 'enfermeiro',
          lideranca: false,
          origemCobertura: 'regular',
        }],
      }],
    })
    expect(detail.escala.id).toBe('scale-1')
  })

  it('cria rascunho e serializa equipe e revisão esperada nos plantões', async () => {
    const { calls } = mockBackend(() => ({ body: apiScale }))
    await createDraft(2026, 10)
    await addShift('scale-1', {
      revisao: 2,
      setorId: 'sector-1',
      data: '2026-10-01',
      opcao: '12d',
      tipo: 'regular',
      equipe: [{ profissionalId: 'professional-1', funcao: 'enfermeiro' }],
    })
    await updateShift('scale-1', 'shift-1', {
      revisao: 3,
      setorId: 'sector-1',
      data: '2026-10-02',
      opcao: '12n',
      tipo: 'extra',
      equipe: [{ profissionalId: 'professional-1', funcao: 'enfermeiro' }],
    })

    expect(calls.map(({ url, method, body }) => ({ url, method, body }))).toEqual([
      { url: '/api/escalas', method: 'POST', body: { ano: 2026, mes: 10 } },
      {
        url: '/api/escalas/scale-1/plantoes',
        method: 'POST',
        body: {
          revisaoEsperada: 2,
          setorId: 'sector-1',
          data: '2026-10-01',
          opcao: '12d',
          tipo: 'regular',
          equipe: [{
            profissionalId: 'professional-1',
            funcao: 'enfermeiro',
            lideranca: false,
            origemCobertura: 'regular',
          }],
        },
      },
      {
        url: '/api/escalas/scale-1/plantoes/shift-1',
        method: 'PATCH',
        body: {
          revisaoEsperada: 3,
          setorId: 'sector-1',
          data: '2026-10-02',
          opcao: '12n',
          tipo: 'extra',
          equipe: [{
            profissionalId: 'professional-1',
            funcao: 'enfermeiro',
            lideranca: false,
            origemCobertura: 'regular',
          }],
        },
      },
    ])
  })

  it('envia escopo de setor e turno para a geração', async () => {
    const { calls } = mockBackend(() => ({ body: apiScale }))
    await generateScale({
      ano: 2026,
      mes: 10,
      operacaoId: 'generation-1',
      setorIds: ['sector-1'],
      turnos: ['diurno'],
    })
    expect(calls[0]).toMatchObject({
      url: '/api/escalas/gerar',
      method: 'POST',
      body: { ano: 2026, mes: 10, operacaoId: 'generation-1', setorIds: ['sector-1'], turnos: ['diurno'] },
    })
  })

  it('solicita cancelamento ao endpoint da operação no servidor', async () => {
    const { calls } = mockBackend(() => ({
      status: 202,
      body: { operacaoId: 'generation-1', cancelamentoSolicitado: true },
    }))
    await cancelScaleGeneration('generation-1')

    expect(calls[0]).toMatchObject({
      url: '/api/escalas/gerar/generation-1',
      method: 'DELETE',
    })
  })

  it('serializa transições e remoção confirmada com a revisão atual', async () => {
    const { calls } = mockBackend(() => ({ body: apiScale }))
    await startReview('scale-1', 2)
    await validateScale('scale-1', 3)
    await removeDraft('scale-1', 4)

    expect(calls.map(({ url, method, body }) => ({ url, method, body }))).toEqual([
      { url: '/api/escalas/scale-1/revisao', method: 'POST', body: { revisaoEsperada: 2 } },
      { url: '/api/escalas/scale-1/validar', method: 'POST', body: { revisaoEsperada: 3 } },
      { url: '/api/escalas/scale-1', method: 'DELETE', body: { confirmar: true, revisaoEsperada: 4 } },
    ])
  })

  it('publica com e sem confirmação de pendências conforme a revisão', async () => {
    const { calls } = mockBackend(() => ({ body: { ...apiScale, escala: { ...apiScale.escala, status: 'publicada' } } }))
    await publishScale('scale-1', 5, true)
    await publishScale('scale-1', 6, false)

    expect(calls.map(({ url, method, body }) => ({ url, method, body }))).toEqual([
      {
        url: '/api/escalas/scale-1/publicar',
        method: 'POST',
        body: { revisaoEsperada: 5, confirmarPendencias: true },
      },
      {
        url: '/api/escalas/scale-1/publicar',
        method: 'POST',
        body: { revisaoEsperada: 6, confirmarPendencias: false },
      },
    ])
  })

  it('baixa o PDF geral sem parâmetros adicionais', async () => {
    const file = new Blob(['pdf content'], { type: 'application/pdf' })
    const { calls } = mockBackend(() => ({
      blob: file,
      headers: { 'Content-Disposition': 'attachment; filename="escala-geral.pdf"' },
    }))

    const result = await exportScalePdf('scale-1')

    expect(calls[0]).toMatchObject({ url: '/api/escalas/scale-1/pdf', method: 'GET' })
    expect(result).toEqual({ blob: file, filename: 'escala-geral.pdf' })
  })

  it('baixa o PDF separado por setor e respeita o nome enviado pela API', async () => {
    const file = new Blob(['pdf archive'], { type: 'application/zip' })
    const { calls } = mockBackend(() => ({
      blob: file,
      headers: { 'Content-Disposition': 'attachment; filename="escala-setores.zip"' },
    }))

    const result = await exportScalePdf('scale-1', { separarPorSetor: true })

    expect(calls[0]).toMatchObject({ url: '/api/escalas/scale-1/pdf?separarPorSetor=true', method: 'GET' })
    expect(result).toEqual({ blob: file, filename: 'escala-setores.zip' })
  })

  it('baixa o PDF de um setor específico', async () => {
    const file = new Blob(['sector pdf'], { type: 'application/pdf' })
    const { calls } = mockBackend(() => ({ blob: file }))

    await exportScalePdf('scale-1', { setorId: 'sector 1' })

    expect(calls[0]).toMatchObject({ url: '/api/escalas/scale-1/pdf?setorId=sector%201', method: 'GET' })
  })

  it('propaga respostas de erro da API com o status original', async () => {
    mockBackend(() => ({ status: 409, body: { message: 'A escala foi atualizada.' } }))
    const request = startReview('scale-1', 1)
    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
      status: 409,
      message: 'A escala foi atualizada.',
    })
  })

  it('mantém a promessa pendente enquanto aguarda a resposta, permitindo ao consumidor exibir carregamento', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() })
    let responder!: (response: { ok: boolean; status: number; json: () => Promise<unknown> }) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            responder = resolve
          }),
      ),
    )

    let concluida = false
    const requisicao = listScales(2026, 10).then((result) => {
      concluida = true
      return result
    })
    await Promise.resolve()
    expect(concluida).toBe(false)

    responder({ ok: true, status: 200, json: async () => [apiScale] })
    await requisicao
    expect(concluida).toBe(true)
  })
})
