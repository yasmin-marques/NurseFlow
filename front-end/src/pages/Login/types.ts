export type LoginProfile = 'coordenação' | 'enfermeiro' | 'técnico'

export type LoginFormValues = {
  email: string
  password: string
}

export type LoginPageProps = {
  onLogin: (profile: LoginProfile, values: LoginFormValues) => void
}

export type ProfileOption = {
  id: LoginProfile
  title: string
  description: string
  building?: boolean
}
