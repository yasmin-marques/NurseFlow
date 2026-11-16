export type ProfessionalTabId = 'inicio' | 'meus-plantoes' | 'escala-geral' | 'trocas'

export const PROFESSIONAL_TABS: { id: ProfessionalTabId; label: string }[] = [
  { id: 'inicio', label: 'Início' },
  { id: 'meus-plantoes', label: 'Meus plantões' },
  { id: 'escala-geral', label: 'Escala geral' },
  { id: 'trocas', label: 'Trocas' },
]
