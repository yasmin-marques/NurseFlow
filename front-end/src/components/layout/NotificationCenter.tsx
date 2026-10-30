import { useCallback, useEffect, useState } from 'react'
import { Bell } from '../icons'
import {
  getNotifiedScaleVersion,
  listScaleNotifications,
  markScaleNotificationRead,
  type NotifiedScaleVersion,
  type ScaleNotification,
  type ScaleNotificationList,
} from '../../services/notifications'
import { getNotificationIndicator } from './notificationIndicator'
import { Drawer } from '../ui/Drawer'

const formatDateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const formatDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<ScaleNotificationList>({ notificacoes: [], naoLidas: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<NotifiedScaleVersion | null>(null)
  const [loadingVersion, setLoadingVersion] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setList(await listScaleNotifications())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as notificações.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    listScaleNotifications()
      .then((result) => {
        if (active) setList(result)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as notificações.')
      })
    return () => {
      active = false
    }
  }, [])

  const markRead = async (notification: ScaleNotification) => {
    setPendingId(notification.id)
    setError(null)
    try {
      const result = await markScaleNotificationRead(notification.id)
      setList((current) => ({
        ...current,
        naoLidas: Math.max(0, current.naoLidas - (notification.lidaEm ? 0 : 1)),
        notificacoes: current.notificacoes.map((item) =>
          item.id === notification.id ? { ...item, lidaEm: result.lidaEm } : item,
        ),
      }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a notificação.')
    } finally {
      setPendingId(null)
    }
  }

  const markAllRead = async () => {
    if (pendingId) return
    setPendingId('all')
    setError(null)
    try {
      for (const notification of list.notificacoes.filter((item) => !item.lidaEm)) {
        const result = await markScaleNotificationRead(notification.id)
        setList((current) => ({
          ...current,
          naoLidas: Math.max(0, current.naoLidas - 1),
          notificacoes: current.notificacoes.map((item) => item.id === notification.id ? { ...item, lidaEm: result.lidaEm } : item),
        }))
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível marcar todas as notificações como lidas.')
    } finally {
      setPendingId(null)
    }
  }

  const viewScale = async (notification: ScaleNotification) => {
    setLoadingVersion(true)
    setError(null)
    try {
      setSelectedVersion(await getNotifiedScaleVersion(notification.escalaId, notification.versao))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a escala publicada.')
    } finally {
      setLoadingVersion(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    setSelectedVersion(null)
    if (next) void reload()
  }

  const visualizacao = selectedVersion?.snapshot.visualizacao
  const indicator = getNotificationIndicator(list.naoLidas)

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-white/80 text-text-muted shadow-sm transition-colors hover:bg-white"
        aria-label={indicator.label}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? 'scale-notifications-panel' : undefined}
        onClick={toggle}
      >
        <Bell className="size-4" strokeWidth={1.8} />
        {indicator.hasUnread ? (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-danger ring-2 ring-white" aria-hidden />
        ) : null}
      </button>

      {open ? (
        <Drawer
          id="notifications-drawer"
          title={selectedVersion ? 'Escala publicada' : 'Notificações'}
          description={selectedVersion ? `Versão ${selectedVersion.versao.numero}` : 'Veja as informações e escolha o próximo passo'}
          onClose={() => setOpen(false)}
          footer={!selectedVersion ? <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-neutral">Cancelar</button><button type="button" disabled={loading || pendingId !== null || list.naoLidas === 0} onClick={() => void markAllRead()} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pendingId === 'all' ? 'Atualizando...' : 'Marcar como lidas'}</button></div> : undefined}
        >
        <div id="scale-notifications-panel">
          {selectedVersion ? (
            <div>
              <button
                type="button"
                onClick={() => setSelectedVersion(null)}
                className="mb-3 text-xs font-semibold text-primary hover:underline"
              >
                Voltar às notificações
              </button>
              {visualizacao ? (
                <>
                  <p className="font-semibold text-text">
                    Escala {String(selectedVersion.versao.mes).padStart(2, '0')}/{selectedVersion.versao.ano}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Cobertura: {visualizacao.cobertura?.percentual == null ? 'indisponível' : `${visualizacao.cobertura.percentual}%`}
                  </p>
                  {visualizacao.pendencias.length > 0 ? (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {visualizacao.pendencias.length} pendência(s) de cobertura permanecem nesta versão.
                    </p>
                  ) : null}
                  <ul className="mt-3 space-y-2">
                    {visualizacao.plantoes.map((shift) => (
                      <li key={shift.id} className="rounded-xl border border-border p-3 text-xs">
                        <p className="font-semibold text-text">
                          {formatDate.format(new Date(`${shift.data}T00:00:00.000Z`))} · {shift.setor.nome}
                        </p>
                        <p className="mt-1 text-text-muted">
                          {shift.horarioInicio}–{shift.horarioFim} · {shift.tipo === 'extra' ? 'Extra' : 'Regular'}
                        </p>
                        <p className="mt-1 text-text">
                          {shift.profissionais.map((professional) => professional.nome).join(', ') || 'Sem profissionais alocados'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-text-muted">Esta versão não possui dados de exibição disponíveis.</p>
              )}
            </div>
          ) : (
            <div>
              {error ? (
                <div role="alert" className="m-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">
                  <p>{error}</p>
                  <button type="button" className="mt-2 font-semibold underline" onClick={() => void reload()}>
                    Tentar novamente
                  </button>
                </div>
              ) : null}
              {loading ? <p className="px-1 py-5 text-sm text-text-muted">Carregando notificações...</p> : null}
              {!loading && list.notificacoes.length === 0 ? (
                <p className="px-1 py-5 text-sm text-text-muted">Você não tem notificações de escala.</p>
              ) : null}
              <ul>
                {list.notificacoes.map((notification) => (
                  <li
                    key={notification.id}
                    className={`border-b border-border px-1 py-3 last:border-b-0 ${notification.lidaEm ? '' : 'bg-secondary/30'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {!notification.lidaEm ? <span className="sr-only">Não lida. </span> : null}
                        <p className="text-sm font-semibold text-text">{notification.titulo}</p>
                        <p className="mt-1 text-xs leading-relaxed text-text-muted">{notification.mensagem}</p>
                        <time className="mt-2 block text-[11px] text-text-muted" dateTime={notification.criadoEm}>
                          {formatDateTime.format(new Date(notification.criadoEm))}
                        </time>
                      </div>
                      {!notification.lidaEm ? (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void viewScale(notification)}
                        disabled={loadingVersion}
                        className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        {loadingVersion ? 'Abrindo escala...' : 'Ver escala publicada'}
                      </button>
                      {!notification.lidaEm ? (
                        <button
                          type="button"
                          onClick={() => void markRead(notification)}
                          disabled={pendingId === notification.id}
                          className="text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50"
                        >
                          {pendingId === notification.id ? 'Atualizando...' : 'Marcar como lida'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Drawer>
      ) : null}
    </div>
  )
}
