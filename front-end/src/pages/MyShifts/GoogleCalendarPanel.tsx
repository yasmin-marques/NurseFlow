import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  disableGoogleCalendar,
  getGoogleCalendarStatus,
  startGoogleCalendarConnection,
  type GoogleCalendarStatus,
} from '../../services/googleCalendar'

type Feedback = { tone: 'success' | 'warning' | 'error'; text: string }

const RETURN_MESSAGES: Record<string, Feedback> = {
  conectada: { tone: 'success', text: 'Google Agenda sincronizado com sucesso.' },
  negada: { tone: 'warning', text: 'A autorização não foi concedida. Conecte novamente para permitir que o NurseFlow crie seus plantões na agenda.' },
  permissao_insuficiente: { tone: 'error', text: 'A permissão para criar eventos na agenda não foi concedida. Conecte novamente e aceite todas as permissões solicitadas.' },
  estado_invalido: { tone: 'error', text: 'O pedido de conexão expirou ou já foi usado. Clique em conectar para tentar novamente.' },
  falha: { tone: 'error', text: 'Não foi possível concluir a conexão com o Google Agenda. Tente novamente.' },
}

const STATE_LABEL: Record<GoogleCalendarStatus['estado'], string> = {
  nao_conectada: 'Não conectado',
  conectada: 'Conectado',
  desativada: 'Sincronização desativada',
  reconexao_necessaria: 'Reconexão necessária',
}

const TONE_CLASS: Record<Feedback['tone'], string> = {
  success: 'border-border bg-secondary text-primary',
  warning: 'border-border bg-warning text-warning-text',
  error: 'border-border bg-error text-text',
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Lê (e remove da URL) o resultado devolvido pelo backend após o consentimento no Google. */
function consumeReturnParam(): Feedback | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('google_agenda')
    if (!code) return null
    params.delete('google_agenda')
    const query = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
    return RETURN_MESSAGES[code] ?? RETURN_MESSAGES.falha
  } catch {
    return null
  }
}

type Props = {
  /** Troca de página para o consentimento do Google; injetável para testes. */
  redirect?: (url: string) => void
}

export function GoogleCalendarPanel({ redirect = (url) => window.location.assign(url) }: Props) {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'connect' | 'disable' | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(() => consumeReturnParam())
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownId = useId()

  useEffect(() => {
    if (feedback?.tone !== 'success') return
    const timeout = window.setTimeout(() => {
      setFeedback((current) => (current === feedback ? null : current))
    }, 5000)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const fetchStatus = useCallback(() => {
    getGoogleCalendarStatus()
      .then(setStatus)
      .catch((reason: unknown) => setLoadError(reason instanceof Error ? reason.message : 'Erro inesperado.'))
  }, [])

  /** Recarrega a partir de uma ação do usuário (limpa o erro anterior). */
  const load = useCallback(() => {
    setLoadError(null)
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const connect = async () => {
    setBusy('connect')
    setFeedback(null)
    try {
      const { url } = await startGoogleCalendarConnection()
      redirect(url)
    } catch (reason) {
      setFeedback({ tone: 'error', text: reason instanceof Error ? reason.message : 'Não foi possível iniciar a conexão.' })
      setBusy(null)
    }
  }

  const disable = async () => {
    setBusy('disable')
    setFeedback(null)
    try {
      setStatus(await disableGoogleCalendar())
      setFeedback({ tone: 'success', text: 'Sincronização desativada. Eventos já enviados permanecem na agenda.' })
    } catch (reason) {
      setFeedback({ tone: 'error', text: reason instanceof Error ? reason.message : 'Não foi possível desativar a sincronização.' })
    } finally {
      setBusy(null)
    }
  }

  const connected = status?.estado === 'conectada'
  const available = Boolean(status?.configurada) && loadError === null
  const stateLabel = loadError !== null
    ? 'Status indisponível'
    : status && !status.configurada
      ? 'Integração indisponível'
      : status ? STATE_LABEL[status.estado] : 'Verificando conexão…'
  const indicatorClass = !available
    ? 'bg-gray-400'
    : status?.estado === 'reconexao_necessaria'
      ? 'bg-amber-500'
      : connected ? 'bg-green-600' : 'bg-gray-400'
  const summary = busy === 'connect'
    ? 'Conectando…'
    : busy === 'disable'
      ? 'Dessincronizando…'
      : available && connected && status?.ultimaSincronizacaoEm
        ? `Última sinc.: ${dateTime.format(new Date(status.ultimaSincronizacaoEm))}`
        : stateLabel
  const canConnect = available && busy === null && !connected
  const canDisable = available && busy === null && connected

  const handleAction = (action: 'connect' | 'disable') => {
    if (action === 'connect' ? !canConnect : !canDisable) return
    setOpen(false)
    triggerRef.current?.focus()
    if (action === 'connect') void connect()
    else void disable()
  }

  return (
    <div ref={panelRef} className="flex max-w-full min-w-0 flex-col items-start gap-1 sm:items-end">
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? dropdownId : undefined}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold leading-none text-text transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-primary"
          onClick={() => setOpen((previous) => !previous)}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-[17px] shrink-0 text-text-muted">
            <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 2.5v3M13.5 2.5v3M3 8h14M7 11h1M12 11h1M7 14h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Google Agenda</span>
          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${indicatorClass}`} />
          <span className="sr-only">{stateLabel}</span>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={`size-3.5 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open ? (
          <div
            id={dropdownId}
            className="absolute left-0 top-full z-30 mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-xl border border-border bg-surface p-1.5 text-left shadow-lg sm:right-0 sm:left-auto"
          >
            <div className="space-y-1 px-2.5 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-text">
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${indicatorClass}`} />
                <span>{stateLabel}</span>
              </div>
              {available && connected && status?.ultimaSincronizacaoEm ? (
                <p className="text-[11px] leading-relaxed text-text-muted">
                  Última sincronização: {dateTime.format(new Date(status.ultimaSincronizacaoEm))}
                </p>
              ) : null}
              {available && connected && status && status.pendentes > 0 ? (
                <p className="text-[11px] leading-relaxed text-text-muted" role="status">
                  {status.pendentes} {status.pendentes === 1 ? 'atualização na fila' : 'atualizações na fila'}
                </p>
              ) : null}
              {connected && available ? (
                <p className="text-[11px] leading-relaxed text-text-muted">Os plantões são enviados à sua agenda automaticamente.</p>
              ) : null}
            </div>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              disabled={!canConnect}
              onClick={() => handleAction('connect')}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-primary enabled:hover:bg-neutral focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0">
                <path d="M16.5 8A6.5 6.5 0 0 0 5 5L2.5 7.5M2.5 3.5v4h4M3.5 12A6.5 6.5 0 0 0 15 15l2.5-2.5m0 4v-4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sincronizar
            </button>
            <button
              type="button"
              disabled={!canDisable}
              onClick={() => handleAction('disable')}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-red-700 enabled:hover:bg-neutral focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0">
                <path d="m7.5 12.5-1 1a3 3 0 0 1-4.2-4.2l3-3a3 3 0 0 1 4.2 0M12.5 7.5l1-1a3 3 0 0 1 4.2 4.2l-3 3a3 3 0 0 1-4.2 0M3 3l14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Dessincronizar
            </button>
          </div>
        ) : null}
      </div>
      <p className="text-[11px] font-medium text-text-muted" data-testid="google-calendar-state" aria-live="polite">
        {available && connected && status?.ultimaSincronizacaoEm ? <span className="sr-only">Conectado. </span> : null}
        {summary}
      </p>
      {status && !status.configurada ? (
        <p role="status" className="max-w-64 text-left text-[11px] sm:text-right text-text-muted">
          A integração com o Google Agenda ainda não foi configurada neste ambiente.
        </p>
      ) : null}
      {status?.estado === 'reconexao_necessaria' ? (
        <p role="alert" className="max-w-64 rounded-lg bg-warning px-2 py-1 text-[11px] font-semibold text-warning-text">
          A autorização do Google expirou ou foi revogada. Reconecte sua conta pelo menu Google Agenda.
        </p>
      ) : null}
      {loadError !== null ? (
        <div role="alert" className="flex flex-wrap items-center justify-start gap-2 text-[11px] sm:justify-end text-text">
          <span>Não foi possível carregar o estado da integração. {loadError}</span>
          <button type="button" onClick={load} className="font-semibold text-primary underline">Tentar novamente</button>
        </div>
      ) : null}
      {feedback?.tone === 'success' ? createPortal(
        <div className="fixed inset-x-4 bottom-4 z-[100] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[340px]">
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-lg">
            <div role="status" className="flex min-w-0 flex-1 items-start gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4">
                  <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="self-center text-xs font-medium leading-relaxed text-text">{feedback.text}</p>
            </div>
            <button
              type="button"
              aria-label="Fechar notificação"
              onClick={() => setFeedback(null)}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-neutral focus-visible:outline-2 focus-visible:outline-primary"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="size-3.5">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
      {feedback && feedback.tone !== 'success' ? (
        <p role="alert" className={`max-w-64 rounded-lg border px-2 py-1 text-left text-[11px] sm:text-right font-semibold ${TONE_CLASS[feedback.tone]}`}>
          {feedback.text}
        </p>
      ) : null}
    </div>
  )
}