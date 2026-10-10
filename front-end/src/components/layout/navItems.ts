import {
  ArrowLeftRight,
  Building2,
  CalendarDays,
  CalendarPlus,
  Clock,
  History,
  LayoutDashboard,
  Settings,
  Users,
  type AppIcon,
} from '../icons'

export type NavItemId =
  | 'visao-geral'
  | 'escala'
  | 'profissionais'
  | 'disponibilidade'
  | 'extras'
  | 'trocas'
  | 'setores'
  | 'historico'
  | 'configuracoes'

export type NavItem = {
  id: NavItemId
  label: string
  icon: AppIcon
  href: string
  badge?: number
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard, href: '/' },
  { id: 'escala', label: 'Escala', icon: CalendarDays, href: '/escala' },
  { id: 'profissionais', label: 'Profissionais', icon: Users, href: '/profissionais' },
  { id: 'disponibilidade', label: 'Disponibilidade', icon: Clock, href: '/disponibilidade' },
  { id: 'extras', label: 'Extras', icon: CalendarPlus, href: '/extras' },
  { id: 'trocas', label: 'Trocas', icon: ArrowLeftRight, href: '/trocas', badge: 3 },
  { id: 'setores', label: 'Setores', icon: Building2, href: '/setores' },
  { id: 'historico', label: 'Histórico', icon: History, href: '/historico' },
  { id: 'configuracoes', label: 'Configurações', icon: Settings, href: '/configuracoes' },
]
