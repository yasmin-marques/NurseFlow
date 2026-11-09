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

  it('shows the real supplied zero count and hides administrative navigation for professionals', () => {
    const coordination = renderToStaticMarkup(<SideMenu activeItem="trocas" exchangeCount={0} user={{ name: 'Ana', role: 'Coordenação', initials: 'A', isCoordination: true }} />)
    expect(coordination).toContain('aria-label="0 solicitações aguardando"')
    expect(coordination).toContain('>0</span>')
    const professional = renderToStaticMarkup(<SideMenu activeItem="visao-geral" exchangeCount={5} user={{ name: 'Bia', role: 'Enfermeiro', initials: 'B', isCoordination: false }} />)
    expect(professional).not.toContain('Trocas')
    expect(professional).not.toContain('5</span>')
  })
})
