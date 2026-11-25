// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthPeriodNavigation } from './MonthPeriodNavigation'

describe('MonthPeriodNavigation', () => {
  it('renders controls in the month navigation order', () => {
    const { container } = render(
      <MonthPeriodNavigation
        selectedDate={new Date(2026, 10, 1)}
        onChange={() => undefined}
        yearAriaLabel="Ano das solicitações"
      />,
    )

    const navigation = container.firstElementChild!
    expect(navigation.className).toContain('gap-2')
    expect(navigation.children).toHaveLength(4)
    expect(navigation.children[0].getAttribute('aria-label')).toBe('Mês anterior')
    expect(navigation.children[1].textContent).toBe('Novembro de 2026')
    expect(navigation.children[2].getAttribute('aria-label')).toBe('Próximo mês')
    const yearSelect = navigation.children[3].querySelector('select')!
    expect(yearSelect.getAttribute('aria-label')).toBe('Ano das solicitações')
    expect(yearSelect.className).toContain('appearance-none')
    expect(yearSelect.className).toContain('pr-9')
  })

  it('moves from December to January and from January to December with the year', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <MonthPeriodNavigation
        selectedDate={new Date(2026, 11, 1)}
        onChange={onChange}
        yearAriaLabel="Ano das solicitações"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(onChange).toHaveBeenLastCalledWith(new Date(2027, 0, 1))

    rerender(
      <MonthPeriodNavigation
        selectedDate={new Date(2026, 0, 1)}
        onChange={onChange}
        yearAriaLabel="Ano das solicitações"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(onChange).toHaveBeenLastCalledWith(new Date(2025, 11, 1))
  })

  it('keeps the selected month when the year changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MonthPeriodNavigation
        selectedDate={new Date(2026, 5, 1)}
        onChange={onChange}
        yearAriaLabel="Ano das solicitações"
      />,
    )

    await user.selectOptions(screen.getByLabelText('Ano das solicitações'), '2028')
    expect(onChange).toHaveBeenCalledWith(new Date(2028, 5, 1))
  })
})
