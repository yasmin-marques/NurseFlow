import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NewSectorModal } from './NewSectorModal'

describe('NewSectorModal', () => {
  it('cadastra um único quantitativo mínimo para plantões de 24h', async () => {
    const onSave = vi.fn()
    render(<NewSectorModal onClose={vi.fn()} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('Ex.: Setor C'), { target: { value: 'UTI' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Cadastrar setor' }).closest('form')!)

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      name: 'UTI',
      description: '',
      minimum: { nurses: 2, technicians: 3 },
    }))
    expect(screen.getByText('Mínimo por plantão de 24h')).toBeTruthy()
    expect(screen.queryByText('Turno noturno')).toBeNull()
  })
})
