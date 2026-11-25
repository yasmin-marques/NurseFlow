import { useCallback, useEffect, useState } from 'react'
import {
  disableGoogleCalendar,
  getGoogleCalendarStatus,
  startGoogleCalendarConnection,
  type GoogleCalendarStatus,
} from '../../services/googleCalendar'

type Feedback = { tone: 'success' | 'warning' | 'error'; text: string }

const RETURN_MESSAGES: Record<string, Feedback> = {
  conectada: { tone: 'success', text: 'Google Agenda conectado. Seus plantões estão sendo enviados para a sua agenda.' },
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
      setFeedback({ tone: 'success', text: 'Sincronização desativada. Os eventos já enviados permanecem na sua agenda.' })
    } catch (reason) {
      setFeedback({ tone: 'error', text: reason instanceof Error ? reason.message : 'Não foi possível desativar a sincronização.' })
    } finally {
      setBusy(null)
    }
  }

  const connected = status?.estado === 'conectada'
  const actionLabel = busy === 'connect'
    ? 'Conectando ao Google Agenda'
    : busy === 'disable'
      ? 'Desativando sincronização com o Google Agenda'
      : connected
        ? 'Dessincronizar do Google Agenda'
        : 'Sincronizar com o Google Agenda'
  const disabled = busy !== null

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        aria-label={actionLabel}
        className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border border-[#d1d1ce] bg-[#f2f2ef] px-3 py-1 text-[8px] font-bold leading-none text-[#292929] hover:bg-[#e9e9e6] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || !status || !status.configurada}
        onClick={() => (connected ? void disable() : void connect())}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="size-5 shrink-0">
          <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5 2v2.5M11 2v2.5M2.5 6h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M8 8v3M6.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
        <span>{busy === 'connect' ? 'Conectando…' : busy === 'disable' ? 'Dessincronizando…' : connected ? 'Dessincronizar' : 'Google Agenda'}</span>
      </button>
      {status ? (
        <p className="text-[10px] font-medium text-text-muted" data-testid="google-calendar-state">
          Google Agenda · {STATE_LABEL[status.estado]}
          {status.estado === 'conectada' && status.ultimaSincronizacaoEm
            ? ` · última sincronização em ${dateTime.format(new Date(status.ultimaSincronizacaoEm))}`
            : ''}
          {status.estado === 'conectada' && status.pendentes > 0 ? ` · ${status.pendentes} atualização(ões) na fila` : ''}
        </p>
      ) : null}
      {status && !status.configurada ? (
        <p role="status" className="max-w-64 text-right text-[10px] text-text-muted">
          A integração com o Google Agenda ainda não foi configurada neste ambiente.
        </p>
      ) : null}
      {status?.estado === 'reconexao_necessaria' ? (
        <p role="alert" className="max-w-64 rounded-lg bg-warning px-2 py-1 text-[10px] font-semibold text-warning-text">
          A autorização do Google expirou ou foi revogada. Sincronize novamente para reconectar.
        </p>
      ) : null}
      {loadError !== null ? (
        <div role="alert" className="flex flex-wrap items-center justify-end gap-2 text-[10px] text-text">
          <span>Não foi possível carregar o estado da integração. {loadError}</span>
          <button type="button" onClick={load} className="font-semibold text-primary underline">Tentar novamente</button>
        </div>
      ) : null}
      {feedback ? (
        <p role={feedback.tone === 'success' ? 'status' : 'alert'} className={`max-w-64 rounded-lg border px-2 py-1 text-right text-[10px] font-semibold ${TONE_CLASS[feedback.tone]}`}>
          {feedback.text}
        </p>
      ) : null}
    </div>
  )
}
