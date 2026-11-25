import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Bell, BellOff, LogOut, X } from '../../components/icons'
import { Drawer } from '../../components/ui/Drawer'
import { Modal } from '../../components/ui/Modal'
import { ToggleSwitch } from '../../components/ui/ToggleSwitch'
import { UserAvatar } from '../../components/ui/UserAvatar'
import type { SessionUser } from '../../services/auth'
import { getUserProfile, updateUserProfile, type UserProfile } from '../../services/profile'

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
    const initialLoad = window.setTimeout(() => void loadProfile(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadProfile])

  const initials = user.nome
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const userRole = PROFILE_LABELS[user.perfil] ?? user.perfil

  const cancelEmailEdit = () => {
    setIsEditingEmail(false)
    setEmailDraft(profile?.email ?? user.email)
    setActionError(null)
  }

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

  const handleEmailKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelEmailEdit()
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

  const header = (
    <div className="relative flex items-center gap-3 px-5 pb-4 pt-5 pr-14">
      <UserAvatar initials={initials} sizeClassName="size-16" textClassName="text-lg font-semibold text-primary" decorative />
      <div className="min-w-0 leading-tight">
        <h2 id="profile-modal-name" className="truncate text-lg font-semibold text-text">
          {user.nome}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{userRole}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar perfil"
        className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X className="size-4" strokeWidth={1.8} />
      </button>
    </div>
  )

  return (
    <>
      <Modal
        id="profile"
        labelledBy="profile-modal-name"
        escapeDisabled={isEditingEmail || preferencesOpen}
        onClose={onClose}
        header={header}
      >
        <div className="px-5 pb-5">
          {loadError ? (
            <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <p>Falha ao carregar o perfil: {loadError}</p>
              <button type="button" onClick={() => void loadProfile()} className="mt-1 font-semibold underline">
                Tentar novamente
              </button>
            </div>
          ) : null}

          <dl className="border-y border-border">
            <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3">
              <div className="min-w-0">
                <dt className="text-xs text-text-muted">E-mail</dt>
                {isEditingEmail ? null : (
                  <dd className="mt-1 truncate text-sm text-text">{profile?.email ?? user.email}</dd>
                )}
              </div>
              {isEditingEmail ? (
                <div className="col-span-2 min-w-0">
                  <form onSubmit={(event) => void saveEmail(event)} className="space-y-2">
                    <label htmlFor="profile-email" className="sr-only">E-mail</label>
                    <input
                      id="profile-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={emailDraft}
                      onChange={(event) => setEmailDraft(event.target.value)}
                      onKeyDown={handleEmailKeyDown}
                      disabled={savingEmail}
                      className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
                    />
                    {actionError ? <p role="alert" className="text-xs text-danger">{actionError}</p> : null}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={cancelEmailEdit} disabled={savingEmail} className="rounded-lg px-3 py-2 text-xs font-semibold text-text-muted hover:bg-neutral">
                        Cancelar
                      </button>
                      <button type="submit" disabled={savingEmail} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                        {savingEmail ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setIsEditingEmail(true); setActionError(null) }}
                  disabled={loading || Boolean(loadError)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Editar
                </button>
              )}
            </div>
            <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <dt className="text-xs text-text-muted">Notificações</dt>
              <dd className="flex items-center gap-2 text-sm text-text">
                {!loading && !loadError ? notificationsEnabled ? (
                  <Bell className="size-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <BellOff className="size-4 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
                ) : null}
                {loading || loadError ? '—' : notificationsEnabled ? 'Ativas' : 'Desativadas'}
              </dd>
            </div>
          </dl>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => { setActionError(null); setPreferencesOpen(true) }}
              disabled={loading || Boolean(loadError)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-text hover:bg-neutral disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Bell className="size-4" strokeWidth={1.8} />
              Preferências de notificação
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            >
              <LogOut className="size-4" strokeWidth={1.8} />
              Sair
            </button>
          </div>
        </div>
      </Modal>

      {preferencesOpen ? (
        <Drawer
          id="profile-notification-preferences"
          title="Preferências de notificação"
          description="Escolha se deseja receber avisos quando uma escala for publicada."
          onClose={() => setPreferencesOpen(false)}
          closeDisabled={savingPreferences}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" disabled={savingPreferences} onClick={() => setPreferencesOpen(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" disabled={savingPreferences} onClick={() => void savePreferences()} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {savingPreferences ? 'Salvando...' : 'Salvar preferências'}
              </button>
            </div>
          )}
        >
          {actionError ? <p role="alert" className="mb-3 rounded-lg bg-error p-3 text-sm text-danger">{actionError}</p> : null}
          <div className="flex items-center justify-between gap-5 rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-semibold text-text">Publicação de escalas</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">Receber notificações sobre publicação ou atualização das suas escalas.</p>
            </div>
            <ToggleSwitch
              label="Receber notificações de escalas"
              checked={notificationsEnabled}
              onChange={setNotificationsEnabled}
            />
          </div>
        </Drawer>
      ) : null}
    </>
  )
}
