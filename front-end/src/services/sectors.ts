import { api } from './api'
import type { Sector, SectorMinimum } from '../pages/Sectors/types'

type Quantitativo = { enfermeiros: number; tecnicos: number }
type ApiSector = {
  id: string
  nome: string
  descricao?: string
  ativo: boolean
  plantao24h: Quantitativo
}

const toMinimum = (q: Quantitativo): SectorMinimum => ({ nurses: q.enfermeiros, technicians: q.tecnicos })
const toQuantitativo = (m: SectorMinimum): Quantitativo => ({ enfermeiros: m.nurses, tecnicos: m.technicians })

const fromApi = (s: ApiSector): Sector => ({
  id: s.id,
  name: s.nome,
  description: s.descricao ?? '',
  active: s.ativo,
  minimum: toMinimum(s.plantao24h),
})

export const listSectors = async () =>
  (await api<ApiSector[]>('/setores')).map(fromApi)

export const createSector = async (s: Omit<Sector, 'id' | 'active'>) =>
  fromApi(
    await api<ApiSector>('/setores', {
      method: 'POST',
      body: JSON.stringify({ nome: s.name, descricao: s.description || undefined, plantao24h: toQuantitativo(s.minimum) }),
    }),
  )

export const updateSectorMinimum = async (sectorId: string, minimum: SectorMinimum) =>
  fromApi(
    await api<ApiSector>(`/setores/${sectorId}`, {
      method: 'PATCH',
      body: JSON.stringify({ plantao24h: toQuantitativo(minimum) }),
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
