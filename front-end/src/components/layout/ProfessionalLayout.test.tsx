// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfessionalLayout } from './ProfessionalLayout'

vi.mock('../../services/my-shifts', () => ({ getIncomingExchangeCount: vi.fn().mockResolvedValue({ recebidas: 1 }) }))
vi.mock('./NotificationCenter', () => ({ NotificationCenter: () => <div /> }))

afterEach(() => cleanup())
beforeEach(() => vi.clearAllMocks())

describe('ProfessionalLayout', () => {
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
})
