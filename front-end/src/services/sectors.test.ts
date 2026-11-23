import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockBackend } from '../test/fetchMock'
import { createSector, listSectors, setSectorActive, updateSectorDetails, updateSectorMinimum } from './sectors'

afterEach(() => vi.unstubAllGlobals())

const apiSector = {
  id: 's1',
  nome: 'UTI',
  ativo: true,
  turnos: { diurno: { enfermeiros: 2, tecnicos: 4 }, noturno: { enfermeiros: 1, tecnicos: 3 } },
}

describe('services/sectors', () => {
  it('lista e mapeia setores com turnos diurno e noturno', async () => {
    mockBackend(() => ({ body: [apiSector] }))
    const [sector] = await listSectors()
    expect(sector).toMatchObject({ id: 's1', name: 'UTI', description: '', active: true })
    expect(sector.shifts.map((s) => [s.id, s.minimum])).toEqual([
      ['day', { nurses: 2, technicians: 4 }],
      ['night', { nurses: 1, technicians: 3 }],
    ])
  })

  it('cadastra setor convertendo quantitativos para o formato da API', async () => {
    mockBackend(() => ({ body: [apiSector] }))
    const [existing] = await listSectors()
    const { calls } = mockBackend(() => ({ body: apiSector }))
    await createSector({ name: 'UTI', description: '', shifts: existing.shifts })
    expect(calls[0]).toMatchObject({ url: '/api/setores', method: 'POST' })
    expect(calls[0].body).toEqual({
      nome: 'UTI',
      turnos: { diurno: { enfermeiros: 2, tecnicos: 4 }, noturno: { enfermeiros: 1, tecnicos: 3 } },
    })
  })

  it('edita apenas o turno informado (DA08)', async () => {
    const { calls } = mockBackend(() => ({ body: apiSector }))
    await updateSectorMinimum('s1', 'night', { nurses: 5, technicians: 6 })
    expect(calls[0]).toMatchObject({
      url: '/api/setores/s1',
      method: 'PATCH',
      body: { turnos: { noturno: { enfermeiros: 5, tecnicos: 6 } } },
    })
  })

  it('edita nome e descrição', async () => {
    const { calls } = mockBackend(() => ({ body: apiSector }))
    await updateSectorDetails('s1', { name: 'CTI', description: 'novo' })
    expect(calls[0].body).toEqual({ nome: 'CTI', descricao: 'novo' })
  })

  it('inativa e reativa pelas rotas dedicadas', async () => {
    const { calls } = mockBackend(() => ({ body: apiSector }))
    await setSectorActive('s1', false)
    await setSectorActive('s1', true)
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['PATCH', '/api/setores/s1/inativar'],
      ['PATCH', '/api/setores/s1/ativar'],
    ])
  })
})
