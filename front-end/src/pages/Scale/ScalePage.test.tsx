import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScalePage, GenerationLoading, ScaleWarnings } from './ScalePage'
import { ExportScaleDrawer } from './ExportScaleDrawer'
import { GenerateScaleDialog } from './GenerateScaleDialog'
import { PublishScaleDialog } from './PublishScaleDialog'
import type { ScaleDetail } from '../../services/scales'
import * as scalesService from '../../services/scales'

const pendingScale: ScaleDetail = {
  escala: {
    id: 'scale-1',
    ano: 2025,
    mes: 6,
    status: 'validada',
    revisao: 2,
    validacao: null,
    administradorId: 'admin-1',
    dataCriacao: '2025-06-01T00:00:00.000Z',
  },
  resumo: { plantoes: 20 },
  cobertura: { posicoesExigidas: 100, posicoesPreenchidas: 94, percentual: 94 },
  configuracaoUtilizada: null,
  escopo: null,
  plantoes: [],
  pendencias: [{
    setorId: 'sector-1',
    setor: 'Setor A',
    data: '2025-06-08',
    turno: 'diurno',
    funcao: 'tecnicos',
    necessario: 3,
    alocado: 2,
    faltam: 1,
    motivo: 'Abaixo do mínimo',
  }, {
    setorId: 'sector-2',
    setor: 'Setor B',
    data: '2025-06-09',
    turno: 'noturno',
    funcao: 'tecnicos',
    necessario: 3,
    alocado: 2,
    faltam: 1,
    motivo: 'Abaixo do mínimo',
  }],
  conflitos: [],
  avisos: [],
  cargas: [],
}

describe('scale page loading presentation', () => {
  it('renders the generation reference text and progress chips', () => {
    const markup = renderToStaticMarkup(<GenerationLoading />)

    expect(markup).toContain('Gerando a escala...')
    expect(markup).toContain('Verificando profissionais disponíveis, restrições, descansos, setores, lideranças, extras e cobertura mínima.')
    expect(markup).toContain('Disponibilidade')
    expect(markup).toContain('Restrições')
    expect(markup).toContain('Cobertura por setor')
    expect(markup).not.toContain('progressbar')
  })

  it('keeps PDF export hidden without a published scale and places workflow above the calendar', () => {
    const markup = renderToStaticMarkup(<ScalePage />)

    expect(markup).not.toContain('Exportar PDF')
    expect(markup).not.toContain('Gerar Escala Automaticamente')
    expect(markup).toContain('Configurar geração')
    expect(markup.indexOf('aria-label="Fluxo da escala"')).toBeLessThan(markup.indexOf('aria-label="Calendário da escala"'))
    expect(markup).not.toContain('Adicionar plantão')
    expect(markup).not.toContain('Revisão por data e turno')
    expect(markup).not.toContain('Conflitos e alertas (')
    expect(markup).not.toContain('Cargas profissionais (')
    expect(markup).toContain('Navegação do calendário')
    expect(markup).not.toContain('Hoje')
  })

  it('offers manual draft creation when the selected period has no scale', () => {
    const markup = renderToStaticMarkup(<ScalePage />)

    expect(markup).toContain('Montar manualmente')
  })

  it('starts a review before showing weekly edit actions for a published scale', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const publishedScale: ScaleDetail = {
      ...pendingScale,
      escala: {
        ...pendingScale.escala,
        ano: now.getFullYear(),
        mes: now.getMonth() + 1,
        status: 'publicada',
        revisao: 3,
        versaoPublicada: 2,
      },
    }
    const revisionScale: ScaleDetail = {
      ...publishedScale,
      escala: { ...publishedScale.escala, status: 'em_revisao', revisao: 4 },
    }
    const listScales = vi.spyOn(scalesService, 'listScales').mockResolvedValue([publishedScale])
    const startReview = vi.spyOn(scalesService, 'startReview').mockResolvedValue(revisionScale)

    try {
      render(<ScalePage />)
      await user.click(await screen.findByRole('button', { name: 'Editar escala' }))

      expect(startReview).toHaveBeenCalledWith(publishedScale.escala.id, publishedScale.escala.revisao)
      expect(await screen.findAllByRole('button', { name: 'Editar' })).not.toHaveLength(0)
    } finally {
      listScales.mockRestore()
      startReview.mockRestore()
    }
  })

  it('stretches monthly day cards across each calendar grid column', () => {
    const markup = renderToStaticMarkup(<ScalePage />)

    expect(markup).toContain('min-h-44 w-full min-w-0')
  })

  it('groups workload, rest, and sector coverage warnings in collapsed dropdowns', () => {
    const nurse = {
      id: 'nurse-1',
      nome: 'Rafael Rocha',
      formacao: 'enfermeiro' as const,
      vinculo: 'clt' as const,
      lideranca: false,
      origemCobertura: 'regular' as const,
    }
    const shifts: ScaleDetail['plantoes'] = [{
      id: 'shift-1',
      data: '2025-06-01',
      setor: { id: 'sector-1', nome: 'Setor A' },
      horarioInicio: '07:00',
      horarioFim: '07:00',
      duracaoHoras: 24,
      tipo: 'regular',
      profissionais: [nurse],
    }, {
      id: 'shift-2',
      data: '2025-06-04',
      setor: { id: 'sector-1', nome: 'Setor A' },
      horarioInicio: '07:00',
      horarioFim: '19:00',
      duracaoHoras: 12,
      tipo: 'regular',
      profissionais: [nurse],
    }]
    const markup = renderToStaticMarkup(<ScaleWarnings
      scale={{
        ...pendingScale,
        plantoes: shifts,
        conflitos: [{
          tipo: 'DESCANSO_MES_ANTERIOR',
          profissionalId: 'nurse-1',
          profissional: 'Rafael Rocha',
          motivo: 'Descanso obrigatório de plantões do mês anterior.',
        }],
        cargas: [{
          profissionalId: 'nurse-1',
          profissional: 'Rafael Rocha',
          vinculo: 'clt',
          esperada: { plantoes24h: 3, plantoes12h: 2 },
          atribuida: { plantoes24h: 2, plantoes12h: 1 },
          faltam: { plantoes24h: 1, plantoes12h: 1 },
          extras: 0,
        }],
      }}
    />)

    expect(markup).toContain('Avisos da escala')
    expect(markup).toContain('Profissionais abaixo da carga regular (1)')
    expect(markup).toContain('Rafael Rocha:')
    expect(markup).toContain('1 plantão(ões) de 24h e 1 plantão(ões) de 12h')
    expect(markup).toContain('Profissionais com alerta de descanso (2)')
    expect(markup).toContain('Folga de 48h')
    expect(markup).toContain('Setores abaixo do mínimo por dia (2)')
    expect(markup).toContain('Setor A')

    const revisionMarkup = renderToStaticMarkup(<ScaleWarnings
      scale={{
        ...pendingScale,
        escala: { ...pendingScale.escala, status: 'em_revisao', versaoPublicada: 1 },
        cargas: [{
          profissionalId: 'nurse-1',
          profissional: 'Rafael Rocha',
          vinculo: 'clt',
          esperada: { plantoes24h: 1, plantoes12h: 0 },
          atribuida: { plantoes24h: 0, plantoes12h: 0 },
          faltam: { plantoes24h: 1, plantoes12h: 0 },
          extras: 0,
        }],
      }}
    />)
    expect(revisionMarkup).toContain('Avisos da escala')

    const publishedMarkup = renderToStaticMarkup(<ScaleWarnings
      scale={{
        ...pendingScale,
        escala: { ...pendingScale.escala, status: 'publicada', versaoPublicada: 1 },
        cargas: [{
          profissionalId: 'nurse-1',
          profissional: 'Rafael Rocha',
          vinculo: 'clt',
          esperada: { plantoes24h: 3, plantoes12h: 2 },
          atribuida: { plantoes24h: 2, plantoes12h: 1 },
          faltam: { plantoes24h: 1, plantoes12h: 1 },
          extras: 0,
        }],
      }}
    />)
    expect(publishedMarkup).not.toContain('Profissionais abaixo da carga regular')
  })

  it('paginates warning lists ten items at a time', async () => {
    const user = userEvent.setup()
    const cargas = Array.from({ length: 11 }, (_, index) => ({
      profissionalId: `professional-${index + 1}`,
      profissional: `Profissional ${String(index + 1).padStart(2, '0')}`,
      vinculo: 'clt',
      esperada: { plantoes24h: 1, plantoes12h: 0 },
      atribuida: { plantoes24h: 0, plantoes12h: 0 },
      faltam: { plantoes24h: 1, plantoes12h: 0 },
      extras: 0,
    }))
    render(<ScaleWarnings scale={{ ...pendingScale, pendencias: [], cargas }} />)

    await user.click(screen.getByText('Avisos da escala'))
    await user.click(screen.getByText('Profissionais abaixo da carga regular (11)'))
    expect(screen.getByText('Profissional 01:')).toBeTruthy()
    expect(screen.getByText('Profissional 10:')).toBeTruthy()
    expect(screen.queryByText('Profissional 11:')).toBeNull()
    expect(screen.getByText('Página 1 de 2')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Próxima página: profissionais abaixo da carga regular' }))
    expect(screen.getByText('Profissional 11:')).toBeTruthy()
    expect(screen.queryByText('Profissional 01:')).toBeNull()
    expect(screen.getByText('Página 2 de 2')).toBeTruthy()
  })

  it('renders the generation and export drawers with the reference actions and labels', () => {
    const generation = renderToStaticMarkup(
      <GenerateScaleDialog
        initialDate={new Date(2025, 5, 1)}
        onClose={() => undefined}
        onGenerated={() => undefined}
        onGeneratingChange={() => undefined}
      />,
    )
    const exportDrawer = renderToStaticMarkup(
      <ExportScaleDrawer
        monthLabel="Junho de 2025"
        exporting={false}
        error=""
        onClose={() => undefined}
        onExport={() => undefined}
      />,
    )

    expect(generation).toContain('Configurar geração automática')
    expect(generation).toContain('Data inicial')
    expect(generation).toContain('Data final')
    expect(generation).toContain('Turnos aplicáveis')
    expect(generation).toContain('24 horas')
    expect(generation).toContain('Gerar Escala')
    expect(exportDrawer).toContain('Escala geral de junho')
    expect(exportDrawer).toContain('Por setor')
    expect(exportDrawer).toContain('Gerar um arquivo para cada setor.')
    expect(exportDrawer).toContain('Gerar PDF')
  })

  it('renders the coverage-warning publication state and blocks unrelated conflicts', () => {
    const coverageOnly = renderToStaticMarkup(
      <PublishScaleDialog scale={pendingScale} onClose={() => undefined} onPublished={() => undefined} />,
    )
    const blocked = renderToStaticMarkup(
      <PublishScaleDialog
        scale={{ ...pendingScale, conflitos: [{ tipo: 'DESCANSO', motivo: 'Descanso insuficiente' }] }}
        onClose={() => undefined}
        onPublished={() => undefined}
      />,
    )

    expect(coverageOnly).toContain('94%')
    expect(coverageOnly).toContain('Escala com pontos para revisar')
    expect(coverageOnly).toContain('94 de 100 posições estão preenchidas.')
    expect(coverageOnly).toContain('Publicar com pendências')
    expect(coverageOnly).not.toContain('coberturas abaixo do mínimo')
    expect(coverageOnly).not.toContain('Revise os setores e turnos')
    expect(coverageOnly).not.toContain('restrições')
    expect(coverageOnly).not.toContain('Dois enfermeiros estão garantidos')
    expect(coverageOnly).not.toContain('três técnicos por turno')
    expect(renderToStaticMarkup(
      <PublishScaleDialog
        scale={{ ...pendingScale, pendencias: [], cobertura: { posicoesExigidas: 100, posicoesPreenchidas: 100, percentual: 100 } }}
        onClose={() => undefined}
        onPublished={() => undefined}
      />,
    )).toContain('100 de 100 posições estão preenchidas.')
    expect(blocked).toContain('Conflitos que impedem a publicação')
    expect(blocked).toContain('disabled=""')
    expect(blocked).not.toContain('Publicar com pendências')

    const informative = renderToStaticMarkup(
      <PublishScaleDialog
        scale={{
          ...pendingScale,
          pendencias: [],
          cobertura: { posicoesExigidas: 100, posicoesPreenchidas: 100, percentual: 100 },
          conflitos: [
            { tipo: 'PROFISSIONAL_INDISPONIVEL', motivo: 'Status "ferias": não participa desta geração.' },
            { tipo: 'PROFISSIONAL_INDISPONIVEL', motivo: 'Status "afastado": não participa desta geração.' },
          ],
        }}
        onClose={() => undefined}
        onPublished={() => undefined}
      />,
    )
    expect(informative).not.toContain('Conflitos que impedem a publicação')
    expect(informative).not.toContain('Avisos considerados na geração')
    expect(informative).not.toContain('restrições')
    expect(informative).not.toContain('não participa desta geração')
    expect(informative).toContain('Confirmar publicação')
  })
})
