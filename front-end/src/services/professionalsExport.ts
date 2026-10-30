import type { Professional } from '../pages/Professionals/types'
import { STATUS_LABEL, statusOf } from '../pages/Professionals/filters'

const FORMATION_LABEL = { Enfemeiro: 'Enfermeiro', Técnico: 'Técnico de enfermagem' } as const
const DATE_FORMAT = 'dd/mm/yyyy hh:mm'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const toDate = (value?: string) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

const COLUMNS = [
  { header: 'Nome completo', value: (p: Professional) => p.name },
  { header: 'CPF', value: (p: Professional) => p.cpf, text: true },
  { header: 'E-mail', value: (p: Professional) => p.email },
  { header: 'COREN', value: (p: Professional) => p.coren, text: true },
  { header: 'Formação', value: (p: Professional) => FORMATION_LABEL[p.formation] },
  { header: 'Tipo de vínculo', value: (p: Professional) => p.bond },
  { header: 'Situação', value: (p: Professional) => STATUS_LABEL[statusOf(p)] },
  { header: 'Data de cadastro', value: (p: Professional) => toDate(p.createdAt), date: true },
  { header: 'Última atualização', value: (p: Professional) => toDate(p.updatedAt), date: true },
]

/** Monta a planilha "Profissionais" a partir da lista já filtrada e ordenada na tela. */
export async function buildProfessionalsWorkbook(professionals: Professional[]) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet('Profissionais', { views: [{ state: 'frozen', ySplit: 1 }] })

  sheet.columns = COLUMNS.map((column) => ({
    header: column.header,
    width: Math.max(
      column.header.length,
      column.date ? DATE_FORMAT.length : 0,
      ...professionals.map((p) => String(column.date ? '' : (column.value(p) ?? '')).length),
    ) + 3,
    style: column.text ? { numFmt: '@' } : column.date ? { numFmt: DATE_FORMAT } : {},
  }))
  for (const professional of professionals) {
    sheet.addRow(COLUMNS.map((column) => column.value(professional)))
  }

  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.alignment = { vertical: 'middle' }
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF285F34' } }
  })
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } }
  return workbook
}

export const professionalsFileName = (now = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `nurseflow-profissionais-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`
}

export async function exportProfessionalsXlsx(professionals: Professional[]) {
  const workbook = await buildProfessionalsWorkbook(professionals)
  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }))
  const link = document.createElement('a')
  link.href = url
  link.download = professionalsFileName()
  link.click()
  URL.revokeObjectURL(url)
}
