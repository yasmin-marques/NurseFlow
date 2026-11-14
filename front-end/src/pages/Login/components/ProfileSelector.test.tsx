import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProfileSelector } from './ProfileSelector'

describe('ProfileSelector', () => {
  it('uses the API profile identifier when the technician profile is selected', () => {
    const onChange = vi.fn()

    render(<ProfileSelector value="enfermeiro" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Técnico/ }))

    expect(onChange).toHaveBeenCalledWith('tecnico')
  })
})
