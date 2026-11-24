import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockBackend } from '../test/fetchMock'
import { createSector, listSectors, saveSectorForm, setSectorActive, updateSectorDetails, updateSectorMinimum } from './sectors'

afterEach(() => vi.unstubAllGlobals())

const apiSector = {
  id: 's1',
  nome: 'UTI',
  ativo: true,
  plantao24h: { enfermeiros: 2, tecnicos: 4 },
}

describe('services/sectors', () => {
  it('lista e mapeia quantitativo único por plantão de 24h', async () => {
    mockBackend(() => ({ body: [apiSector] }))
    const [sector] = await listSectors()
    expect(sector).toMatchObject({ id: 's1', name: 'UTI', description: '', active: true })
    expect(sector.minimum).toEqual({ nurses: 2, technicians: 4 })
  })

  it('cadastra setor convertendo quantitativos para o formato da API', async () => {
    mockBackend(() => ({ body: [apiSector] }))
    const [existing] = await listSectors()
    const { calls } = mockBackend(() => ({ body: apiSector }))
    await createSector({ name: 'UTI', description: '', minimum: existing.minimum })
    expect(calls[0]).toMatchObject({ url: '/api/setores', method: 'POST' })
    expect(calls[0].body).toEqual({
      nome: 'UTI',
      plantao24h: { enfermeiros: 2, tecnicos: 4 },
    })
  })

  it('atualiza o quantitativo único de 24h (DA08)', async () => {
    const { calls } = mockBackend(() => ({ body: apiSector }))
    await updateSectorMinimum('s1', { nurses: 5, technicians: 6 })
    expect(calls[0]).toMatchObject({
      url: '/api/setores/s1',
      method: 'PATCH',
      body: { plantao24h: { enfermeiros: 5, tecnicos: 6 } },
    })
  })

  it('edita nome e descrição', async () => {
    const { calls } = mockBackend(() => ({ body: apiSector }))
    await updateSectorDetails('s1', { name: 'CTI', description: 'novo' })
    expect(calls[0].body).toEqual({ nome: 'CTI', descricao: 'novo' })
  })

  const apiWithSubsectors = {
    id: 's2',
    nome: 'UTI',
    ativo: true,
    possuiSubsetores: true,
    plantao24h: { enfermeiros: 2, tecnicos: null },
    tecnicosSemSubsetor: 1,
    subsetores: [
      { id: 'u1', setorId: 's2', nome: 'UTI Adulto', ativo: true, plantao24h: { tecnicos: 2 } },
      { id: 'u2', setorId: 's2', nome: 'UTI Neo', descricao: 'Neonatal', ativo: false, plantao24h: { tecnicos: 1 } },
    ],
  }

  it('mapeia setor com subsetores: mínimo de técnicos nulo no setor e por subsetor', async () => {
    mockBackend(() => ({ body: [apiWithSubsectors, apiSector] }))
    const [uti, plain] = await listSectors()
    expect(uti).toMatchObject({ hasSubsectors: true, minimum: { nurses: 2, technicians: null }, techniciansWithoutSubsector: 1 })
    expect(uti.subsectors).toEqual([
      { id: 'u1', sectorId: 's2', name: 'UTI Adulto', description: '', active: true, minimumTechnicians: 2 },
      { id: 'u2', sectorId: 's2', name: 'UTI Neo', description: 'Neonatal', active: false, minimumTechnicians: 1 },
    ])
    expect(plain).toMatchObject({ hasSubsectors: false, subsectors: [], minimum: { nurses: 2, technicians: 4 } })
  })

  it('cadastra setor com subsetores sem enviar mínimo de técnicos do setor', async () => {
    const { calls } = mockBackend(() => ({ body: apiWithSubsectors }))
    await createSector({
      name: 'UTI',
      description: '',
      minimum: { nurses: 2, technicians: null },
      subsectors: [{ name: 'UTI Adulto', description: '', minimumTechnicians: 2 }],
    })
    expect(calls[0].body).toEqual({
      nome: 'UTI',
      plantao24h: { enfermeiros: 2 },
      subsetores: [{ nome: 'UTI Adulto', plantao24h: { tecnicos: 2 } }],
    })
  })

  it('edita o mínimo de setor com subsetores enviando só enfermeiros', async () => {
    const { calls } = mockBackend(() => ({ body: apiWithSubsectors }))
    await updateSectorMinimum('s2', { nurses: 3, technicians: null })
    expect(calls[0].body).toEqual({ plantao24h: { enfermeiros: 3 } })
    await updateSectorMinimum('s2', { nurses: 3, technicians: null, subsectors: [{ id: 'u1', minimumTechnicians: 4 }] })
    expect(calls[1].body).toEqual({ plantao24h: { enfermeiros: 3 }, subsetores: [{ id: 'u1', plantao24h: { tecnicos: 4 } }] })
  })

  it('salva a edição em ordem segura: dados, novos, alterados/reativados e, por último, os removidos', async () => {
    mockBackend(() => ({ body: [apiWithSubsectors] }))
    const [sector] = await listSectors()
    const { calls } = mockBackend(() => ({ body: apiWithSubsectors }))
    await saveSectorForm(sector, {
      name: 'UTI',
      description: '',
      nurses: 3,
      technicians: 0,
      hasSubsectors: true,
      subsectors: [
        { id: 'u1', name: 'UTI Adulto', description: '', minimumTechnicians: 2, active: true, removed: true },
        { name: 'UTI Pediátrica', description: '', minimumTechnicians: 1, active: true },
        { id: 'u2', name: 'UTI Neo', description: 'Neonatal', minimumTechnicians: 1, active: true },
      ],
    })
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['PATCH', '/api/setores/s2'],
      ['POST', '/api/setores/s2/subsetores'],
      ['PATCH', '/api/setores/s2/subsetores/u2/ativar'],
      ['PATCH', '/api/setores/s2/subsetores/u1/inativar'],
    ])
    expect(calls[0].body).toEqual({ nome: 'UTI', descricao: '', plantao24h: { enfermeiros: 3 } })
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
