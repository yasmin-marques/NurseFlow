import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SideMenu } from './SideMenu'

describe('side menu account actions', () => {
  it('exposes profile navigation separately from signing out', () => {
    const markup = renderToStaticMarkup(
      <SideMenu
        activeItem="visao-geral"
        onProfileClick={() => undefined}
        onLogout={() => undefined}
        user={{ name: 'Ana Ribeiro', role: 'Enfermeiro', initials: 'AR' }}
      />,
    )

    expect(markup).toContain('aria-label="Abrir perfil de Ana Ribeiro"')
    expect(markup).toContain('aria-label="Sair da sessão"')
    expect(markup).toContain('title="Meu perfil"')
    expect(markup).not.toContain('aria-label="Sair (Ana Ribeiro)"')
  })
})
