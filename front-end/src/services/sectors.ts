import { api } from './api'
import type { NewSector, Sector, SectorMinimum, Subsector } from '../pages/Sectors/types'

type ApiSubsector = {
  id: string
  setorId: string
  nome: string
  descricao?: string
  ativo: boolean
  plantao24h: { tecnicos: number }
}
type ApiSector = {
  id: string
  nome: string
  descricao?: string
  ativo: boolean
  possuiSubsetores?: boolean
  plantao24h: { enfermeiros: number; tecnicos: number | null }
  subsetores?: ApiSubsector[]
  tecnicosSemSubsetor?: number
}

const toSubsector = (s: ApiSubsector): Subsector => ({
  id: s.id,
  sectorId: s.setorId,
  name: s.nome,
  description: s.descricao ?? '',
  active: s.ativo,
  minimumTechnicians: s.plantao24h.tecnicos,
})

const fromApi = (s: ApiSector): Sector => ({
  id: s.id,
  name: s.nome,
  description: s.descricao ?? '',
  active: s.ativo,
  hasSubsectors: s.possuiSubsetores ?? false,
  minimum: { nurses: s.plantao24h.enfermeiros, technicians: s.plantao24h.tecnicos ?? null },
  subsectors: (s.subsetores ?? []).map(toSubsector),
  techniciansWithoutSubsector: s.tecnicosSemSubsetor ?? 0,
})

/** Setor sem subsetores envia os dois mínimos; setor com subsetores envia só o de enfermeiros (técnicos ficam nos subsetores). */
const toQuantitativo = (m: SectorMinimum) =>
  m.technicians === null ? { enfermeiros: m.nurses } : { enfermeiros: m.nurses, tecnicos: m.technicians }

export const listSectors = async () =>
  (await api<ApiSector[]>('/setores')).map(fromApi)

export const createSector = async (s: NewSector) =>
  fromApi(
    await api<ApiSector>('/setores', {
      method: 'POST',
      body: JSON.stringify({
        nome: s.name,
        descricao: s.description || undefined,
        plantao24h: toQuantitativo(s.minimum),
        ...(s.subsectors && s.subsectors.length > 0
          ? {
              subsetores: s.subsectors.map((sub) => ({
                nome: sub.name,
                descricao: sub.description || undefined,
                plantao24h: { tecnicos: sub.minimumTechnicians },
              })),
            }
          : {}),
      }),
    }),
  )

export type SectorMinimums = {
  nurses: number
  /** Só para setor sem subsetores. */
  technicians: number | null
  /** Só para setor com subsetores: novo mínimo de técnicos de cada subsetor (por id). */
  subsectors?: { id: string; minimumTechnicians: number }[]
}

/** Edita todos os mínimos do setor (enfermeiros + técnicos do setor ou de cada subsetor) em uma única requisição. */
export const updateSectorMinimum = async (sectorId: string, minimums: SectorMinimums) =>
  fromApi(
    await api<ApiSector>(`/setores/${sectorId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        plantao24h: toQuantitativo({ nurses: minimums.nurses, technicians: minimums.technicians }),
        ...(minimums.subsectors && minimums.subsectors.length > 0
          ? { subsetores: minimums.subsectors.map((sub) => ({ id: sub.id, plantao24h: { tecnicos: sub.minimumTechnicians } })) }
          : {}),
      }),
    }),
  )

export const updateSectorDetails = async (sectorId: string, details: { name: string; description: string }) =>
  fromApi(
    await api<ApiSector>(`/setores/${sectorId}`, {
      method: 'PATCH',
      body: JSON.stringify({ nome: details.name, descricao: details.description }),
    }),
  )

export const setSectorActive = async (sectorId: string, active: boolean) =>
  fromApi(await api<ApiSector>(`/setores/${sectorId}/${active ? 'ativar' : 'inativar'}`, { method: 'PATCH' }))

export const createSubsector = async (sectorId: string, sub: { name: string; description: string; minimumTechnicians: number }) =>
  fromApi(
    await api<ApiSector>(`/setores/${sectorId}/subsetores`, {
      method: 'POST',
      body: JSON.stringify({ nome: sub.name, descricao: sub.description || undefined, plantao24h: { tecnicos: sub.minimumTechnicians } }),
    }),
  )

export const updateSubsector = async (
  sectorId: string,
  subsectorId: string,
  sub: { name: string; description: string; minimumTechnicians: number },
) =>
  fromApi(
    await api<ApiSector>(`/setores/${sectorId}/subsetores/${subsectorId}`, {
      method: 'PATCH',
      body: JSON.stringify({ nome: sub.name, descricao: sub.description, plantao24h: { tecnicos: sub.minimumTechnicians } }),
    }),
  )

/** Subsetor nunca é excluído: "remover" = inativar (o backend recusa se houver profissionais vinculados). */
export const setSubsectorActive = async (sectorId: string, subsectorId: string, active: boolean) =>
  fromApi(await api<ApiSector>(`/setores/${sectorId}/subsetores/${subsectorId}/${active ? 'ativar' : 'inativar'}`, { method: 'PATCH' }))

/** Rascunho de subsetor no formulário: `id` presente = já cadastrado. */
export type SubsectorDraft = {
  id?: string
  name: string
  description: string
  minimumTechnicians: number
  active: boolean
  removed?: boolean
}
export type SectorForm = {
  name: string
  description: string
  nurses: number
  technicians: number
  hasSubsectors: boolean
  subsectors: SubsectorDraft[]
}

/**
 * Salva o formulário de edição: dados/mínimo do setor e, na ordem segura, subsetores novos, alterados,
 * reativados e por último os removidos (para nunca inativar o único subsetor ativo antes de criar os novos).
 */
export async function saveSectorForm(sector: Sector, form: SectorForm): Promise<Sector> {
  const keepsOwnTechnicians = !sector.hasSubsectors && !form.hasSubsectors
  let result = fromApi(
    await api<ApiSector>(`/setores/${sector.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        nome: form.name,
        descricao: form.description,
        plantao24h: keepsOwnTechnicians ? { enfermeiros: form.nurses, tecnicos: form.technicians } : { enfermeiros: form.nurses },
      }),
    }),
  )
  const live = form.subsectors.filter((s) => !s.removed)
  for (const sub of live.filter((s) => !s.id)) result = await createSubsector(sector.id, sub)
  for (const sub of live.filter((s) => s.id)) {
    const before = sector.subsectors.find((s) => s.id === sub.id)
    if (!before) continue
    if (before.name !== sub.name || before.description !== sub.description || before.minimumTechnicians !== sub.minimumTechnicians) {
      result = await updateSubsector(sector.id, sub.id!, sub)
    }
    if (!before.active && sub.active) result = await setSubsectorActive(sector.id, sub.id!, true)
  }
  for (const sub of form.subsectors.filter((s) => s.removed && s.id)) {
    if (sector.subsectors.find((s) => s.id === sub.id)?.active) result = await setSubsectorActive(sector.id, sub.id!, false)
  }
  return result
}
