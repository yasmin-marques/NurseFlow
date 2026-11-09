import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SettingsPage } from './SettingsPage'

describe('settings scope', () => {
  it('applies the rules to every month', () => {
    const markup = renderToStaticMarkup(<SettingsPage />)

    expect(markup).not.toContain('valem para todos os meses')
    expect(markup).not.toContain('type="month"')
    expect(markup).toContain('Plantões regulares de 24h para concursado')
    expect(markup).toContain('Plantões regulares de 12h para CLT')
  })
})
