import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockBackend, type Call } from '../test/fetchMock'
import type { AvailabilityRecord } from '../pages/Disponibility/components/AvailabilityFormModal'
import { createRestriction, deleteRestriction, fetchAllRestrictions } from './restriction'

afterEach(() => vi.unstubAllGlobals())

const ANA = { id: 'p1', nome: 'Ana Souza', formacao: 'enfermeiro', status: 'ativo' }
const profissionaisResponse = (...items: object[]) => ({
  data: items.map((item) => ({ cpf: '', email: '', coren: '', tipoVinculo: 'clt', ...item })),
  meta: { totalPages: 1 },
})

const professionals = [{ id: 'p1', name: 'Ana Souza' }]
const record = (
  category: AvailabilityRecord['category'],
  details: AvailabilityRecord['details'],
): AvailabilityRecord => ({
  id: 'novo',
  category,
  name: 'Ana Souza',
  role: 'Enfemeiro',
  rule: '',
  period: '',
  details,
})

describe('services/restriction', () => {
  it('lista restrições de todos os profissionais e separa por categoria', async () => {
    mockBackend((call: Call) => {
      if (call.url.includes('/profissionais?')) {
        return {
          body: profissionaisResponse(ANA, {
            id: 'p2',
            nome: 'Bia Lima',
            formacao: 'tecnico',
            status: 'desativado',
          }),
        }
      }
      if (call.url.endsWith('/profissionais/p1/restricoes')) {
        return {
          body: [
            { _id: 'r1', tipo: 'indisponivel', inicio: '2026-10-01T00:00:00.000Z', fim: '2026-10-31T23:59:59.999Z', diaSemana: 1, observacao: 'Faculdade' },
            { _id: 'r2', tipo: 'vinculo_externo', inicio: '2026-10-01T00:00:00.000Z', fim: '2026-12-31T23:59:59.999Z', diaSemana: null },
          ],
        }
      }
      return {
        body: [
          { _id: 'r3', tipo: 'ferias', inicio: '2026-11-01T00:00:00.000Z', fim: '2026-11-30T23:59:59.999Z', diaSemana: null },
        ],
      }
    })

    const { records, professionals: options } = await fetchAllRestrictions()
    // Somente profissionais ativos podem receber novos registros.
    expect(options).toEqual([{ id: 'p1', name: 'Ana Souza' }])
    expect(records.restrictions).toHaveLength(1)
    expect(records.restrictions[0]).toMatchObject({
      id: 'r1',
      professionalId: 'p1',
      rule: 'Indisponível · Faculdade',
      period: '2026-10-01 a 2026-10-31 · segunda',
    })
    expect(records.externalLinks.map((r) => r.id)).toEqual(['r2'])
    expect(records.absences[0]).toMatchObject({ id: 'r3', professionalStatus: 'desativado' })
  })

  it('cria uma restrição por dia da semana selecionado, com datas em UTC', async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }))
    await createRestriction(
      record('restrictions', {
        ruleType: 'unavailableDays',
        days: ['segunda', 'domingo'],
        validFrom: '2026-10-01',
        validTo: '2026-10-31',
        note: 'Curso',
      }),
      professionals,
    )
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      url: '/api/profissionais/p1/restricoes',
      method: 'POST',
      body: {
        tipo: 'indisponivel',
        inicio: '2026-10-01T00:00:00.000Z',
        fim: '2026-10-31T23:59:59.999Z',
        diaSemana: 1,
        observacao: 'Curso',
      },
    })
    expect(calls[1].body).toMatchObject({ diaSemana: 0 })
  })

  it('mapeia férias e ausências sem diaSemana', async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }))
    await createRestriction(
      record('absences', { absenceType: 'Férias', startDate: '2026-11-01', endDate: '2026-11-30' }),
      professionals,
    )
    await createRestriction(
      record('absences', { absenceType: 'Atestado médico', startDate: '2026-11-01', endDate: '2026-11-02' }),
      professionals,
    )
    expect(calls.map((c) => (c.body as { tipo: string }).tipo)).toEqual(['ferias', 'ausencia'])
    expect(calls[0].body).not.toHaveProperty('diaSemana')
  })

  it('limita a observação a 300 caracteres (limite do backend)', async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }))
    await createRestriction(
      record('absences', { absenceType: 'Ausência', startDate: '2026-11-01', endDate: '2026-11-02', note: 'x'.repeat(500) }),
      professionals,
    )
    expect((calls[0].body as { observacao: string }).observacao.length).toBeLessThanOrEqual(300)
  })

  it('recusa profissional fora da lista de ativos e recursos sem suporte no backend', async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }))
    await expect(
      createRestriction({ ...record('absences', {}), name: 'Outra Pessoa' }, professionals),
    ).rejects.toThrow(/profissional ativo/)
    await expect(
      createRestriction(record('restrictions', { ruleType: 'allowedShift' }), professionals),
    ).rejects.toThrow(/turno/)
    expect(calls).toHaveLength(0)
  })

  it('mostra a mensagem do servidor em caso de conflito (409)', async () => {
    mockBackend(() => ({ status: 409, body: { message: 'Já existe restrição desse tipo no período informado' } }))
    await expect(
      createRestriction(
        record('absences', { absenceType: 'Férias', startDate: '2026-11-01', endDate: '2026-11-30' }),
        professionals,
      ),
    ).rejects.toThrow('Já existe restrição desse tipo no período informado')
  })

  it('exclui pela rota do profissional', async () => {
    const { calls } = mockBackend(() => ({ body: { removida: true } }))
    await deleteRestriction('p1', 'r9')
    expect(calls[0]).toMatchObject({ url: '/api/profissionais/p1/restricoes/r9', method: 'DELETE' })
  })
})
