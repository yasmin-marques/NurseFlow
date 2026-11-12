import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProfilePage } from './ProfilePage'

describe('profile page', () => {
  it('shows only the authenticated user data and a localized access profile', () => {
    const markup = renderToStaticMarkup(
      <ProfilePage
        user={{
          id: 'user-1',
          nome: 'Ana Ribeiro',
          email: 'ana@example.test',
          perfil: 'enfermeiro',
        }}
        onClose={() => undefined}
        onUserUpdated={() => undefined}
        onLogout={() => undefined}
      />,
    )

    expect(markup).toContain('Ana Ribeiro')
    expect(markup).toContain('ana@example.test')
    expect(markup).toContain('Enfermeiro')
    expect(markup).toContain('Vínculo')
    expect(markup).toContain('Próximo setor')
    expect(markup).toContain('COREN')
    expect(markup).not.toContain('Jornada')
    expect(markup).not.toContain('user-1')
    expect(markup).toContain('Editar')
  })

  it('shows account-specific information for coordination profiles', () => {
    const markup = renderToStaticMarkup(
      <ProfilePage
        user={{
          id: 'user-3',
          nome: 'Coordenação',
          email: 'coord@example.test',
          perfil: 'coordenacao',
        }}
        onClose={() => undefined}
        onUserUpdated={() => undefined}
        onLogout={() => undefined}
      />,
    )

    expect(markup).toContain('Notificações')
    expect(markup).toContain('Perfil')
    expect(markup).not.toContain('COREN')
  })

  it('does not render a fabricated profile when the session data is empty', () => {
    const markup = renderToStaticMarkup(
      <ProfilePage
        user={{ id: 'user-2', nome: '', email: '', perfil: '' }}
        onClose={() => undefined}
        onUserUpdated={() => undefined}
        onLogout={() => undefined}
      />,
    )

    expect(markup).not.toContain('Paloma Ferreira')
    expect(markup).not.toContain('admin@nurseflow.test')
  })
})
