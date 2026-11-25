import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScalePage, GenerationLoading, WorkloadSummary } from './ScalePage'
import { ExportScaleDrawer } from './ExportScaleDrawer'
import { GenerateScaleDialog } from './GenerateScaleDialog'
import { PublishScaleDialog } from './PublishScaleDialog'
import type { ScaleDetail } from '../../services/scales'

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

  it('stretches monthly day cards across each calendar grid column', () => {
    const markup = renderToStaticMarkup(<ScalePage />)

    expect(markup).toContain('min-h-44 w-full min-w-0')
  })

  it('shows unfulfilled regular shifts', () => {
    const markup = renderToStaticMarkup(<WorkloadSummary
      scale={{
        ...pendingScale,
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

    expect(markup).toContain('Pendências de carga horária')
    expect(markup).toContain('Rafael Rocha:')
    expect(markup).toContain('1 plantão(ões) de 24h e 1 plantão(ões) de 12h')

    const publishedMarkup = renderToStaticMarkup(<WorkloadSummary
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
    expect(coverageOnly).toContain('2 coberturas abaixo do mínimo')
    expect(coverageOnly).toContain('94 de 100 posições estão preenchidas.')
    expect(coverageOnly).toContain('Publicar com pendências')
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
    expect(informative).toContain('Avisos considerados na geração')
    expect(informative).toContain('Confirmar publicação')
  })
})
