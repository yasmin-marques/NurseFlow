import { Workbook } from 'exceljs'
import { describe, expect, it } from 'vitest'
import { applyProfessionalView, initialFilters, type ProfessionalFilters } from '../pages/Professionals/filters'
import type { Professional, ProfessionalStatus } from '../pages/Professionals/types'
import { buildProfessionalsWorkbook, professionalsFileName } from './professionalsExport'

const pro = (over: Partial<Professional> & { s?: ProfessionalStatus } = {}): Professional => {
  const { s = 'ativo', ...rest } = over
  return {
    id: 'x', name: 'Ana Lima', cpf: '529.982.247-25', email: 'ana@nurseflow.test', coren: 'CE-10001',
    bond: 'CLT', status: s === 'ativo', apiStatus: s, formation: 'Enfemeiro',
    createdAt: '2026-10-05T13:30:00.000Z', updatedAt: '2026-10-20T08:00:00.000Z', ...rest,
  }
}

const LIST: Professional[] = [
  pro({ name: 'Carla Rocha', cpf: '111.444.777-35', coren: 'CE-10003', bond: 'RPA' }),
  pro({ name: 'Ana Lima' }),
  pro({ name: 'Bruno João', formation: 'Técnico', bond: 'Concursado', s: 'ferias', coren: 'CE-10002' }),
  pro({ name: 'Diego Alves', formation: 'Técnico', s: 'afastado', coren: 'CE-10004' }),
  pro({ name: 'Elisa Melo', s: 'desativado', coren: 'CE-10005' }),
]

const view = (over: Partial<ProfessionalFilters> = {}, search = '') =>
  applyProfessionalView(LIST, { ...initialFilters, ...over }, search)

// Reabre o arquivo gerado, como o Excel faria.
async function roundTrip(list: Professional[]) {
  const buffer = await (await buildProfessionalsWorkbook(list)).xlsx.writeBuffer()
  const workbook = new Workbook()
  await workbook.xlsx.load(buffer)
  return workbook.getWorksheet('Profissionais')!
}

describe('applyProfessionalView (base da exportação)', () => {
  it('sem filtros devolve todos, ordenados por nome', () => {
    expect(view().map((p) => p.name)).toEqual(['Ana Lima', 'Bruno João', 'Carla Rocha', 'Diego Alves', 'Elisa Melo'])
    expect(view({ sort: 'desc' })[0].name).toBe('Elisa Melo')
  })
  it('filtra por formação, vínculo e cada situação', () => {
    expect(view({ formation: 'Enfemeiro' })).toHaveLength(3)
    expect(view({ formation: 'Técnico' })).toHaveLength(2)
    expect(view({ bond: 'RPA' }).map((p) => p.name)).toEqual(['Carla Rocha'])
    for (const status of ['ativo', 'desativado', 'afastado', 'ferias'] as const) {
      expect(view({ status }).every((p) => p.apiStatus === status)).toBe(true)
    }
    expect(view({ status: 'ferias' }).map((p) => p.name)).toEqual(['Bruno João'])
  })
  it('combina filtros e busca por nome, COREN ou CPF', () => {
    expect(view({ formation: 'Técnico', status: 'afastado' }).map((p) => p.name)).toEqual(['Diego Alves'])
    expect(view({}, 'carla').map((p) => p.name)).toEqual(['Carla Rocha'])
    expect(view({}, 'ce-10002').map((p) => p.name)).toEqual(['Bruno João'])
    expect(view({}, '11144477735').map((p) => p.name)).toEqual(['Carla Rocha'])
    expect(view({ formation: 'Técnico' }, 'ana')).toEqual([])
  })
})

describe('buildProfessionalsWorkbook', () => {
  it('gera aba, cabeçalhos, congelamento e autofiltro', async () => {
    const sheet = await roundTrip(view())
    expect(sheet.name).toBe('Profissionais')
    expect((sheet.getRow(1).values as string[]).slice(1)).toEqual([
      'Nome completo', 'CPF', 'E-mail', 'COREN', 'Formação', 'Tipo de vínculo', 'Situação',
      'Data de cadastro', 'Última atualização',
    ])
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(sheet.autoFilter).toBeTruthy()
    expect(sheet.getRow(1).font?.bold).toBe(true)
    expect(sheet.getColumn(3).width).toBeGreaterThan('ana@nurseflow.test'.length)
  })

  it('traduz formação, vínculo e as 4 situações', async () => {
    const sheet = await roundTrip(view())
    expect(sheet.rowCount).toBe(6)
    const row = (n: number) => sheet.getRow(n).values as unknown[]
    expect(row(2).slice(1, 7)).toEqual(['Ana Lima', '529.982.247-25', 'ana@nurseflow.test', 'CE-10001', 'Enfermeiro', 'CLT'])
    expect(sheet.getRow(2).getCell(7).value).toBe('Ativo')
    expect(sheet.getRow(3).getCell(5).value).toBe('Técnico de enfermagem')
    expect([3, 4, 5, 6].map((n) => sheet.getRow(n).getCell(7).value)).toEqual(['Férias', 'Ativo', 'Afastado', 'Desativado'])
  })

  it('exporta somente o recorte recebido, respeitando a ordem', async () => {
    const sheet = await roundTrip(view({ formation: 'Técnico', sort: 'desc' }))
    expect(sheet.rowCount).toBe(3)
    expect([2, 3].map((n) => sheet.getRow(n).getCell(1).value)).toEqual(['Diego Alves', 'Bruno João'])
  })

  it('mantém CPF como texto e datas como datas no padrão brasileiro', async () => {
    const sheet = await roundTrip([pro({ cpf: '000.123.456-78' })])
    const cpf = sheet.getRow(2).getCell(2)
    expect(cpf.value).toBe('000.123.456-78')
    expect(cpf.numFmt).toBe('@')
    const created = sheet.getRow(2).getCell(8)
    expect(created.value).toBeInstanceOf(Date)
    expect((created.value as Date).toISOString()).toBe('2026-10-05T13:30:00.000Z')
    expect(created.numFmt).toBe('dd/mm/yyyy hh:mm')
  })

  it('deixa datas ausentes ou inválidas em branco', async () => {
    const sheet = await roundTrip([pro({ createdAt: undefined, updatedAt: 'inválida' })])
    expect(sheet.getRow(2).getCell(8).value).toBeNull()
    expect(sheet.getRow(2).getCell(9).value).toBeNull()
  })

  it('sem resultados gera só o cabeçalho', async () => {
    const sheet = await roundTrip(view({}, 'inexistente'))
    expect(sheet.rowCount).toBe(1)
  })

  it('não exporta dados de autenticação nem campos internos', async () => {
    const leaky = { ...pro(), senha: 'HASH-SECRETO', token: 'JWT-SECRETO', usuarioId: 'u1' } as Professional
    const sheet = await roundTrip([leaky])
    const text = JSON.stringify(sheet.getSheetValues())
    expect(text).not.toMatch(/HASH-SECRETO|JWT-SECRETO|u1/)
    expect(sheet.columnCount).toBe(9)
  })
})

describe('professionalsFileName', () => {
  it('usa a data no padrão AAAA-MM-DD', () => {
    expect(professionalsFileName(new Date(2026, 9, 5))).toBe('nurseflow-profissionais-2026-10-05.xlsx')
  })
})
