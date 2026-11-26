import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, CalendarDays, Check, ChevronRight } from '../../components/icons'
import {
  getNotifiedScaleVersion,
  listExchangeNotifications,
  listScaleNotifications,
  markExchangeNotificationRead,
  markScaleNotificationRead,
  type ExchangeNotification,
  type NotifiedScaleVersion,
  type ScaleNotification,
} from '../../services/notifications'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
type NotificationItem = { kind: 'scale'; notification: ScaleNotification } | { kind: 'exchange'; notification: ExchangeNotification }

function relativeDate(value: string) {
  const date = new Date(value)
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))
  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `Há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Há ${hours} h`
  const days = Math.floor(hours / 24)
  return days < 7 ? `Há ${days} dias` : dateFormatter.format(date)
}

function title(item: NotificationItem) {
  if (item.kind === 'scale') return item.notification.titulo
  if (/aprovad/i.test(item.notification.titulo)) return 'Troca aprovada'
  if (/solicita/i.test(item.notification.titulo)) return 'Solicitação de troca recebida'
  return item.notification.titulo
}

function Icon({ item }: { item: NotificationItem }) {
  const Component = item.kind === 'scale' ? CalendarDays : /aprovad/i.test(item.notification.titulo) ? Check : ArrowLeftRight
  return <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#e3f2df] text-primary"><Component className="size-4" strokeWidth={1.8} /></span>
}

export function NotificationsPage({ onOpenExchange }: { onOpenExchange?: (id: string) => void }) {
  const [scales, setScales] = useState<ScaleNotification[]>([])
  const [exchanges, setExchanges] = useState<ExchangeNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<NotifiedScaleVersion | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [scaleList, exchangeList] = await Promise.all([listScaleNotifications(), listExchangeNotifications()])
      setScales(scaleList.notificacoes); setExchanges(exchangeList.notificacoes)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as notificações.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const initialLoad = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [reload])

  const items = useMemo<NotificationItem[]>(() => [...scales.map((notification) => ({ kind: 'scale' as const, notification })), ...exchanges.map((notification) => ({ kind: 'exchange' as const, notification }))].sort((a, b) => {
    const date = (item: NotificationItem) => item.kind === 'scale' ? item.notification.criadoEm : item.notification.criadaEm
    return new Date(date(b)).getTime() - new Date(date(a)).getTime()
  }), [exchanges, scales])
  const unread = items.filter((item) => !item.notification.lidaEm)

  const markRead = async (item: NotificationItem) => {
    setPendingId(item.notification.id)
    try {
      const result = item.kind === 'scale' ? await markScaleNotificationRead(item.notification.id) : await markExchangeNotificationRead(item.notification.id)
      if (item.kind === 'scale') setScales((current) => current.map((notification) => notification.id === item.notification.id ? { ...notification, lidaEm: result.lidaEm } : notification))
      else setExchanges((current) => current.map((notification) => notification.id === item.notification.id ? { ...notification, lidaEm: result.lidaEm } : notification))
      window.dispatchEvent(new Event('nurseflow:notifications-updated'))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a notificação.') }
    finally { setPendingId(null) }
  }

  const markAllRead = async () => {
    setPendingId('all')
    try {
      await Promise.all(unread.map((item) => item.kind === 'scale' ? markScaleNotificationRead(item.notification.id) : markExchangeNotificationRead(item.notification.id)))
      const now = new Date().toISOString()
      setScales((current) => current.map((notification) => ({ ...notification, lidaEm: notification.lidaEm ?? now })))
      setExchanges((current) => current.map((notification) => ({ ...notification, lidaEm: notification.lidaEm ?? now })))
      window.dispatchEvent(new Event('nurseflow:notifications-updated'))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível marcar todas as notificações como lidas.') }
    finally { setPendingId(null) }
  }

  const openItem = async (item: NotificationItem) => {
    if (!item.notification.lidaEm) await markRead(item)
    if (item.kind === 'exchange') { onOpenExchange?.(item.notification.solicitacaoId); return }
    try { setSelectedVersion(await getNotifiedScaleVersion(item.notification.escalaId, item.notification.versao)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a escala publicada.') }
  }

  return <main className="mx-auto min-h-full w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Atualizações</p><h1 className="mt-1 text-[28px] font-bold tracking-[-0.04em] text-text">Notificações</h1><p className="mt-2 text-sm text-text-muted">Publicações, alterações e respostas de troca.</p></div>
      <button type="button" disabled={pendingId !== null || unread.length === 0} onClick={() => void markAllRead()} className="min-h-10 rounded-xl border border-border bg-white px-4 text-xs font-bold text-text shadow-sm transition-colors hover:bg-neutral disabled:cursor-not-allowed disabled:opacity-50">{pendingId === 'all' ? 'Atualizando...' : 'Marcar como lidas'}</button>
    </header>
    {error ? <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger"><span>{error}</span><button type="button" onClick={() => void reload()} className="font-bold underline">Tentar novamente</button></div> : null}
    {loading ? <p role="status" className="mt-8 text-sm text-text-muted">Carregando notificações...</p> : null}
    {!loading && items.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center"><p className="font-semibold text-text">Nenhuma notificação</p><p className="mt-2 text-sm text-text-muted">Suas atualizações aparecerão aqui.</p></div> : null}
    {!loading && items.length > 0 ? <section aria-label="Lista de notificações" className="mt-6 overflow-hidden rounded-2xl border border-border bg-white shadow-(--shadow-soft)"><ul className="divide-y divide-border">{items.map((item) => { const unreadItem = !item.notification.lidaEm; const date = item.kind === 'scale' ? item.notification.criadoEm : item.notification.criadaEm; return <li key={`${item.kind}-${item.notification.id}`}><button type="button" onClick={() => void openItem(item)} disabled={pendingId === item.notification.id} className={`group flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[#fbfcfa] sm:px-5 ${unreadItem ? 'bg-[#fcfefb]' : ''}`}><Icon item={item} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className={`truncate text-xs font-bold ${unreadItem ? 'text-text' : 'text-text-muted'}`}>{title(item)}</span>{unreadItem ? <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-label="Não lida" /> : null}</span><span className="mt-1 block truncate text-[11px] text-text-muted">{item.notification.mensagem}</span><time className="mt-1 block text-[9px] text-text-muted" dateTime={date}>{relativeDate(date)}</time></span><ChevronRight className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} /></button></li> })}</ul></section> : null}
    {selectedVersion ? <section aria-label="Escala publicada" className="mt-6 rounded-2xl border border-primary/30 bg-white p-5 shadow-(--shadow-soft)"><button type="button" onClick={() => setSelectedVersion(null)} className="text-xs font-bold text-primary hover:underline">Voltar às notificações</button><h2 className="mt-4 text-lg font-bold text-text">Escala {String(selectedVersion.versao.mes).padStart(2, '0')}/{selectedVersion.versao.ano}</h2><p className="mt-1 text-sm text-text-muted">Versão {selectedVersion.versao.numero} · publicada em {dateFormatter.format(new Date(selectedVersion.versao.publicadoEm))}</p><p className="mt-3 text-sm text-text-muted">Cobertura: {selectedVersion.snapshot.visualizacao?.cobertura?.percentual == null ? 'indisponível' : `${selectedVersion.snapshot.visualizacao.cobertura.percentual}%`}</p></section> : null}
  </main>
}
