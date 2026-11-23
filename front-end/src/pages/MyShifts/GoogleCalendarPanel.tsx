import { useCallback, useEffect, useState } from 'react'
import { CalendarPlus } from '../../components/icons'
import {
  disableGoogleCalendar,
  getGoogleCalendarStatus,
  startGoogleCalendarConnection,
  syncGoogleCalendar,
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
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disable' | null>(null)
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

  const sync = async () => {
    setBusy('sync')
    setFeedback(null)
    try {
      const result = await syncGoogleCalendar()
      setStatus(result.estado)
      // O sucesso só é exibido quando o processamento terminou sem falhas; parcial e falha ficam visíveis.
      setFeedback({
        tone: result.resultado === 'sucesso' ? 'success' : result.resultado === 'parcial' ? 'warning' : 'error',
        text: result.mensagem,
      })
    } catch (reason) {
      setFeedback({ tone: 'error', text: reason instanceof Error ? reason.message : 'Não foi possível sincronizar.' })
      load()
    } finally {
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

  const primary = 'rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60'
  const secondary = 'rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text hover:bg-neutral disabled:cursor-not-allowed disabled:opacity-60'
  const disabled = busy !== null

  return (
    <section aria-labelledby="google-calendar-title" className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-(--shadow-soft)">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <CalendarPlus className="size-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2 id="google-calendar-title" className="text-sm font-bold text-text">Google Agenda</h2>
            <p className="mt-1 text-xs text-text-muted">
              Envie seus plantões oficiais para a sua agenda. A sincronização é só de ida: alterações feitas no Google não mudam a escala.
            </p>
            {status ? (
              <p className="mt-2 text-xs font-semibold text-text" data-testid="google-calendar-state">
                {STATE_LABEL[status.estado]}
                {status.estado === 'conectada' && status.ultimaSincronizacaoEm
                  ? ` · última sincronização em ${dateTime.format(new Date(status.ultimaSincronizacaoEm))}`
                  : ''}
                {status.estado === 'conectada' && status.pendentes > 0 ? ` · ${status.pendentes} atualização(ões) na fila` : ''}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {status && (status.estado === 'nao_conectada' || status.estado === 'desativada') ? (
            <button type="button" className={primary} disabled={disabled || !status.configurada} onClick={connect}>
              {busy === 'connect' ? 'Redirecionando…' : 'Conectar Google Agenda'}
            </button>
          ) : null}
          {status?.estado === 'reconexao_necessaria' ? (
            <button type="button" className={primary} disabled={disabled || !status.configurada} onClick={connect}>
              {busy === 'connect' ? 'Redirecionando…' : 'Reconectar'}
            </button>
          ) : null}
          {status?.estado === 'conectada' ? (
            <button type="button" className={primary} disabled={disabled} onClick={sync}>
              {busy === 'sync' ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
          ) : null}
          {status && (status.estado === 'conectada' || status.estado === 'reconexao_necessaria') ? (
            <button type="button" className={secondary} disabled={disabled} onClick={disable}>
              {busy === 'disable' ? 'Desativando…' : 'Desativar sincronização'}
            </button>
          ) : null}
        </div>
      </div>

      {status && !status.configurada ? (
        <p role="status" className="mt-3 text-xs text-text-muted">
          A integração com o Google Agenda ainda não foi configurada neste ambiente. Fale com a administração do sistema.
        </p>
      ) : null}

      {status?.estado === 'reconexao_necessaria' ? (
        <p role="alert" className="mt-3 rounded-lg bg-warning px-3 py-2 text-xs font-semibold text-warning-text">
          A autorização do Google expirou ou foi revogada. Reconecte sua conta para voltar a sincronizar os plantões.
        </p>
      ) : null}

      {loadError !== null ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-error px-3 py-2 text-xs text-text">
          <span>Não foi possível carregar o estado da integração. {loadError}</span>
          <button type="button" onClick={load} className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-hover">
            Tentar novamente
          </button>
        </div>
      ) : null}

      {feedback ? (
        <p role={feedback.tone === 'success' ? 'status' : 'alert'} className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${TONE_CLASS[feedback.tone]}`}>
          {feedback.text}
        </p>
      ) : null}
    </section>
  )
}
