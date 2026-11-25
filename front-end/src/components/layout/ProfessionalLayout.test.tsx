// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfessionalLayout } from './ProfessionalLayout'
import userEvent from '@testing-library/user-event'
import { CountBadge } from '../ui/CountBadge'

vi.mock('../../services/my-shifts', () => ({ getIncomingExchangeCount: vi.fn().mockResolvedValue({ recebidas: 1 }) }))
vi.mock('./NotificationCenter', () => ({ NotificationCenter: () => <div /> }))

afterEach(() => cleanup())
beforeEach(() => vi.clearAllMocks())

describe('ProfessionalLayout', () => {
  it('renders count badges as circles, 99+ for large counts, and hides zero', () => {
    const { rerender } = render(<CountBadge count={1} />)
    const one = screen.getByText('1').parentElement!
    expect(one.className).toContain('h-[18px]')
    expect(one.className).toContain('w-[18px]')
    expect(one.className).toContain('rounded-full')
    expect(one.className).toContain('text-[10px]')
    expect(one.className).toContain('font-bold')
    expect(one.className).not.toContain('tabular-nums')
    expect(one.className).toContain('items-center')
    expect(one.className).toContain('justify-center')
    expect(one.className).toContain('leading-[1]')
    expect(one.className).toContain('px-0')
    expect(one.className).not.toContain('px-1.5')

    rerender(<CountBadge count={125} />)
    const large = screen.getByText('99+')
    expect(large.textContent).toBe('99+')
    expect(large.parentElement!.className).toContain('text-[10px]')
    expect(large.parentElement!.className).toContain('font-bold')
    expect(large.parentElement!.className).not.toContain('tabular-nums')
    expect(large.parentElement!.className).toContain('px-1.5')

    rerender(<CountBadge count={0} />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('renders the pending exchange badge to the right of Trocas', async () => {
    render(
      <ProfessionalLayout
        activeTab="trocas"
        onNavigate={() => undefined}
        onProfileClick={() => undefined}
        user={{ name: 'Ana Ribeiro', role: 'Enfermeiro', initials: 'AR' }}
      >
        <div />
      </ProfessionalLayout>,
    )

    const trocas = await screen.findByRole('button', { name: 'Trocas 1' })
    expect(trocas.textContent).toBe('Trocas1')
  })

  it('removes the header search and title while keeping the logo navigation', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(
      <ProfessionalLayout
        activeTab="trocas"
        onNavigate={onNavigate}
        onProfileClick={() => undefined}
        user={{ name: 'Ana Ribeiro', role: 'Enfermeiro', initials: 'AR' }}
      >
        <h1>Conteúdo da página</h1>
      </ProfessionalLayout>,
    )

    expect(screen.queryByRole('button', { name: 'Abrir pesquisa' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Trocas', level: 1 })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ir para a visão geral' }))
    expect(onNavigate).toHaveBeenCalledWith('inicio')
  })

  it('renders the logged-in professional avatar with a green border', () => {
    render(
      <ProfessionalLayout
        activeTab="inicio"
        onNavigate={() => undefined}
        onProfileClick={() => undefined}
        user={{ name: 'Ana Ribeiro', role: 'Enfermeiro', initials: 'AR' }}
      >
        <div />
      </ProfessionalLayout>,
    )

    const profileButton = screen.getByRole('button', { name: /Abrir meu perfil — Ana Ribeiro/ })
    expect(profileButton.querySelector('[class*="border-primary"]')).not.toBeNull()
  })
})
