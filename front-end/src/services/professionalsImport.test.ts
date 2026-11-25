import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import {
  IMPORT_MAX_BYTES,
  importProfessionals,
  previewFromError,
  previewProfessionalsImport,
  validateImportFile,
} from './professionalsImport'

const file = (name = 'profissionais.xlsx', size = 10) => new File([new Uint8Array(size)], name)

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: status < 400, status, json: async () => body, headers: { get: () => null } }))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() })
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('services/professionalsImport', () => {
  it('valida extensão, arquivo vazio e tamanho antes de enviar', () => {
    expect(validateImportFile(file())).toBeNull()
    expect(validateImportFile(file('PROFISSIONAIS.XLSX'))).toBeNull()
    expect(validateImportFile(file('dados.csv'))).toMatch(/\.xlsx/)
    expect(validateImportFile(file('vazio.xlsx', 0))).toMatch(/vazio/)
    expect(validateImportFile(file('grande.xlsx', IMPORT_MAX_BYTES + 1))).toMatch(/limite/)
  })

  it('envia o arquivo como multipart, sem forçar Content-Type JSON, na prévia e na importação', async () => {
    const fetchMock = stubFetch(200, { resumo: {}, linhas: [], podeConfirmar: true })
    await previewProfessionalsImport(file())
    await importProfessionals(file())
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(calls.map(([url]) => url)).toEqual(['/api/profissionais/importacao/previa', '/api/profissionais/importacao'])
    for (const [, init] of calls) {
      expect(init.method).toBe('POST')
      expect(init.body).toBeInstanceOf(FormData)
      expect((init.body as FormData).get('arquivo')).toBeInstanceOf(File)
      expect(init.headers).not.toHaveProperty('Content-Type')
    }
  })

  it('extrai a prévia anexada ao 422 da importação e ignora outros erros', async () => {
    const previa = { resumo: { total: 1, novos: 0, atualizar: 0, semAlteracao: 0, invalidos: 1 }, linhas: [], podeConfirmar: false }
    stubFetch(422, { message: 'A planilha possui registros inválidos.', previa })
    const error = await importProfessionals(file()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(previewFromError(error)).toEqual(previa)
    expect(previewFromError(new ApiError(500, 'x'))).toBeNull()
    expect(previewFromError(new Error('x'))).toBeNull()
  })
})
