import { api } from './api'

export type MyShift = {
  id: string
  data: string
  setor: string
  horarioInicio: string
  horarioFim: string
  duracaoHoras: number
  tipo: 'regular' | 'extra'
  funcao: 'enfermeiro' | 'tecnico'
  lideranca: boolean
  escala: { ano: number; mes: number }
}

export function getMyShifts() {
  return api<{ plantoes: MyShift[] }>('/minha-escala/plantoes')
}

export function getIncomingExchangeCount() {
  return api<{ recebidas: number }>('/trocas/minhas/contagem')
}
