import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CoverageBadge, PersonCard, SelectionChip } from './ScaleComponents'
import { coverageSurfaceClass } from './coverageStyles'

describe('scale visual components', () => {
  it('renders selected and unselected selection chips accessibly', () => {
    const selected = renderToStaticMarkup(
      <SelectionChip checked onChange={() => undefined}>Setor A</SelectionChip>,
    )
    const unselected = renderToStaticMarkup(
      <SelectionChip checked={false} onChange={() => undefined}>Setor B</SelectionChip>,
    )

    expect(selected).toContain('checked=""')
    expect(selected).toContain('border-primary')
    expect(unselected).not.toContain('checked=""')
    expect(unselected).toContain('border-border')
  })

  it('uses distinct surfaces and badges for regular, warning, conflict, and empty coverage', () => {
    expect(coverageSurfaceClass('covered')).toContain('border-primary')
    expect(coverageSurfaceClass('restricted')).toContain('bg-warning')
    expect(coverageSurfaceClass('partial')).toContain('bg-warning')
    expect(coverageSurfaceClass('conflict')).toContain('bg-error')
    expect(coverageSurfaceClass('empty')).toContain('bg-white')
    expect(renderToStaticMarkup(<CoverageBadge state="conflict">Revisar cobertura</CoverageBadge>)).toContain('bg-error')
  })

  it('renders a person card with initials, details, status, and an action', () => {
    const markup = renderToStaticMarkup(
      <PersonCard name="Ana Ribeiro" detail="Enfermeiro" statusLabel="Baixa" statusTone="covered" action={<button>Remover</button>} />,
    )

    expect(markup).toContain('>AR</span>')
    expect(markup).toContain('Enfermeiro')
    expect(markup).toContain('Baixa')
    expect(markup).toContain('Remover')
  })
})
