import { api } from './api'
import type { Sector, SectorMinimum, SectorShift } from '../pages/Sectors/types'

type Quantitativo = { enfermeiros: number; tecnicos: number }
type ApiSector = {
  id: string
  nome: string
  descricao?: string
  ativo: boolean
  turnos: { diurno: Quantitativo; noturno: Quantitativo }
}

const toMinimum = (q: Quantitativo): SectorMinimum => ({ nurses: q.enfermeiros, technicians: q.tecnicos })
const toQuantitativo = (m: SectorMinimum): Quantitativo => ({ enfermeiros: m.nurses, tecnicos: m.technicians })

const fromApi = (s: ApiSector): Sector => ({
  id: s.id,
  name: s.nome,
  description: s.descricao ?? '',
  active: s.ativo,
  shifts: [
    { id: 'day', label: 'Diurno', hours: '07h—19h', minimum: toMinimum(s.turnos.diurno) },
    { id: 'night', label: 'Noturno', hours: '19h—07h', minimum: toMinimum(s.turnos.noturno) },
  ],
})

const turnosOf = (shifts: SectorShift[]) => {
  const find = (id: string) => shifts.find((shift) => shift.id === id)!.minimum
  return { diurno: toQuantitativo(find('day')), noturno: toQuantitativo(find('night')) }
}

export const listSectors = async () =>
  (await api<ApiSector[]>('/setores')).map(fromApi)

export const createSector = async (s: Omit<Sector, 'id' | 'active'>) =>
  fromApi(
    await api<ApiSector>('/setores', {
      method: 'POST',
      body: JSON.stringify({ nome: s.name, descricao: s.description || undefined, turnos: turnosOf(s.shifts) }),
    }),
  )

export const updateSectorMinimum = async (sectorId: string, shiftId: SectorShift['id'], minimum: SectorMinimum) =>
  fromApi(
    await api<ApiSector>(`/setores/${sectorId}`, {
      method: 'PATCH',
      body: JSON.stringify({ turnos: { [shiftId === 'day' ? 'diurno' : 'noturno']: toQuantitativo(minimum) } }),
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
