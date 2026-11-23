import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScaleReview } from './ScaleReview'
import type { ScaleDetail } from '../../services/scales'

const scale: ScaleDetail = {
  escala: {
    id: 'scale-1',
    ano: 2026,
    mes: 6,
    status: 'em_revisao',
    revisao: 2,
    validacao: null,
    administradorId: 'admin-1',
    dataCriacao: '2026-06-01T00:00:00.000Z',
  },
  resumo: { plantoes: 1 },
  cobertura: null,
  configuracaoUtilizada: null,
  escopo: null,
  plantoes: [{
    id: 'shift-1',
    data: '2026-06-08',
    setor: { id: 'sector-1', nome: 'Setor A' },
    horarioInicio: '07:00',
    horarioFim: '19:00',
    duracaoHoras: 12,
    tipo: 'regular',
    profissionais: [
      { id: 'nurse-1', nome: 'Rafael Rocha', formacao: 'enfermeiro', vinculo: 'clt', lideranca: true, origemCobertura: 'regular' },
      { id: 'tech-1', nome: 'Bianca Silva', formacao: 'tecnico', vinculo: 'clt', lideranca: false, origemCobertura: 'regular' },
    ],
  }],
  pendencias: [],
  conflitos: [],
  avisos: [],
  cargas: [],
}

describe('ScaleReview', () => {
  it('identifies the chief nurse on the shift and keeps the remaining team distinct', () => {
    const markup = renderToStaticMarkup(<ScaleReview scale={scale} onEdit={() => undefined} />)

    expect(markup).toContain('Enfermeiro chefe: Rafael Rocha')
    expect(markup).toContain('Técnico:')
    expect(markup).toContain('Bianca Silva')
  })

  it('explicitly reports when a 24h shift has no chief nurse and omits it for 12h shifts', () => {
    const withoutLeader = {
      ...scale,
      plantoes: [{
        ...scale.plantoes[0],
        duracaoHoras: 24,
        profissionais: scale.plantoes[0].profissionais.map((professional) => ({ ...professional, lideranca: false })),
      }],
    }
    const markup = renderToStaticMarkup(<ScaleReview scale={withoutLeader} onEdit={() => undefined} />)

    expect(markup).toContain('Nenhum enfermeiro chefe escalado')

    const shift12h = { ...withoutLeader, plantoes: [{ ...withoutLeader.plantoes[0], duracaoHoras: 12 }] }
    expect(renderToStaticMarkup(<ScaleReview scale={shift12h} onEdit={() => undefined} />)).not.toContain('enfermeiro chefe')
  })
})
