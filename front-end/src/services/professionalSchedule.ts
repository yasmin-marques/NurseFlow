import { api } from './api'

export type ShiftSituation = 'proximos' | 'anteriores'
export type ShiftStatus = 'trabalhando' | 'trabalhado'
export type DayShift = 'diurno' | 'noturno' | '24h'

export interface MyShift {
  plantaoId: string
  /** Dia de início (AAAA-MM-DD). */
  data: string
  horarioInicio: string
  horarioFim: string
  duracaoHoras: number
  tipo: 'regular' | 'extra'
  setor: { id: string; nome: string }
  funcao: 'enfermeiro' | 'tecnico'
  lideranca: boolean
  status: ShiftStatus
  chefe: { nome: string } | null
  enfermeiros: { nome: string; lideranca: boolean }[]
  tecnicos: { nome: string }[]
}

export interface MyShiftsPage {
  itens: MyShift[]
  pagina: number
  limite: number
  total: number
  totalPaginas: number
}

export interface GeneralDay {
  data: string
  turnos: { turno: DayShift; horarioInicio: string; horarioFim: string }[]
  chefe: { nome: string } | null
  setores: string[]
}

export interface GeneralMonth {
  ano: number
  mes: number
  publicada: boolean
  versao: { numero: number; publicadoEm: string } | null
  dias: GeneralDay[]
}

export interface DayStaff {
  nome: string
  cargo: string
  setores: string[]
  regime: string
}

export interface GeneralDayDetails {
  data: string
  publicada: boolean
  chefe: { nome: string; setores: string[]; regime: string } | null
  enfermeiros: DayStaff[]
  tecnicos: DayStaff[]
  contagens: { enfermeiros: number; tecnicos: number }
}

const BASE = '/escala-profissional'

export function getMyShifts(situacao: ShiftSituation, pagina = 1, limite = 20): Promise<MyShiftsPage> {
  return api<MyShiftsPage>(`${BASE}/meus-plantoes?situacao=${situacao}&pagina=${pagina}&limite=${limite}`)
}

export function getGeneralMonth(ano: number, mes: number): Promise<GeneralMonth> {
  return api<GeneralMonth>(`${BASE}/geral?ano=${ano}&mes=${mes}`)
}

export function getGeneralDay(data: string): Promise<GeneralDayDetails> {
  return api<GeneralDayDetails>(`${BASE}/geral/dia?data=${encodeURIComponent(data)}`)
}
