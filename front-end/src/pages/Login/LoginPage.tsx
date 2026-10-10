import { LoginBrand } from './components/LoginBrand'
import { LoginField } from './components/LoginField'
import { ProfileSelector } from './components/ProfileSelector'
import { useLogin } from './useLogin'
import type { LoginPageProps } from './types'

export function LoginPage({ onLogin }: LoginPageProps) {
  const login = useLogin(onLogin)

  return (
    <main className="grid min-h-screen grid-cols-1 grid-rows-[minmax(220px,29vh)_1fr] bg-[#fbfcf9] md:grid-cols-[50%_50%] md:grid-rows-none">
      <LoginBrand />
      <section className="flex justify-center px-6 py-8.5 sm:px-8 md:items-start md:px-12 md:pb-12 md:pt-[clamp(48px,10.5vh,92px)]">
        <form className="w-full max-w-175" onSubmit={login.submit}>
          <header>
            <h1 className="m-0 text-[clamp(32px,2.8vw,34px)] font-bold leading-tight tracking-[-0.045em] text-text">Bem-vindo(a) ao NurseFlow!</h1>
            <p className="mt-2.5 text-2xl text-text-muted">Entre para consultar ou organizar os plantões.</p>
          </header>
          <ProfileSelector value={login.profile} onChange={login.setProfile} />
          <LoginField id="login-email" label="E-mail profissional" type="email" placeholder="nome@exemplo.com" autoComplete="username" value={login.email} onChange={login.setEmail} />
          <LoginField id="login-password" label="Senha" type="password" placeholder="Digite sua senha" autoComplete="current-password" value={login.password} onChange={login.setPassword} />
          <button className="mt-3.5 block border-0 bg-transparent p-0 text-[12px] font-bold text-[#267338] hover:underline" type="button" onClick={login.recoverPassword}>Esqueci minha senha</button>
          {login.message && <p className="mt-2.5 text-[15px] text-text-muted" role="status">{login.message}</p>}
          <button className="mt-5 h-12 w-full rounded-[10px] border-0 bg-[#2e8039] text-[22px] font-bold text-white shadow-[0_5px_12px_rgba(30,92,40,0.19)] transition hover:-translate-y-px hover:bg-[#276f32]" type="submit">Entrar</button>
        </form>
      </section>
    </main>
  )
}
