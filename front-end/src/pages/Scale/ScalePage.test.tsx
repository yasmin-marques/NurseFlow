import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScalePage, GenerationLoading } from './ScalePage'
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

  it('keeps only the reference actions in the scale page header and removes extra review panels', () => {
    const markup = renderToStaticMarkup(<ScalePage />)

    expect(markup).toContain('Exportar PDF')
    expect(markup).toContain('Gerar Escala Automaticamente')
    expect(markup).not.toContain('Adicionar plantão')
    expect(markup).not.toContain('Montar manualmente')
    expect(markup).not.toContain('Revisão por data e turno')
    expect(markup).not.toContain('Conflitos e alertas (')
    expect(markup).not.toContain('Cargas profissionais (')
    expect(markup).toContain('Navegação do calendário')
    expect(markup).not.toContain('Hoje')
  })

  it('stretches monthly day cards across each calendar grid column', () => {
    const markup = renderToStaticMarkup(<ScalePage />)

    expect(markup).toContain('min-h-[176px] w-full min-w-0')
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
  })
})
