import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ExchangesPage } from './ExchangesPage'

describe('exchanges page', () => {
  it('renders administrative tabs and period filters without fabricated requests', () => {
    const markup = renderToStaticMarkup(<ExchangesPage />)
    expect(markup).toContain('Solicitações de troca')
    expect(markup).toContain('Pendentes')
    expect(markup).toContain('Aprovadas')
    expect(markup).toContain('Recusadas')
    expect(markup).toContain('id="exchange-month"')
    expect(markup).toContain('id="exchange-year"')
    expect(markup).toContain('Carregando solicitações')
    expect(markup).not.toContain('Ana Ribeiro')
    expect(markup).not.toContain('Lucas Mendes')
    expect(markup).not.toContain('>3</span>')
  })
})
