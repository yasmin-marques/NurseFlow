import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SettingsPage } from './SettingsPage'

describe('settings period selection', () => {
  it('offers monthly configuration across the supported year range', () => {
    const markup = renderToStaticMarkup(<SettingsPage />)

    expect(markup).toContain('Período das regras mensais')
    expect(markup).toContain('type="month"')
    expect(markup).toContain('min="0001-01"')
    expect(markup).toContain('max="9999-12"')
    expect(markup).toContain('Plantões regulares de 24h para concursado')
    expect(markup).toContain('Plantões regulares de 12h para CLT')
  })
})
