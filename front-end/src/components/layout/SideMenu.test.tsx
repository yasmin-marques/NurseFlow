import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    expect(markup).toContain('aria-label="Sair"')
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

  it('makes the coordination logo navigate to the overview', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(
      <SideMenu
        activeItem="trocas"
        onNavigate={onNavigate}
        user={{ name: 'Ana', role: 'Coordenação', initials: 'A', isCoordination: true }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Ir para a visão geral' }))
    expect(onNavigate).toHaveBeenCalledWith('visao-geral')
  })

  it('renders the logout button as a stretched square and calls logout', async () => {
    const onLogout = vi.fn()
    const user = userEvent.setup()
    render(
      <SideMenu
        activeItem="visao-geral"
        onLogout={onLogout}
        user={{ name: 'Paloma Ferreira', role: 'Coordenação', initials: 'PF', isCoordination: true }}
      />,
    )

    const logout = screen.getByRole('button', { name: 'Sair' })
    expect(logout.getAttribute('title')).toBe('Sair')
    expect(logout.className).toContain('aspect-square')
    expect(logout.className).toContain('self-stretch')
    expect(logout.querySelector('svg')).not.toBeNull()
    await user.click(logout)
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('renders the coordination user avatar with a green border', () => {
    render(
      <SideMenu
        activeItem="visao-geral"
        user={{ name: 'Paloma Ferreira', role: 'Coordenação', initials: 'PF', isCoordination: true }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Abrir perfil de Paloma Ferreira' }).querySelector('[class*="border-primary"]')).not.toBeNull()
  })
})
