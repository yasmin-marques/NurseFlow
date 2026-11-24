import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NewSectorModal } from './NewSectorModal'
import { validateSectorForm } from '../sectorForm'
import type { Sector } from '../types'

const submit = () => fireEvent.submit(screen.getByRole('button', { name: /Cadastrar setor|Salvar alterações/ }).closest('form')!)
const name = (value: string) => fireEvent.change(screen.getByPlaceholderText('Ex.: Setor C'), { target: { value } })

describe('NewSectorModal', () => {
  it('cadastra um único quantitativo mínimo para plantões de 24h', async () => {
    const onSave = vi.fn()
    render(<NewSectorModal onClose={vi.fn()} onSave={onSave} />)

    name('UTI')
    submit()

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      name: 'UTI',
      description: '',
      minimum: { nurses: 2, technicians: 3 },
    }))
    expect(screen.getByText('Mínimo por plantão de 24h')).toBeTruthy()
    expect(screen.queryByText('Turno noturno')).toBeNull()
  })

  it('ao marcar "possui subsetores" oculta o mínimo de técnicos do setor e mostra a área de subsetores', () => {
    render(<NewSectorModal onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'técnicos por plantão de 24 horas' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Subsetores' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
    expect(screen.queryByRole('group', { name: 'técnicos por plantão de 24 horas' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Subsetores' })).toBeTruthy()
    expect(screen.getByLabelText('Nome do subsetor 1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Não' }))
    expect(screen.getByRole('group', { name: 'técnicos por plantão de 24 horas' })).toBeTruthy()
  })

  it('cadastra setor com vários subsetores (adiciona, edita e remove antes de salvar)', async () => {
    const onSave = vi.fn()
    render(<NewSectorModal onClose={vi.fn()} onSave={onSave} />)
    name('UTI')
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
    fireEvent.change(screen.getByLabelText('Nome do subsetor 1'), { target: { value: 'UTI Adulto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar técnicos do subsetor 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar subsetor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar subsetor' }))
    fireEvent.change(screen.getByLabelText('Nome do subsetor 2'), { target: { value: 'Descartado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remover subsetor Descartado' }))
    fireEvent.change(screen.getByLabelText('Nome do subsetor 2'), { target: { value: 'UTI Neo' } })
    submit()

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      name: 'UTI',
      description: '',
      minimum: { nurses: 2, technicians: null },
      subsectors: [
        { name: 'UTI Adulto', description: '', minimumTechnicians: 2 },
        { name: 'UTI Neo', description: '', minimumTechnicians: 1 },
      ],
    }))
  })

  it('não salva setor com subsetores sem subsetor ou com nomes duplicados', async () => {
    const onSave = vi.fn()
    render(<NewSectorModal onClose={vi.fn()} onSave={onSave} />)
    name('UTI')
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remover subsetor 1' }))
    submit()
    expect((await screen.findByRole('alert')).textContent).toMatch(/pelo menos um subsetor/)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar subsetor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar subsetor' }))
    fireEvent.change(screen.getByLabelText('Nome do subsetor 1'), { target: { value: 'Ala Norte' } })
    fireEvent.change(screen.getByLabelText('Nome do subsetor 2'), { target: { value: ' ala  norte ' } })
    submit()
    expect((await screen.findByRole('alert')).textContent).toMatch(/repetir o nome/)
    expect(onSave).not.toHaveBeenCalled()
  })

  const sector: Sector = {
    id: 's1', name: 'UTI', description: 'Intensiva', active: true, hasSubsectors: true,
    minimum: { nurses: 2, technicians: null }, techniciansWithoutSubsector: 0,
    subsectors: [
      { id: 'u1', sectorId: 's1', name: 'UTI Adulto', description: '', active: true, minimumTechnicians: 2 },
      { id: 'u2', sectorId: 's1', name: 'UTI Neo', description: '', active: true, minimumTechnicians: 1 },
    ],
  }

  it('na edição carrega os dados e subsetores cadastrados; remover inativa o subsetor existente', async () => {
    const onSaveEdit = vi.fn()
    render(<NewSectorModal sector={sector} onClose={vi.fn()} onSaveEdit={onSaveEdit} />)
    expect((screen.getByPlaceholderText('Ex.: Setor C') as HTMLInputElement).value).toBe('UTI')
    expect((screen.getByLabelText('Nome do subsetor 1') as HTMLInputElement).value).toBe('UTI Adulto')
    expect((screen.getByRole('button', { name: 'Não' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Remover subsetor UTI Neo' }))
    expect(screen.getByText(/será inativado ao salvar/)).toBeTruthy()
    submit()
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledTimes(1))
    const form = onSaveEdit.mock.calls[0][0]
    expect(form.subsectors.map((s: { id: string; removed?: boolean }) => [s.id, Boolean(s.removed)])).toEqual([['u1', false], ['u2', true]])
  })

  it('validateSectorForm aceita apenas inteiros não negativos', () => {
    const base = { name: 'UTI', description: '', nurses: 1, technicians: 1, hasSubsectors: false, subsectors: [] }
    expect(validateSectorForm(base)).toBe('')
    expect(validateSectorForm({ ...base, nurses: -1 })).toMatch(/inteiros não negativos/)
    expect(validateSectorForm({ ...base, technicians: 1.5 })).toMatch(/inteiros não negativos/)
    expect(validateSectorForm({ ...base, name: ' ' })).toMatch(/nome do setor/)
  })
})
