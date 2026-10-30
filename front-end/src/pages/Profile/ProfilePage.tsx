import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Bell, Search, X } from '../../components/icons'
import { NotificationCenter } from '../../components/layout/NotificationCenter'
import { Drawer } from '../../components/ui/Drawer'
import { ToggleSwitch } from '../../components/ui/ToggleSwitch'
import type { SessionUser } from '../../services/auth'
import { getUserProfile, updateUserProfile, type UserProfile } from '../../services/profile'
import logo from '../../assets/logo.png'

type ProfilePageProps = {
  user: SessionUser
  onClose: () => void
  onUserUpdated: (user: SessionUser) => void
  onLogout: () => void
}

const PROFILE_LABELS: Record<string, string> = {
  coordenacao: 'Coordenação',
  enfermeiro: 'Enfermeiro',
  tecnico: 'Técnico',
}

const FORMATION_LABELS = {
  enfermeiro: 'Enfermeira',
  tecnico: 'Técnica',
} as const

const BOND_LABELS = {
  concursado: 'Concursado',
  clt: 'CLT',
  rpa: 'RPA',
} as const

export function ProfilePage({ user, onClose, onUserUpdated, onLogout }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState(user.email)
  const [actionError, setActionError] = useState<string | null>(null)
  const [savingEmail, setSavingEmail] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await getUserProfile()
      setProfile(result)
      setEmailDraft(result.email)
      setNotificationsEnabled(result.recebeNotificacoesEscala)
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Não foi possível carregar o perfil.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const initials = user.nome
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const userRole = PROFILE_LABELS[user.perfil] ?? user.perfil
  const profession = profile?.formacao
    ? FORMATION_LABELS[profile.formacao]
    : userRole
  const professionalDetails = [
    profession,
    profile?.coren ? (profile.coren.toLocaleLowerCase('pt-BR').startsWith('coren') ? profile.coren : `COREN ${profile.coren}`) : null,
  ].filter(Boolean).join(' · ')

  const saveEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingEmail(true)
    setActionError(null)
    try {
      const result = await updateUserProfile({ email: emailDraft })
      setProfile(result)
      setEmailDraft(result.email)
      onUserUpdated({ ...user, email: result.email })
      setIsEditingEmail(false)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o e-mail.')
    } finally {
      setSavingEmail(false)
    }
  }

  const savePreferences = async () => {
    setSavingPreferences(true)
    setActionError(null)
    try {
      const result = await updateUserProfile({ recebeNotificacoesEscala: notificationsEnabled })
      setProfile(result)
      setPreferencesOpen(false)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível salvar as preferências.')
    } finally {
      setSavingPreferences(false)
    }
  }

  return (
    <div className="flex h-[100dvh] min-h-[580px] w-full flex-col overflow-y-auto bg-[#fafbf7] text-[#20231f]">
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#e9ebe5] bg-white px-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logo} alt="NurseFlow" className="size-9 shrink-0 object-contain" />
          <div className="leading-tight">
            <p className="text-[17px] font-bold tracking-tight text-[#20231f]">NurseFlow</p>
            <p className="mt-1 text-[11px] text-[#777d74]">Gestão de escalas</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl border border-[#e5e7e2] bg-white text-[#666d64]">
            <Search className="size-4" strokeWidth={1.8} />
          </span>
          <NotificationCenter />
          <div className="ml-1 flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e7f2e3] text-[11px] font-bold text-[#27653b]">
              {initials}
            </span>
            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="max-w-40 truncate text-[11px] font-semibold text-[#20231f]">{user.nome}</p>
              <p className="mt-1 text-[10px] text-[#777d74]">{userRole}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-8">
        <section
          aria-label="Perfil do usuário"
          className="relative w-full max-w-[304px] rounded-[20px] border border-[#e8eae5] bg-white px-6 pb-6 pt-[27px] shadow-[0_12px_30px_rgba(27,35,25,0.07)]"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar perfil"
            className="absolute right-[29px] top-[24px] flex size-8 items-center justify-center rounded-[10px] border border-[#e7e9e4] text-[#777d74] transition-colors hover:bg-[#f5f6f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e783d]"
          >
            <X className="size-4" strokeWidth={1.7} />
          </button>

          <div className="flex flex-col items-center text-center">
            <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-[#e7f2e3] text-[17px] font-bold text-[#27653b]">
              {initials}
            </span>
            <h1 className="mt-[19px] max-w-full break-words text-[25px] font-bold leading-tight tracking-[-0.045em] text-[#20231f]">
              {user.nome}
            </h1>
            <p className="mt-[22px] min-h-[18px] text-[14px] text-[#777d74]">
              {loading ? 'Carregando perfil...' : professionalDetails}
            </p>
          </div>

          {loadError ? (
            <div role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
              <p>Falha ao carregar o perfil: {loadError}</p>
              <button type="button" onClick={() => void loadProfile()} className="mt-1 font-semibold underline">
                Tentar novamente
              </button>
            </div>
          ) : null}

          <dl className="mt-[27px] grid min-h-[75px] grid-cols-3 overflow-hidden rounded-[14px] border border-[#e8eae5]">
            <div className="flex min-w-0 flex-col items-center justify-center border-r border-[#e8eae5] px-1.5 py-3">
              <dt className="text-[9px] text-[#777d74]">Vínculo</dt>
              <dd className="mt-1.5 truncate text-[11px] font-bold text-[#20231f]">
                {loading ? '—' : profile?.tipoVinculo ? BOND_LABELS[profile.tipoVinculo] : '—'}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center border-r border-[#e8eae5] px-1.5 py-3">
              <dt className="text-[9px] text-[#777d74]">Próximo setor</dt>
              <dd className="mt-1.5 max-w-full truncate text-[11px] font-bold text-[#20231f]">
                {loading ? '—' : profile?.proximoSetor ?? '—'}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center px-1.5 py-3">
              <dt className="text-[9px] text-[#777d74]">Jornada</dt>
              <dd className="mt-1.5 truncate text-[11px] font-bold text-[#20231f]">—</dd>
            </div>
          </dl>

          <div className="mt-[27px]">
            {isEditingEmail ? (
              <form onSubmit={(event) => void saveEmail(event)} className="rounded-xl border border-[#dfe2db] bg-[#f7f8f5] p-2.5">
                <label htmlFor="profile-email" className="sr-only">E-mail</label>
                <input
                  id="profile-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  disabled={savingEmail}
                  className="w-full rounded-lg border border-[#e0e3dc] bg-white px-2.5 py-2 text-[11px] text-[#343a32] outline-none focus:border-[#2e783d]"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => { setIsEditingEmail(false); setEmailDraft(profile?.email ?? user.email); setActionError(null) }} className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#666d64] hover:bg-white">
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingEmail} className="rounded-md bg-[#e5f1e1] px-2.5 py-1 text-[10px] font-bold text-[#27653b] disabled:opacity-60">
                    {savingEmail ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex min-h-[31px] items-center justify-center gap-2 rounded-[11px] border border-[#dfe2db] bg-[#f7f8f5] px-2.5 py-1.5">
                <span className="min-w-0 truncate text-[9px] text-[#626960]">{profile?.email ?? user.email}</span>
                <button
                  type="button"
                  onClick={() => { setIsEditingEmail(true); setActionError(null) }}
                  disabled={loading || Boolean(loadError)}
                  className="shrink-0 rounded-md bg-[#e5f1e1] px-1.5 py-1 text-[9px] font-semibold text-[#27653b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Editar
                </button>
              </div>
            )}
            {actionError && !preferencesOpen ? <p role="alert" className="mt-1.5 text-center text-[10px] text-red-700">{actionError}</p> : null}
          </div>

          <button
            type="button"
            onClick={() => { setActionError(null); setPreferencesOpen(true) }}
            disabled={loading || Boolean(loadError)}
            className="mt-[15px] flex h-[34px] w-full items-center justify-center gap-2 rounded-[11px] border border-[#dfe2db] bg-white px-3 text-[11px] font-semibold text-[#20231f] transition-colors hover:bg-[#f7f8f5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Bell className="size-[14px]" strokeWidth={1.9} />
            Preferências de notificação
          </button>

          <div className="mt-[15px] flex justify-center">
            <button
              type="button"
              onClick={onLogout}
              className="h-[39px] rounded-[11px] bg-[#fff0f0] px-4 text-[12px] font-bold text-[#b83232] transition-colors hover:bg-[#ffe6e6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b83232]"
            >
              Sair
            </button>
          </div>
        </section>
      </main>

      {preferencesOpen ? (
        <Drawer
          id="profile-notification-preferences"
          title="Preferências de notificação"
          description="Escolha se deseja receber avisos quando uma escala for publicada."
          onClose={() => setPreferencesOpen(false)}
          closeDisabled={savingPreferences}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" disabled={savingPreferences} onClick={() => setPreferencesOpen(false)} className="rounded-xl border border-[#e0e3dc] px-4 py-2.5 text-sm font-semibold text-[#343a32] disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" disabled={savingPreferences} onClick={() => void savePreferences()} className="rounded-xl bg-[#2e783d] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {savingPreferences ? 'Salvando...' : 'Salvar preferências'}
              </button>
            </div>
          )}
        >
          {actionError ? <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{actionError}</p> : null}
          <div className="flex items-center justify-between gap-5 rounded-xl border border-[#e8eae5] p-4">
            <div>
              <p className="text-sm font-semibold text-[#20231f]">Publicação de escalas</p>
              <p className="mt-1 text-xs leading-relaxed text-[#777d74]">Receber notificações sobre publicação ou atualização das suas escalas.</p>
            </div>
            <ToggleSwitch
              label="Receber notificações de escalas"
              checked={notificationsEnabled}
              onChange={setNotificationsEnabled}
            />
          </div>
        </Drawer>
      ) : null}
    </div>
  )
}
