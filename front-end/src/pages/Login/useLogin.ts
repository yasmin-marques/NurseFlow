import { useState, type FormEvent } from 'react'
import { login } from '../../services/auth'
import type { SessionUser } from '../../services/auth'
import type { LoginProfile } from './types'

export function useLogin(onLogin: (user: SessionUser) => void) {
  const [profile, setProfile] = useState<LoginProfile>('coordenação')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    try {
      onLogin(await login(profile, { email, password }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível entrar.')
    }
  }

  const recoverPassword = () =>
    setMessage('Entre em contato com a coordenação para redefinir sua senha.')

  return { profile, setProfile, email, setEmail, password, setPassword, message, submit, recoverPassword }
}
