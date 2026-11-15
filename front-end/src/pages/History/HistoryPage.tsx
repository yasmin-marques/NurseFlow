import { useEffect, useState, type KeyboardEvent } from 'react'
import {
  downloadPublishedScale,
  getExchangeHistory,
  getPublishedScalesHistory,
  type ExchangeHistoryItem,
  type PublishedScaleHistoryItem,
} from '../../services/history'

type HistoryTab = 'escalas' | 'trocas'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível carregar o histórico.'
}

function monthLabel(ano: number, mes: number) {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(ano, mes - 1, 1)))
  return `${label.charAt(0).toLocaleUpperCase('pt-BR')}${label.slice(1)} ${ano}`
}

function dateLabel(date: string) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(new Date(date))
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value.replace('.', '') ?? ''
  return `${day} ${month}`.toLocaleUpperCase('pt-BR')
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ScaleCard({
  scale,
  downloading,
  onDownload,
}: {
  scale: PublishedScaleHistoryItem
  downloading: boolean
  onDownload: (scale: PublishedScaleHistoryItem) => void
}) {
  return (
    <article className="flex min-h-52 flex-col rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow-soft)]">
      <span aria-hidden="true" className="mb-4 flex size-11 items-center justify-center rounded-xl bg-soft-green text-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
        </svg>
      </span>
      <h3 className="text-sm font-bold text-text">{monthLabel(scale.ano, scale.mes)}</h3>
      <p className="mt-2 text-xs text-text-muted">
        Publicado em {dateLabel(scale.publicadoEm)} · {scale.totalPlantoes} plantões
      </p>
      <p className="mt-3 text-xs font-semibold text-primary">
        {scale.percentualCobertura === null
          ? 'Cobertura indisponível'
          : `● ${scale.percentualCobertura}%`}
      </p>
      <button
        type="button"
        aria-label={`Baixar PDF da escala de ${monthLabel(scale.ano, scale.mes)}`}
        disabled={downloading}
        onClick={() => onDownload(scale)}
        className="mt-auto inline-flex items-center justify-center gap-2 pt-5 text-sm font-bold text-primary hover:underline disabled:cursor-wait disabled:opacity-60"
      >
        <span aria-hidden="true" className="text-lg leading-none">↓</span>
        {downloading ? 'Baixando PDF...' : 'PDF'}
      </button>
    </article>
  )
}

function ExchangeRow({ item }: { item: ExchangeHistoryItem }) {
  const approved = item.resultado === 'aprovada'
  return (
    <li className="grid gap-3 border-b border-border px-5 py-5 last:border-b-0 sm:grid-cols-[72px_minmax(0,1fr)_120px_minmax(140px,0.7fr)] sm:items-center sm:px-6">
      <span className="text-[11px] font-semibold text-text-muted">{dateLabel(item.decididaEm)}</span>
      <span className="text-sm font-semibold text-text">
        {item.solicitante.nome} <span aria-label="para">→</span> {item.profissionalSolicitado.nome}
      </span>
      <span className={`w-fit rounded-md px-2.5 py-1.5 text-[11px] font-bold ${approved ? 'bg-soft-green text-primary' : 'bg-red-50 text-red-700'}`}>
        {approved ? 'Aprovada' : 'Recusada'}
      </span>
      <span className="text-xs text-text-muted">Por {item.responsavel.nome}</span>
    </li>
  )
}

export function HistoryPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [tab, setTab] = useState<HistoryTab>('escalas')
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [scales, setScales] = useState<PublishedScaleHistoryItem[]>([])
  const [exchanges, setExchanges] = useState<ExchangeHistoryItem[]>([])
  const [exchangeTotalPages, setExchangeTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [downloadingId, setDownloadingId] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [failedDownload, setFailedDownload] = useState<PublishedScaleHistoryItem | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        if (tab === 'escalas') {
          const result = await getPublishedScalesHistory(year, controller.signal)
          if (active) setScales(result.itens)
        } else {
          const result = await getExchangeHistory({ ano: year, pagina: page }, controller.signal)
          if (active) {
            setExchanges(result.itens)
            setExchangeTotalPages(result.totalPaginas)
          }
        }
      } catch (error: unknown) {
        if (active && !controller.signal.aborted) setLoadError(errorMessage(error))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
      controller.abort()
    }
  }, [year, tab, page, reload])

  const changeYear = (delta: number) => {
    setYear((current) => Math.min(9999, Math.max(1, current + delta)))
    setPage(1)
  }

  const changeTab = (next: HistoryTab) => {
    setTab(next)
    setPage(1)
    setDownloadError('')
  }

  const navigateTabs = (event: KeyboardEvent<HTMLButtonElement>, current: HistoryTab) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = current === 'escalas' ? 'trocas' : 'escalas'
    changeTab(next)
    document.getElementById(`history-tab-${next}`)?.focus()
  }

  const download = async (scale: PublishedScaleHistoryItem) => {
    setDownloadingId(scale.escalaId)
    setDownloadError('')
    setFailedDownload(null)
    try {
      const { blob, filename } = await downloadPublishedScale(scale.escalaId)
      downloadFile(blob, filename)
    } catch (error: unknown) {
      setDownloadError(errorMessage(error))
      setFailedDownload(scale)
    } finally {
      setDownloadingId('')
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-10">
      <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.04em] text-text">Histórico</h1>
          <p className="mt-2 text-sm text-text-muted">Consulte escalas publicadas e decisões de troca.</p>
        </div>
        <div className="inline-flex items-center gap-3 self-start rounded-xl border border-border bg-white px-3 py-2 sm:self-auto">
          <button
            type="button"
            aria-label="Ano anterior"
            disabled={year <= 1}
            onClick={() => changeYear(-1)}
            className="size-7 rounded-lg text-lg leading-none text-text hover:bg-neutral disabled:opacity-40"
          >
            ‹
          </button>
          <span aria-live="polite" aria-label={`Ano selecionado: ${year}`} className="min-w-12 text-center text-sm font-semibold text-text">{year}</span>
          <button
            type="button"
            aria-label="Próximo ano"
            disabled={year >= 9999}
            onClick={() => changeYear(1)}
            className="size-7 rounded-lg text-lg leading-none text-text hover:bg-neutral disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </header>

      <div role="tablist" aria-label="Seções do histórico" className="mb-6 flex border-b border-border">
        <button
          id="history-tab-scales"
          type="button"
          role="tab"
          aria-selected={tab === 'escalas'}
          aria-controls="history-panel"
          tabIndex={tab === 'escalas' ? 0 : -1}
          onClick={() => changeTab('escalas')}
          onKeyDown={(event) => navigateTabs(event, 'escalas')}
          className={`border-b-2 px-4 py-3 text-xs font-bold ${tab === 'escalas' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          Escalas publicadas
        </button>
        <button
          id="history-tab-exchanges"
          type="button"
          role="tab"
          aria-selected={tab === 'trocas'}
          aria-controls="history-panel"
          tabIndex={tab === 'trocas' ? 0 : -1}
          onClick={() => changeTab('trocas')}
          onKeyDown={(event) => navigateTabs(event, 'trocas')}
          className={`border-b-2 px-4 py-3 text-xs font-bold ${tab === 'trocas' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          Histórico de trocas
        </button>
      </div>

      <section
        id="history-panel"
        role="tabpanel"
        aria-labelledby={tab === 'escalas' ? 'history-tab-scales' : 'history-tab-exchanges'}
        className="min-h-52"
      >
        {downloadError ? (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>Falha ao baixar o PDF: {downloadError}</span>
            {failedDownload ? (
              <button type="button" onClick={() => { void download(failedDownload) }} className="font-semibold underline">Tentar novamente</button>
            ) : null}
          </div>
        ) : null}
        {loading ? <p role="status" className="py-10 text-center text-sm text-text-muted">Carregando histórico...</p> : null}
        {loadError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>Falha ao carregar o histórico: {loadError}</span>
            <button type="button" onClick={() => setReload((value) => value + 1)} className="font-semibold underline">Tentar novamente</button>
          </div>
        ) : null}
        {!loading && !loadError && tab === 'escalas' && scales.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">Nenhuma escala publicada em {year}.</p>
        ) : null}
        {!loading && !loadError && tab === 'escalas' && scales.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scales.map((scale) => (
              <ScaleCard
                key={`${scale.ano}-${scale.mes}`}
                scale={scale}
                downloading={downloadingId === scale.escalaId}
                onDownload={(item) => { void download(item) }}
              />
            ))}
          </div>
        ) : null}
        {!loading && !loadError && tab === 'trocas' && exchanges.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">Nenhuma decisão de troca em {year}.</p>
        ) : null}
        {!loading && !loadError && tab === 'trocas' && exchanges.length > 0 ? (
          <>
            <ul className="overflow-hidden rounded-3xl border border-border bg-white shadow-[var(--shadow-soft)]">
              {exchanges.map((exchange) => <ExchangeRow key={exchange.id} item={exchange} />)}
            </ul>
            {exchangeTotalPages > 1 ? (
              <nav aria-label="Paginação do histórico de trocas" className="mt-5 flex items-center justify-center gap-4">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Anterior</button>
                <span aria-live="polite" className="text-sm text-text-muted">Página {page} de {exchangeTotalPages}</span>
                <button type="button" disabled={page >= exchangeTotalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Próxima</button>
              </nav>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  )
}
