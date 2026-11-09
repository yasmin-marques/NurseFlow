import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../services/api'
import { aprovarTroca, listarTrocas, obterTroca, recusarTroca, validarTroca, type Troca, type TrocaTab, type ValidacaoTroca } from '../../services/trocas'

const TABS: { id: TrocaTab; label: string }[] = [
  { id: 'pendentes', label: 'Pendentes' }, { id: 'aprovadas', label: 'Aprovadas' }, { id: 'recusadas', label: 'Recusadas' },
]
const dateLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
const dateLong = (value: string) => new Date(value).toLocaleDateString('pt-BR', { dateStyle: 'full', timeZone: 'UTC' })

function ExchangeDetails({ troca, validation, onClose }: { troca: Troca; validation: ValidacaoTroca | null; onClose: () => void }) {
  const finalizada = troca.status !== 'aguardando_coordenacao'
  const recusada = troca.status === 'recusada_pela_coordenacao' || troca.status === 'recusada_pelo_profissional'
  const status = troca.status === 'aprovada' ? 'Solicitação aprovada' : recusada ? 'Solicitação recusada' : 'Aguardando Coordenação'
  const justificativa = troca.decisaoCoordenacao?.justificativa
  const avisosVisiveis = validation?.avisos.filter((aviso) => aviso.codigo !== 'COBERTURA_INSUFICIENTE') ?? []

  return <section aria-label="Detalhes da troca" className="mt-4 min-w-0 rounded-xl border border-border bg-page p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
      <h3 className="text-sm font-bold text-text">Detalhes da solicitação</h3>
      <p className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${troca.status === 'aprovada' ? 'bg-highlight text-primary' : recusada ? 'bg-red-50 text-red-700' : 'bg-neutral text-text-muted'}`}>{status}</p>
    </div>
    <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {[troca.plantaoSolicitante, troca.plantaoSolicitado].map((plantao, index) => <article key={index} className="min-w-0 rounded-lg border border-border bg-white p-4">
        <h4 className="text-xs font-bold text-text">{index === 0 ? 'Plantão do solicitante' : 'Plantão do profissional solicitado'}</h4>
        {plantao ? <dl className="mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm leading-5">
          <dt className="text-text-muted">Profissional</dt><dd className="min-w-0 break-words font-medium text-text">{plantao.profissional}</dd>
          <dt className="text-text-muted">Data</dt><dd className="min-w-0 break-words text-text">{dateLong(plantao.data)}</dd>
          <dt className="text-text-muted">Horário</dt><dd className="min-w-0 text-text">{plantao.horarioInicio}–{plantao.horarioFim}</dd>
          <dt className="text-text-muted">Setor</dt><dd className="min-w-0 break-words text-text">{plantao.setor}</dd>
          <dt className="text-text-muted">Função</dt><dd className="min-w-0 break-words text-text">{plantao.funcao}</dd>
        </dl> : <p className="mt-3 text-sm text-text-muted">Informações do plantão indisponíveis.</p>}
      </article>)}
    </div>
    {validation && (validation.impedimentos.length > 0 || avisosVisiveis.length > 0) ? <div aria-label="Elegibilidade da troca" className="mt-4 space-y-2 text-sm leading-5">
      {validation.impedimentos.map((item, index) => <p key={`${item.codigo}-${index}`} className="break-words text-red-700">{item.mensagem}</p>)}
      {avisosVisiveis.map((item, index) => <p key={`${item.codigo}-${index}`} className="break-words text-amber-700">{item.mensagem}</p>)}
    </div> : null}
    {finalizada && justificativa ? <p className="mt-4 break-words border-t border-border pt-3 text-sm leading-5 text-text"><span className="font-semibold">Motivo da recusa:</span> {justificativa}</p> : null}
    {troca.historico?.length ? <ol aria-label="Histórico de decisão" className="mt-4 space-y-2 border-t border-border pt-3">
      {troca.historico.map((event, index) => <li key={`${event.resultado}-${event.decididaEm}-${index}`} className="break-words text-xs leading-5 text-text">
        <span className="font-semibold">{event.resultado === 'aprovada' ? 'Aprovada' : 'Recusada'}</span> por {event.responsavel} · {new Date(event.decididaEm).toLocaleString('pt-BR')}
        {event.justificativa ? <p className="mt-1 text-text-muted">Motivo: {event.justificativa}</p> : null}
        {event.excecaoLimite ? <p className="mt-1 text-amber-700">Exceção ao limite autorizada.</p> : null}
      </li>)}
    </ol> : null}
    <button type="button" onClick={onClose} className="mt-3 min-h-10 px-2 text-[11px] font-medium text-text-muted underline underline-offset-2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Fechar detalhes</button>
  </section>
}

export function ExchangesPage({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const now = useMemo(() => new Date(), [])
  const [tab, setTab] = useState<TrocaTab>('pendentes')
  const [month, setMonth] = useState<number | undefined>(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [items, setItems] = useState<Troca[]>([])
  const [counts, setCounts] = useState<Record<TrocaTab, number>>({ pendentes: 0, aprovadas: 0, recusadas: 0 })
  const [selected, setSelected] = useState<Troca | null>(null)
  const [validation, setValidation] = useState<ValidacaoTroca | null>(null)
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [exception, setException] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const focusReturnRef = useRef<HTMLElement | null>(null)
  const changeTab = (next: TrocaTab) => { setSelected(null); setValidation(null); setTab(next) }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const page = await listarTrocas({ status: tab, ano: year, mes: month })
      setItems(page.itens); setCounts({ pendentes: page.contadores.pendentes, aprovadas: page.contadores.aprovadas, recusadas: page.contadores.recusadas }); onCountChange?.(page.contadores.aguardandoCoordenacao)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as solicitações.') }
    finally { setLoading(false) }
  }, [tab, year, month, onCountChange])
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) void load() })
    return () => { cancelled = true }
  }, [load])

  const openDetails = async (item: Troca) => {
    setSelected(item); setValidation(null); setError(null)
    try {
      const detail = await obterTroca(item.id); setSelected(detail)
      if (detail.status === 'aguardando_coordenacao') setValidation(await validarTroca(item.id))
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os detalhes.') }
    return false
  }
  const closeDialog = useCallback(() => { if (!saving) { setDialog(null); setReason(''); requestAnimationFrame(() => focusReturnRef.current?.focus()) } }, [saving])
  useEffect(() => {
    if (!dialog) return
    dialogRef.current?.querySelector<HTMLElement>('button,textarea')?.focus()
    const onKey = (event: KeyboardEvent | React.KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog()
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [
          ...dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled),textarea:not(:disabled),input:not(:disabled)',
          ),
        ].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        if (!focusable.length) return
        const first = focusable[0]; const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [dialog, saving, closeDialog])

  const decide = async () => {
    const limiteAtingido = validation?.avisos.some((item) => item.codigo === 'LIMITE_ATINGIDO') ?? false
    if (!selected || dialog === 'approve' && (validation?.impedimentos.length || limiteAtingido && (!exception || !reason.trim())) || dialog === 'reject' && !reason.trim()) return
    setSaving(true); setError(null)
    try {
      const operacaoId = crypto.randomUUID()
      if (dialog === 'approve') await aprovarTroca(selected.id, { revisaoEsperada: validation!.revisaoEsperada, operacaoId,
        excecaoLimite: exception, justificativa: exception ? reason.trim() : undefined })
      else await recusarTroca(selected.id, { revisaoEsperada: selected.plantaoSolicitante?.escala?.revisao ?? 0, operacaoId, justificativa: reason.trim() })
      setNotice(dialog === 'approve' ? 'Troca aprovada e confirmada pelo servidor.' : 'Troca recusada e confirmada pelo servidor.')
      setDialog(null); setSelected(null); setValidation(null); setReason(''); setException(false)
      window.dispatchEvent(new Event('nurseflow:trocas-updated'))
      await load()
    } catch (cause) { setError(cause instanceof ApiError && cause.status === 409 ? `A solicitação mudou desde a última consulta. ${cause.message}` : cause instanceof Error ? cause.message : 'Não foi possível registrar a decisão.') }
    finally { setSaving(false) }
  }
  const askDecision = async (item: Troca, decision: 'approve' | 'reject', trigger: HTMLElement) => {
    focusReturnRef.current = trigger
    if (await openDetails(item)) { setException(false); setReason(''); setDialog(decision) }
  }

  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)
  const yearOptions = Array.from({ length: 7 }, (_, index) => now.getFullYear() - 3 + index)
  return <section className="mx-auto min-h-full w-full max-w-[1200px] px-5 py-8 sm:px-8" aria-labelledby="exchange-heading">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 id="exchange-heading" className="text-[28px] font-bold tracking-tight text-text">Solicitações de troca</h1><p className="mt-1 text-sm text-text-muted">Analise as trocas acordadas, respeitando limites e competências.</p></div>
      <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="exchange-month">Mês</label><select id="exchange-month" value={month ?? ''} onChange={(event) => { setSelected(null); setValidation(null); setMonth(event.target.value ? Number(event.target.value) : undefined) }} className="rounded-lg border border-border bg-white px-3 py-2 text-sm"><option value="">Todos os meses</option>{monthOptions.map((value) => <option key={value} value={value}>{new Date(2000, value - 1).toLocaleString('pt-BR', { month: 'long' })}</option>)}</select><label className="sr-only" htmlFor="exchange-year">Ano</label><select id="exchange-year" value={year} onChange={(event) => { setSelected(null); setValidation(null); setYear(Number(event.target.value)) }} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">{yearOptions.map((value) => <option key={value}>{value}</option>)}</select></div>
    </header>
    <div role="tablist" aria-label="Situação das solicitações" onKeyDown={(event) => { if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; event.preventDefault(); const index = TABS.findIndex((item) => item.id === tab); const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]; changeTab(next.id); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[role="tab"][data-tab="${next.id}"]`)?.focus()) }} className="mt-7 flex overflow-x-auto border-b border-border">{TABS.map(({ id, label }) => <button key={id} id={`exchange-tab-${id}`} data-tab={id} type="button" role="tab" aria-controls={`exchange-panel-${id}`} tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} onClick={() => changeTab(id)} className={`shrink-0 border-b-2 px-4 py-3 text-xs font-semibold ${tab === id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}>{label}{counts[id] ? <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 text-[10px]">{counts[id]}</span> : null}</button>)}</div>
    <div role="tabpanel" id={`exchange-panel-${tab}`} aria-labelledby={`exchange-tab-${tab}`} tabIndex={0}>
    {error ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={() => void load()} className="ml-3 font-bold underline">Tentar novamente</button></div> : null}
    {notice ? <div role="status" aria-live="polite" className="mt-5 rounded-xl bg-highlight p-4 text-sm font-medium text-primary">{notice}<button type="button" onClick={() => setNotice(null)} className="ml-3 underline">Fechar</button></div> : null}
    {loading ? <p role="status" className="py-12 text-center text-sm text-text-muted">Carregando solicitações…</p> : items.length === 0 ? <div className="mt-6 rounded-2xl border border-border bg-white px-6 py-14 text-center"><p className="font-semibold text-text">Nenhuma solicitação neste período</p><p className="mt-1 text-sm text-text-muted">Quando houver solicitações registradas, elas aparecerão aqui.</p></div> : <ul className="mt-5 space-y-4">{items.map((item) => {
      const shift = item.plantaoSolicitante
      const completed = tab !== 'pendentes'
      const expanded = selected?.id === item.id && !dialog
      return <li key={item.id} className="min-w-0 rounded-2xl border border-border bg-white p-4 shadow-(--shadow-soft) sm:p-5">
        <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
          <div className="row-span-1 flex size-14 flex-col items-center justify-center rounded-xl bg-secondary text-primary"><span className="text-[9px] font-bold uppercase">{shift ? new Date(shift.data).toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }) : '—'}</span><span className="text-lg font-bold leading-tight">{shift ? new Date(shift.data).getUTCDate() : '—'}</span></div>
          <div className="min-w-0"><p className="break-words text-sm font-bold leading-5 text-text">{item.solicitante.nome} <span aria-hidden>→</span> {item.profissionalSolicitado.nome}</p><p className="mt-1 break-words text-xs leading-5 text-text-muted">{shift ? `Plantão ${shift.tipo} · ${shift.setor} · ${shift.horarioInicio}—${shift.horarioFim}` : 'Dados do plantão indisponíveis'}</p><p className="mt-1 break-words text-[11px] leading-4 text-text-muted">Solicitado em {dateLabel(item.criadaEm)}{item.decisaoCoordenacao?.justificativa ? ` · ${item.decisaoCoordenacao.justificativa}` : ''}</p></div>
          <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-end gap-2 sm:col-span-1">
            {completed ? <span className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab === 'aprovadas' ? 'bg-highlight text-primary' : 'bg-red-50 text-red-700'}`}>{tab === 'aprovadas' ? 'Solicitação aprovada' : item.status === 'recusada_pelo_profissional' ? 'Recusada pelo profissional' : 'Solicitação recusada'}</span> : null}
            <button data-focus-return="true" type="button" aria-expanded={expanded} aria-controls={`exchange-details-${item.id}`} onClick={() => { if (expanded) { setSelected(null); setValidation(null) } else void openDetails(item) }} className="min-h-10 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-text-muted hover:bg-neutral hover:text-text">Detalhes</button>
            {!completed ? <><button type="button" disabled={item.status !== 'aguardando_coordenacao'} onClick={(event) => void askDecision(item, 'reject', event.currentTarget)} className="min-h-10 rounded-lg bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">Recusar</button><button type="button" disabled={item.status !== 'aguardando_coordenacao'} onClick={(event) => void askDecision(item, 'approve', event.currentTarget)} className="min-h-10 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-white hover:brightness-95 disabled:opacity-50">Aprovar</button></> : null}
          </div>
        </div>
        {expanded && selected ? <div id={`exchange-details-${item.id}`} className="min-w-0"><ExchangeDetails troca={selected} validation={validation} onClose={() => { setSelected(null); setValidation(null) }} /></div> : null}
      </li>
    })}</ul>}
    </div>
    {dialog && selected ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="exchange-dialog-title" aria-describedby="exchange-dialog-description" aria-busy={saving} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-2xl sm:p-6"><h2 id="exchange-dialog-title" className="text-center text-base font-bold">{dialog === 'approve' ? 'Tem certeza que deseja aprovar?' : 'Tem certeza que deseja recusar?'}</h2><p id="exchange-dialog-description" className="mt-1 text-center text-sm text-text-muted">{dialog === 'approve' ? 'A troca será aplicada à escala oficial.' : 'A troca não será realizada.'}</p><p className="mt-3 text-center text-xs font-medium text-text">{selected.solicitante.nome} <span aria-hidden>→</span> {selected.profissionalSolicitado.nome}</p>{dialog === 'reject' || dialog === 'approve' && validation?.avisos.some((item) => item.codigo === 'LIMITE_ATINGIDO') ? <label className="mt-4 block text-sm font-semibold">{dialog === 'reject' ? 'Motivo da recusa' : 'Justificativa da exceção de limite'}<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} required={dialog === 'reject' || exception} className="mt-1 w-full rounded-lg border border-border p-3 text-sm font-normal" placeholder={dialog === 'reject' ? 'Informe o motivo que será comunicado aos profissionais.' : 'Justifique a autorização excepcional do limite.'} /></label> : null}{dialog === 'approve' && validation?.impedimentos.length ? <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">{validation.impedimentos.map((item, index) => <p key={`${item.codigo}-${index}`}>{item.mensagem}</p>)}</div> : null}{dialog === 'approve' && validation?.avisos.some((item) => item.codigo === 'LIMITE_ATINGIDO') ? <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={exception} onChange={(event) => setException(event.target.checked)} />Autorizar exceção somente ao limite mensal</label> : null}<div className="mt-5 flex justify-center gap-3"><button type="button" disabled={saving} onClick={closeDialog} className="min-h-10 rounded-lg bg-neutral px-6 py-2.5 text-xs font-semibold">Não</button><button type="button" disabled={saving || dialog === 'reject' && !reason.trim() || dialog === 'approve' && (Boolean(validation?.impedimentos.length) || validation?.avisos.some((item) => item.codigo === 'LIMITE_ATINGIDO') && (!exception || !reason.trim()))} onClick={() => void decide()} className={`min-h-10 rounded-lg px-6 py-2.5 text-xs font-bold text-white disabled:opacity-50 ${dialog === 'approve' ? 'bg-primary' : 'bg-red-600'}`}>{saving ? 'Processando…' : dialog === 'approve' ? '✓ Sim' : '✕ Sim'}</button></div></div></div> : null}
  </section>
}
