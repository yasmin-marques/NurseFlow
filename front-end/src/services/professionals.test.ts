import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockBackend } from '../test/fetchMock'
import { createProfessional, listProfessionals, updateProfessional } from './professionals'

afterEach(() => vi.unstubAllGlobals())

const apiPro = (over = {}) => ({
  id: 'p1',
  nome: 'Ana',
  cpf: '52998224725',
  email: 'ana@nurseflow.test',
  coren: 'CE-10001',
  formacao: 'enfermeiro',
  tipoVinculo: 'clt',
  status: 'ativo',
  setorId: 's1',
  setorNome: 'UTI',
  createdAt: '2026-10-05T13:30:00.000Z',
  updatedAt: '2026-10-06T13:30:00.000Z',
  ...over,
})
const page = (data: unknown[]) => ({ body: { data, meta: { totalPages: 1 } } })

describe('services/professionals', () => {
  it('percorre todas as páginas e mapeia os campos', async () => {
    const { calls } = mockBackend((call) => ({
      body: {
        data: call.url.endsWith('page=1')
          ? [apiPro()]
          : [apiPro({ id: 'p2', formacao: 'tecnico', tipoVinculo: 'rpa', status: 'ferias' })],
        meta: { totalPages: 2 },
      },
    }))
    const all = await listProfessionals()
    expect(calls).toHaveLength(2)
    expect(all[0]).toMatchObject({ name: 'Ana', bond: 'CLT', formation: 'Enfemeiro', status: true, createdAt: '2026-10-05T13:30:00.000Z' })
    expect(all[1]).toMatchObject({ bond: 'RPA', formation: 'Técnico', status: false, apiStatus: 'ferias' })
  })

  it('cadastra enviando status e convertendo vínculo e formação', async () => {
    mockBackend(() => page([apiPro()]))
    const [p] = await listProfessionals()
    const { calls } = mockBackend(() => ({ body: apiPro() }))
    await createProfessional({ ...p, id: '' })
    expect(calls[0]).toMatchObject({ url: '/api/profissionais', method: 'POST' })
    expect(calls[0].body).toMatchObject({ formacao: 'enfermeiro', tipoVinculo: 'clt', status: 'ativo', setorId: 's1' })
  })

  it('mapeia o setor fixo e o envia no cadastro e na edição; cadastro legado sem setor vem como nulo', async () => {
    mockBackend(() => page([apiPro(), apiPro({ id: 'p2', setorId: null, setorNome: null })]))
    const [comSetor, semSetor] = await listProfessionals()
    expect(comSetor).toMatchObject({ sectorId: 's1', sectorName: 'UTI' })
    expect(semSetor).toMatchObject({ sectorId: null, sectorName: null })
    const { calls } = mockBackend(() => ({ body: apiPro() }))
    await updateProfessional({ ...comSetor, sectorId: 's2' })
    expect(calls[0].body).toMatchObject({ setorId: 's2' })
    await updateProfessional(semSetor)
    expect(calls[1].body).not.toHaveProperty('setorId') // sem setor escolhido, o backend recusa o cadastro (setor obrigatório)
  })

  it('na edição só envia status se o toggle mudou (preserva férias/afastamento)', async () => {
    mockBackend(() => page([apiPro({ status: 'ferias' })]))
    const [p] = await listProfessionals()
    const { calls } = mockBackend(() => ({ body: apiPro() }))
    await updateProfessional(p)
    expect(calls[0]).toMatchObject({ url: '/api/profissionais/p1', method: 'PATCH' })
    expect(calls[0].body).not.toHaveProperty('status')
    await updateProfessional({ ...p, status: true })
    expect(calls[1].body).toMatchObject({ status: 'ativo' })
  })
})
