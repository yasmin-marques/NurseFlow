import { useState, type FormEvent } from 'react'
import type { LoginFormValues, LoginProfile } from './types'

export function useLogin(onLogin: (profile: LoginProfile, values: LoginFormValues) => void) {
  const [profile, setProfile] = useState<LoginProfile>('coordenação')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    onLogin(profile, { email, password })
  }

  const recoverPassword = () =>
    setMessage('Entre em contato com a coordenação para redefinir sua senha.')

  return { profile, setProfile, email, setEmail, password, setPassword, message, submit, recoverPassword }
}
