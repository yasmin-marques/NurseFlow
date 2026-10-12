import type { SessionUser } from '../../services/auth'

export type LoginProfile = 'coordenação' | 'enfermeiro' | 'técnico'

export type LoginFormValues = {
  email: string
  password: string
}

export type LoginPageProps = {
  onLogin: (user: SessionUser) => void
}

export type ProfileOption = {
  id: LoginProfile
  title: string
  description: string
  building?: boolean
}
