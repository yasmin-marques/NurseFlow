import { api, apiDownload, ApiError } from './api'

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024

export type ImportAction = 'criar' | 'atualizar' | 'sem_alteracao' | 'invalido'

export type ImportFieldChange = { campo: string; atual: string | null; novo: string | null }
export type ImportRowError = { campo: string; mensagem: string }

export type ImportRow = {
  linha: number
  nome: string
  cpf: string
  acao: ImportAction
  alteracoes: ImportFieldChange[]
  erros: ImportRowError[]
  avisos: string[]
}

export type ImportPreview = {
  resumo: { total: number; novos: number; atualizar: number; semAlteracao: number; invalidos: number }
  linhas: ImportRow[]
  podeConfirmar: boolean
}

export type ImportResult = {
  resumo: { total: number; cadastrados: number; atualizados: number; ignorados: number }
  linhas: ImportRow[]
}

/** Validação rápida no navegador; o servidor valida tipo, conteúdo e tamanho de novo. */
export function validateImportFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) return 'Formato não suportado: selecione um arquivo .xlsx.'
  if (file.size === 0) return 'O arquivo está vazio.'
  if (file.size > IMPORT_MAX_BYTES) return `O arquivo excede o limite de ${IMPORT_MAX_BYTES / 1024 / 1024} MB.`
  return null
}

const upload = (file: File) => {
  const body = new FormData()
  body.append('arquivo', file)
  return body
}

/** Valida a planilha e devolve o que seria cadastrado/atualizado, sem gravar nada. */
export const previewProfessionalsImport = (file: File) =>
  api<ImportPreview>('/profissionais/importacao/previa', { method: 'POST', body: upload(file) })

/** Importa de fato. Com registros inválidos o servidor responde 422 e nada é gravado (ver `previewFromError`). */
export const importProfessionals = (file: File) =>
  api<ImportResult>('/profissionais/importacao', { method: 'POST', body: upload(file) })

/** Extrai a prévia anexada a um 422 da importação (planilha com erros), se houver. */
export function previewFromError(error: unknown): ImportPreview | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null
  const preview = (error.payload as { previa?: ImportPreview } | null)?.previa
  return preview && Array.isArray(preview.linhas) ? preview : null
}

export async function downloadImportTemplate() {
  const { blob, filename } = await apiDownload('/profissionais/importacao/modelo')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : 'modelo-importacao-profissionais.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}
