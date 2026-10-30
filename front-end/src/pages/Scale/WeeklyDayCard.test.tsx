import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ScaleDetail } from '../../services/scales'
import { WeeklyDayCard } from './WeeklyDayCard'

const scale: ScaleDetail = {
  escala: {
    id: 'scale-1',
    ano: 2025,
    mes: 6,
    status: 'rascunho',
    revisao: 1,
    validacao: null,
    administradorId: 'admin-1',
    dataCriacao: '2025-06-01T00:00:00.000Z',
  },
  resumo: { plantoes: 1 },
  cobertura: null,
  configuracaoUtilizada: null,
  escopo: null,
  plantoes: [{
    id: 'shift-1',
    data: '2025-06-08',
    setor: { id: 'sector-1', nome: 'Emergência' },
    horarioInicio: '07:00',
    horarioFim: '07:00',
    duracaoHoras: 24,
    tipo: 'regular',
    profissionais: [{
      id: 'leader-1',
      nome: 'Ana Ribeiro',
      formacao: 'enfermeiro',
      vinculo: 'clt',
      lideranca: true,
      origemCobertura: 'regular',
    }],
  }],
  pendencias: [],
  conflitos: [],
  avisos: [],
  cargas: [],
}

describe('weekly day card presentation', () => {
  it('shows the date badge, month, coverage and edit action in a responsive header', () => {
    const markup = renderToStaticMarkup(
      <WeeklyDayCard date={new Date(2025, 5, 8)} dayScale={scale} onEdit={vi.fn()} />,
    )

    expect(markup).toContain('aria-label="domingo, 8 de junho"')
    expect(markup).toContain('bg-[#f7f8f6]')
    expect(markup).toContain('sm:flex-row')
    expect(markup).toContain('>8</span>')
    expect(markup).toContain('>dom</span>')
    expect(markup).toContain('Junho de 2025')
    expect(markup).toContain('Cobertura diária')
    expect(markup).toContain('Editar')
  })

  it('keeps the regular day clean and highlights the leadership section', () => {
    const markup = renderToStaticMarkup(
      <WeeklyDayCard date={new Date(2025, 5, 8)} dayScale={scale} />,
    )

    expect(markup).toContain('bg-soft-green p-4')
    expect(markup).toContain('ENFERMEIRO CHEFE · LIDERANÇA GERAL')
    expect(markup).not.toContain('role="alert"')
    expect(markup).not.toContain('Revisar cobertura')
  })

  it.each([
    ['pendência de cobertura', {
      ...scale,
      pendencias: [{
        setorId: 'sector-1',
        setor: 'Emergência',
        data: '2025-06-08',
        turno: 'diurno' as const,
        funcao: 'tecnicos' as const,
        necessario: 3,
        alocado: 2,
        faltam: 1,
        motivo: 'Abaixo do mínimo',
      }],
    }],
    ['conflito', {
      ...scale,
      conflitos: [{
        tipo: 'DESCANSO',
        motivo: 'Descanso insuficiente',
        data: '2025-06-08',
      }],
    }],
  ])('shows a red coverage warning for a day with a %s', (_description, conflictingScale) => {
    const markup = renderToStaticMarkup(
      <WeeklyDayCard date={new Date(2025, 5, 8)} dayScale={conflictingScale} />,
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('bg-error')
    expect(markup).toContain('Irregularidade na cobertura')
    expect(markup).toContain('Revisar cobertura')
    expect(markup).toContain('bg-soft-green p-4')
    expect(markup).toContain('Ana Ribeiro')
  })
})
