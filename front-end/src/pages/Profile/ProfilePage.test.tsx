// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const { getUserProfile, updateUserProfile } = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
}))
vi.mock('../../services/profile', () => ({ getUserProfile, updateUserProfile }))

const baseProfile = {
  id: 'user-1',
  nome: 'Ana Ribeiro',
  email: 'ana@example.test',
  perfil: 'enfermeiro',
  coren: 'COREN 123',
  formacao: 'enfermeiro',
  tipoVinculo: 'concursado',
  proximoSetor: 'UTI',
  recebeNotificacoesEscala: true,
}

describe('profile modal', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    vi.clearAllMocks()
    getUserProfile.mockResolvedValue(baseProfile)
    updateUserProfile.mockImplementation(async (input) => ({ ...baseProfile, ...input }))
  })

  it('renders as a dialog over the existing view and closes by X, overlay, and Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ProfilePage user={baseProfile} onClose={onClose} onUserUpdated={() => undefined} onLogout={() => undefined} />)

    const dialog = await screen.findByRole('dialog', { name: 'Ana Ribeiro' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    await user.click(within(dialog).getByRole('button', { name: 'Fechar perfil' }))
    expect(onClose).toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('saves and cancels email inline, including Enter and Escape', async () => {
    const user = userEvent.setup()
    render(<ProfilePage user={baseProfile} onClose={() => undefined} onUserUpdated={() => undefined} onLogout={() => undefined} />)
    await screen.findByText('ana@example.test')
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const input = screen.getByRole('textbox', { name: 'E-mail' })
    await user.clear(input)
    await user.type(input, 'nova@example.test')
    await user.keyboard('{Enter}')
    await screen.findByText('nova@example.test')
    expect(updateUserProfile).toHaveBeenCalledWith({ email: 'nova@example.test' })

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.clear(screen.getByRole('textbox', { name: 'E-mail' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'E-mail' })).toBeNull()
  })

  it('shows validation or API errors below the email field', async () => {
    const user = userEvent.setup()
    updateUserProfile.mockRejectedValueOnce(new Error('E-mail inválido'))
    render(<ProfilePage user={baseProfile} onClose={() => undefined} onUserUpdated={() => undefined} onLogout={() => undefined} />)
    await screen.findByText('ana@example.test')
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const input = screen.getByRole('textbox', { name: 'E-mail' })
    await user.clear(input)
    await user.type(input, 'errado@example.test')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect((await screen.findByRole('alert')).textContent).toContain('E-mail inválido')
  })

  it('keeps logout as a distinct action', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(<ProfilePage user={baseProfile} onClose={() => undefined} onUserUpdated={() => undefined} onLogout={onLogout} />)
    await screen.findByRole('button', { name: 'Sair' })
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onLogout).toHaveBeenCalled()
  })

  it('shows a decorative active bell icon beside the active notification state', async () => {
    render(<ProfilePage user={baseProfile} onClose={() => undefined} onUserUpdated={() => undefined} onLogout={() => undefined} />)
    const activeText = await screen.findByText('Ativas')
    const value = activeText.closest('dd')!
    const icon = value.querySelector('svg')!
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.getAttribute('class')).toContain('text-primary')
  })

  it('shows a decorative BellOff icon beside the disabled notification state', async () => {
    getUserProfile.mockResolvedValueOnce({ ...baseProfile, recebeNotificacoesEscala: false })
    render(<ProfilePage user={baseProfile} onClose={() => undefined} onUserUpdated={() => undefined} onLogout={() => undefined} />)
    const disabledText = await screen.findByText('Desativadas')
    const value = disabledText.closest('dd')!
    const icon = value.querySelector('svg')!
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.getAttribute('class')).toContain('text-text-muted')
  })

  it('renders the profile avatar with a 64px size and green border', async () => {
    render(<ProfilePage user={baseProfile} onClose={() => undefined} onUserUpdated={() => undefined} onLogout={() => undefined} />)
    const name = await screen.findByRole('heading', { name: 'Ana Ribeiro' })
    const avatar = name.closest('div')?.previousElementSibling
    expect(avatar?.getAttribute('class')).toContain('size-16')
    expect(avatar?.getAttribute('class')).toContain('border-primary/50')
  })
})
