import { api } from './api'
import type { Professional } from '../pages/Professionals/types'

type ApiProfessional = {
  id: string
  nome: string
  cpf: string
  email: string
  coren: string
  formacao: 'enfermeiro' | 'tecnico'
  tipoVinculo: 'concursado' | 'clt' | 'rpa'
  status: 'ativo' | 'desativado' | 'afastado' | 'ferias'
}

const BOND_FROM_API = { concursado: 'Concursado', clt: 'CLT', rpa: 'RPA' } as const
const BOND_TO_API = { Concursado: 'concursado', CLT: 'clt', RPA: 'rpa' } as const

const fromApi = (p: ApiProfessional): Professional => ({
  id: p.id,
  name: p.nome,
  cpf: p.cpf,
  email: p.email,
  coren: p.coren,
  bond: BOND_FROM_API[p.tipoVinculo],
  status: p.status === 'ativo',
  apiStatus: p.status,
  formation: p.formacao === 'enfermeiro' ? 'Enfemeiro' : 'Técnico',
})

const toApi = (p: Professional) => {
  const body: Record<string, unknown> = {
    nome: p.name,
    cpf: p.cpf,
    email: p.email,
    coren: p.coren,
    formacao: p.formation === 'Enfemeiro' ? 'enfermeiro' : 'tecnico',
    tipoVinculo: BOND_TO_API[p.bond],
  }
  // Férias/afastamento não são editáveis aqui: só envia o status se o toggle mudou.
  if (!p.id || p.status !== (p.apiStatus === 'ativo')) body.status = p.status ? 'ativo' : 'desativado'
  return body
}

export async function listProfessionals(): Promise<Professional[]> {
  const all: Professional[] = []
  for (let page = 1; ; page++) {
    const res = await api<{ data: ApiProfessional[]; meta: { totalPages: number } }>(
      `/profissionais?limit=100&page=${page}`,
    )
    all.push(...res.data.map(fromApi))
    if (page >= res.meta.totalPages) return all
  }
}

export const createProfessional = async (p: Professional) =>
  fromApi(await api<ApiProfessional>('/profissionais', { method: 'POST', body: JSON.stringify(toApi(p)) }))

export const updateProfessional = async (p: Professional) =>
  fromApi(await api<ApiProfessional>(`/profissionais/${p.id}`, { method: 'PATCH', body: JSON.stringify(toApi(p)) }))
