import { type ReactNode, useEffect, useState } from 'react'
import { createDraft, exportScalePdf, listScales, saveShiftBatch, startReview, validateScale, validateShiftBatch, type ShiftBatchChange, type ScaleDetail } from '../../services/scales'
import { GenerateScaleDialog } from './GenerateScaleDialog'
import { ExportScaleDrawer } from './ExportScaleDrawer'
import { PublishScaleDialog } from './PublishScaleDialog'
import { RemovePublishedScaleDialog } from './RemovePublishedScaleDialog'
import { ScaleShiftDialog } from './ScaleShiftDialog'
import { canEditScale, formatValidationErrors, stageShiftChanges } from './review'
import { calendarDate, calendarDays, dateKey, dayIndicators, formatWeek, summarizeDayShifts, type CalendarView } from './calendar'
import { getScaleWorkflow } from './workflow'
import { CoverageAlert } from '../../components/ui/ScaleComponents'
import { coverageSurfaceClass } from '../../components/ui/coverageStyles'
import { WeeklyDayCard } from './WeeklyDayCard'
import { MonthPeriodNavigation, monthLabel } from './MonthPeriodNavigation'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WARNING_PAGE_SIZE = 10

function statusStyle(state: ReturnType<typeof dayIndicators>['state']) {
  return coverageSurfaceClass(state)
}

function WorkflowCard({ scale, onGenerate, onCreateManual, creatingManual, manualCreationDisabled, onReview, onValidateAndPublish, onExcludePublished, stagedCount, onSave, saving, validating, changesSaved }: {
  scale: ScaleDetail | null
  onGenerate: () => void
  onCreateManual: () => void
  creatingManual: boolean
  manualCreationDisabled: boolean
  onReview: () => void
  onValidateAndPublish: () => void
  onExcludePublished: () => void
  stagedCount: number
  onSave: () => void
  saving: boolean
  validating: boolean
  changesSaved: boolean
}) {
  const published = scale?.escala.status === 'publicada' || scale?.escala.status === 'finalizada'
  const hasPublication = Boolean(scale && (scale.escala.versaoPublicada ?? 0) > 0 && scale.escala.status !== 'excluida')
  const canValidate = scale?.escala.status === 'em_revisao' || scale?.escala.status === 'validada'
  const workflow = getScaleWorkflow(scale?.escala.status ?? null, changesSaved)
  const badgeStyles = {
    neutral: 'bg-neutral text-text-muted',
    warning: 'bg-warning text-warning-text',
    success: 'bg-highlight text-primary',
    info: 'bg-badge-blue text-badge-blue-text',
  }
  return <section aria-label="Fluxo da escala" className="overflow-hidden rounded-2xl border border-border bg-white shadow-(--shadow-soft)">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div><h3 className="text-sm font-bold text-text">Fluxo da escala</h3><p className="mt-1 text-xs text-text-muted">Gere, revise e publique somente depois de validar os conflitos.</p></div>
      <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wide ${badgeStyles[workflow.tone]}`}>{workflow.badge}</span>
    </header>
    <ol aria-label="Etapas da escala" className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
      {workflow.steps.map((step, index) => <li key={step.label} aria-current={step.current ? 'step' : undefined} className={`flex items-center gap-2 text-xs ${step.complete || step.current ? 'font-semibold text-primary' : 'text-text-muted'}`}>
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${step.complete || step.current ? 'border-primary bg-primary text-white' : 'border-border bg-neutral'}`}>{step.complete ? '✓' : index + 1}</span>
        <span>{step.label}</span>{index < workflow.steps.length - 1 ? <span aria-hidden className="hidden h-px flex-1 bg-border sm:block" /> : null}
      </li>)}
    </ol>
    {!scale ? <div className="mx-5 mb-5 grid gap-4 rounded-xl bg-soft-green p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <div><p className="text-xs font-bold text-text">Crie uma escala usando os dados da equipe</p><p className="mt-1 max-w-xl text-[11px] leading-relaxed text-text-muted">O sistema considera status, restrições, ausências, descanso, cobertura mínima, extras, setores e turnos individuais.</p></div>
      <button type="button" disabled={creatingManual || manualCreationDisabled} onClick={onCreateManual} className="rounded-xl border border-primary px-5 py-3 text-sm font-bold text-primary hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{creatingManual ? 'Criando rascunho...' : 'Montar manualmente'}</button>
      <button type="button" onClick={onGenerate} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:brightness-95">Configurar geração</button>
    </div> : <div className="flex flex-wrap gap-2 px-5 pb-5">
      {!published ? <>
        <button type="button" onClick={onReview} className="rounded-lg border border-border bg-neutral px-3 py-2 text-xs font-semibold text-text-muted hover:bg-border">Editar escala</button>
        <button type="button" onClick={onGenerate} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-neutral">Gerar novamente</button>
        <button type="button" disabled={saving || stagedCount === 0} onClick={onSave} className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
        {canValidate ? <button type="button" disabled={saving || validating} onClick={onValidateAndPublish} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:brightness-95 disabled:opacity-50">{validating ? 'Validando...' : 'Validar e publicar'}</button> : null}
      </> : <>
        <button type="button" onClick={onReview} className="rounded-lg border border-border bg-neutral px-3 py-2 text-xs font-semibold text-text-muted hover:bg-border">Editar escala</button>
        <button type="button" onClick={onExcludePublished} className="rounded-lg border border-danger bg-danger px-3 py-2 text-xs font-semibold text-white hover:bg-danger/90">Excluir escala publicada</button>
      </>}
      {!published && hasPublication ? <button type="button" onClick={onExcludePublished} className="rounded-lg border border-danger bg-danger px-3 py-2 text-xs font-semibold text-white hover:bg-danger/90">Excluir escala publicada</button> : null}
    </div>}
  </section>
}

interface RestWarning {
  id: string
  profissional: string
  descricao: string
}

function findRestWarnings(scale: ScaleDetail): RestWarning[] {
  const warnings = scale.conflitos.flatMap((finding, index) => {
    const profissional = finding.profissional ?? finding.profissionalId
    return finding.tipo.includes('DESCANSO') && profissional
      ? [{
          id: `${finding.profissionalId ?? profissional}-${finding.tipo}-${index}`,
          profissional,
          descricao: finding.motivo,
        }]
      : []
  })
  const schedules = new Map<string, {
    profissional: string
    shifts: Array<{ data: string; inicio: string; duracao: number; inicioMs: number }>
  }>()

  for (const shift of scale.plantoes) {
    for (const profissional of shift.profissionais) {
      const start = Date.parse(`${shift.data}T${shift.horarioInicio}:00Z`)
      const schedule = schedules.get(profissional.id) ?? { profissional: profissional.nome, shifts: [] }
      schedule.shifts.push({
        data: shift.data,
        inicio: shift.horarioInicio,
        duracao: shift.duracaoHoras,
        inicioMs: start,
      })
      schedules.set(profissional.id, schedule)
    }
  }

  for (const [profissionalId, schedule] of schedules) {
    schedule.shifts.sort((a, b) => a.inicioMs - b.inicioMs)
    for (let index = 0; index < schedule.shifts.length - 1; index += 1) {
      const anterior = schedule.shifts[index]
      const seguinte = schedule.shifts[index + 1]
      const parDiurnoNoturno =
        anterior.data === seguinte.data &&
        anterior.duracao === 12 &&
        anterior.inicio === '07:00' &&
        seguinte.duracao === 12 &&
        seguinte.inicio === '19:00'
      if (parDiurnoNoturno) continue

      const descansoMinimo = anterior.duracao >= 24 ? 72 : 36
      const descansoDisponivel =
        (seguinte.inicioMs - anterior.inicioMs) / 3_600_000 - anterior.duracao
      if (descansoDisponivel >= descansoMinimo) continue

      warnings.push({
        id: `${profissionalId}-${anterior.data}-${anterior.inicio}-${seguinte.data}-${seguinte.inicio}`,
        profissional: schedule.profissional,
        descricao: `Folga de ${descansoDisponivel}h entre plantões de ${anterior.data} ${anterior.inicio} e ${seguinte.data} ${seguinte.inicio}; mínimo de ${descansoMinimo}h.`,
      })
    }
  }

  return warnings
}

function formatWarningDate(data: string) {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function PaginatedWarningList<T>({
  label,
  items,
  getKey,
  renderItem,
}: {
  label: string
  items: T[]
  getKey: (item: T, index: number) => string
  renderItem: (item: T) => ReactNode
}) {
  const [currentPage, setCurrentPage] = useState(0)
  const pageCount = Math.ceil(items.length / WARNING_PAGE_SIZE)
  const page = Math.min(currentPage, pageCount - 1)
  const pageItems = items.slice(page * WARNING_PAGE_SIZE, (page + 1) * WARNING_PAGE_SIZE)

  return (
    <div className="bg-white p-4">
      <ul className="space-y-2">
        {pageItems.map((item, index) => (
          <li key={getKey(item, index)} className="text-xs text-warning-text">
            {renderItem(item)}
          </li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <nav aria-label={`Paginação: ${label}`} className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <button
            type="button"
            aria-label={`Página anterior: ${label}`}
            disabled={page === 0}
            onClick={() => setCurrentPage(page - 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-neutral disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span aria-live="polite" className="text-xs text-text-muted">Página {page + 1} de {pageCount}</span>
          <button
            type="button"
            aria-label={`Próxima página: ${label}`}
            disabled={page >= pageCount - 1}
            onClick={() => setCurrentPage(page + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-neutral disabled:cursor-not-allowed disabled:opacity-50"
          >
            Próxima
          </button>
        </nav>
      ) : null}
    </div>
  )
}

export function ScaleWarnings({ scale }: { scale: ScaleDetail }) {
  if (scale.escala.status === 'publicada' || scale.escala.status === 'finalizada') return null

  const pendingWorkloads = scale.cargas.flatMap((carga) => {
    const faltam24h = carga.faltam?.plantoes24h ?? Math.max(0, carga.esperada.plantoes24h - carga.atribuida.plantoes24h)
    const faltam12h = carga.faltam?.plantoes12h ?? Math.max(0, carga.esperada.plantoes12h - carga.atribuida.plantoes12h)
    const falta = [
      faltam24h > 0 ? `${faltam24h} plantão(ões) de 24h` : '',
      faltam12h > 0 ? `${faltam12h} plantão(ões) de 12h` : '',
    ].filter(Boolean)
    return falta.length > 0 ? [{ id: carga.profissionalId, nome: carga.profissional, falta }] : []
  })
  const restWarnings = findRestWarnings(scale)
  const vacancies = scale.pendencias
  const warningCount = pendingWorkloads.length + restWarnings.length + vacancies.length

  if (warningCount === 0) return null
  return (
    <details aria-label="Avisos da escala" className="overflow-hidden rounded-2xl border border-warning bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-warning/20 px-5 py-4 text-sm font-bold text-warning-text">
        <span>Avisos da escala</span>
        <span className="rounded-full bg-warning px-2.5 py-1 text-xs">{warningCount} {warningCount === 1 ? 'aviso' : 'avisos'}</span>
      </summary>
      <div className="grid gap-3 border-t border-warning p-4">
        {pendingWorkloads.length > 0 ? (
          <details className="overflow-hidden rounded-xl border border-warning/50">
            <summary className="cursor-pointer list-none bg-warning/10 px-4 py-3 text-xs font-bold text-warning-text">
              Profissionais abaixo da carga regular ({pendingWorkloads.length})
            </summary>
            <PaginatedWarningList
              label="profissionais abaixo da carga regular"
              items={pendingWorkloads}
              getKey={(item) => item.id}
              renderItem={(item) => <><span className="font-semibold">{item.nome}:</span> faltam {item.falta.join(' e ')}.</>}
            />
          </details>
        ) : null}

        {restWarnings.length > 0 ? (
          <details className="overflow-hidden rounded-xl border border-warning/50">
            <summary className="cursor-pointer list-none bg-warning/10 px-4 py-3 text-xs font-bold text-warning-text">
              Profissionais com alerta de descanso ({restWarnings.length})
            </summary>
            <PaginatedWarningList
              label="profissionais com alerta de descanso"
              items={restWarnings}
              getKey={(warning) => warning.id}
              renderItem={(warning) => <><span className="font-semibold">{warning.profissional}:</span> {warning.descricao}</>}
            />
          </details>
        ) : null}

        {vacancies.length > 0 ? (
          <details className="overflow-hidden rounded-xl border border-warning/50">
            <summary className="cursor-pointer list-none bg-warning/10 px-4 py-3 text-xs font-bold text-warning-text">
              Setores abaixo do mínimo por dia ({vacancies.length})
            </summary>
            <PaginatedWarningList
              label="setores abaixo do mínimo por dia"
              items={vacancies}
              getKey={(vacancy, index) => `${vacancy.setorId}-${vacancy.data}-${vacancy.turno}-${vacancy.funcao}-${index}`}
              renderItem={(vacancy) => <><span className="font-semibold">{vacancy.setor}{vacancy.subsetor ? ` · ${vacancy.subsetor}` : ''}:</span>{' '}
                {formatWarningDate(vacancy.data)} · {vacancy.turno === '24h' ? '24h' : vacancy.turno === 'diurno' ? 'Diurno' : 'Noturno'} ·{' '}
                {vacancy.funcao === 'enfermeiros' ? 'enfermeiros' : 'técnicos'}; faltam {vacancy.faltam}.</>}
            />
          </details>
        ) : null}
      </div>
    </details>
  )
}

function CalendarDay({
  date,
  activeMonth,
  selected,
  scale,
  onSelect,
}: {
  date: Date
  activeMonth: number
  selected: boolean
  scale: ScaleDetail | null
  onSelect: () => void
}) {
  const key = dateKey(date)
  const indicators = dayIndicators(scale, key)
  const shifts = scale?.plantoes.filter((shift) => shift.data === key) ?? []
  const team = summarizeDayShifts(shifts)
  const chefeGeral = scale?.chefesGerais?.find((item) => item.data === key)
  const outsideMonth = date.getMonth() !== activeMonth
  const stateLabel = {
    conflict: 'Conflito',
    restricted: 'Cobertura por restrição',
    partial: 'Cobertura parcial',
    covered: 'Escala regular',
    empty: 'Sem plantões',
  }[indicators.state]

  return (
    <button
      type="button"
      aria-label={`${date.toLocaleDateString('pt-BR', { dateStyle: 'full' })}: ${stateLabel}, ${shifts.length} plantões`}
      aria-pressed={selected}
      onClick={onSelect}
      className={`min-h-44 w-full min-w-0 border p-2 text-left transition-colors hover:bg-neutral sm:p-3 ${statusStyle(indicators.state)} ${outsideMonth ? 'opacity-55' : ''} ${selected ? 'ring-2 ring-inset ring-primary' : ''}`}
    >
      <span className={`inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold ${indicators.state === 'conflict' ? 'bg-error text-danger' : indicators.state === 'partial' || indicators.state === 'restricted' ? 'bg-warning text-warning-text' : 'bg-highlight text-primary'}`}>
        {date.getDate()}
      </span>
      {shifts.length ? <>
        <span className="mt-2 block text-[8px] font-bold uppercase tracking-wide text-text-muted">CHEFE GERAL</span>
        <span className="block truncate text-[10px] font-semibold text-text">{chefeGeral?.nome ?? 'Não informado'}</span>
        <span className="mt-2 block text-[10px] text-text-muted">♙ {team.nurses} enfermeiros</span>
        <span className="block text-[10px] text-text-muted">♧ {team.technicians} técnicos</span>
      </> : <span className="mt-2 block text-[9px] font-bold uppercase tracking-wide text-text-muted">{stateLabel}</span>}
      {indicators.state === 'partial' || indicators.state === 'restricted' ? (
        <CoverageAlert state={indicators.state}>
          {indicators.missingPositions > 0
            ? `${indicators.missingPositions} vaga(s) descoberta(s)`
            : 'Cobertura por restrição'}
        </CoverageAlert>
      ) : null}
      {indicators.conflictCount > 0 ? (
        <CoverageAlert state="conflict">
          {indicators.conflictCount} conflito(s)
        </CoverageAlert>
      ) : null}
    </button>
  )
}

export function GenerationLoading() {
  return (
    <section role="status" aria-live="polite" aria-label="Gerando a escala" className="flex min-h-120 flex-col items-center justify-center rounded-2xl border border-border bg-white px-6 text-center shadow-(--shadow-soft)">
      <span aria-hidden="true" className="size-20 animate-spin rounded-full border-[9px] border-neutral border-r-primary" />
      <h3 className="mt-4 text-base font-bold text-text">Gerando a escala...</h3>
      <p className="mt-5 max-w-2xl text-xs leading-relaxed text-text-muted">
        Verificando profissionais disponíveis, restrições, descansos, setores, lideranças, extras e cobertura mínima.
      </p>
      <ul className="mt-5 flex flex-wrap justify-center gap-2 text-[10px] font-bold text-primary">
        {['Disponibilidade', 'Restrições', 'Cobertura por setor'].map((label) => (
          <li key={label} className="rounded-xl bg-highlight px-4 py-2.5">✓ {label}</li>
        ))}
      </ul>
    </section>
  )
}

export function ScalePage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })
  const [view, setView] = useState<CalendarView>('month')
  const [scales, setScales] = useState<ScaleDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [generationInProgress, setGenerationInProgress] = useState(false)
  const [creatingManual, setCreatingManual] = useState(false)
  const [showExportDrawer, setShowExportDrawer] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [showRemovePublishedDialog, setShowRemovePublishedDialog] = useState(false)
  const [showShiftDialog, setShowShiftDialog] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [stagedChanges, setStagedChanges] = useState<ShiftBatchChange[]>([])
  const [savingBatch, setSavingBatch] = useState(false)
  const [validating, setValidating] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [changesSaved, setChangesSaved] = useState(false)
  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth() + 1
  const days = calendarDays(view, selectedDate)
  const visibleAnchor = view === 'month' ? calendarDate(year, month - 1, 1) : calendarDays('week', selectedDate)[0]
  const visibleAnchorKey = dateKey(visibleAnchor)
  const visiblePeriodKey = [...new Set(calendarDays(view, new Date(`${visibleAnchorKey}T12:00:00`))
    .map((day) => `${day.getFullYear()}-${day.getMonth() + 1}`)
    .filter((period) => {
      const year = Number(period.split('-')[0])
      return year >= 1 && year <= 9999
    }))].join(',')

  useEffect(() => {
    let active = true
    const visiblePeriods = visiblePeriodKey.split(',').map((period) => {
      const [ano, mes] = period.split('-').map(Number)
      return { ano, mes }
    })
    Promise.all(visiblePeriods.map((period) => listScales(period.ano, period.mes)))
      .then((results) => {
        if (active) setScales(results.flat())
      })
      .catch((cause: unknown) => {
        if (active) {
          setScales([])
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a escala.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [visiblePeriodKey, reload])

  const matchingScale = scales.find((item) => item.escala.ano === year && item.escala.mes === month) ?? null
  const isPublished = Boolean(matchingScale && (matchingScale.escala.versaoPublicada ?? 0) > 0 && matchingScale.escala.status !== 'excluida')

  const changePeriod = (direction: -1 | 1) => {
    if (stagedChanges.length > 0) { setBatchError('Salve ou descarte as alterações staged antes de mudar de período.'); return }
    const next = view === 'month'
      ? calendarDate(year, month - 1 + direction, 1)
      : new Date(selectedDate)
    if (view === 'week') next.setDate(next.getDate() + direction * 7)
    if (next.getFullYear() < 1 || next.getFullYear() > 9999) return
    setLoading(true)
    setError('')
    setSelectedDate(next)
  }

  const retry = () => {
    setLoading(true)
    setError('')
    setReload((value) => value + 1)
  }

  const downloadScale = async (scope: 'general' | 'sector'): Promise<boolean> => {
    if (!matchingScale) {
      setExportError('Não há escala para exportar no período selecionado.')
      return false
    }
    if (!isPublished) {
      setExportError('A escala precisa estar publicada para ser exportada.')
      return false
    }
    setExporting(true)
    setExportError('')
    try {
      const options = scope === 'sector' ? { separarPorSetor: true as const } : undefined
      const { blob, filename } = await exportScalePdf(matchingScale.escala.id, options)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      return true
    } catch (cause: unknown) {
      setExportError(cause instanceof Error ? cause.message : 'Não foi possível exportar a escala.')
      return false
    } finally {
      setExporting(false)
    }
  }

  const replaceScale = (updatedScale: ScaleDetail) => {
    setScales((current) => [
      ...current.filter(
        (item) =>
          item.escala.ano !== updatedScale.escala.ano ||
          item.escala.mes !== updatedScale.escala.mes,
      ),
      updatedScale,
    ])
  }

  const removePublishedScale = () => {
    if (!matchingScale) return
    setScales((current) => current.filter((item) => item.escala.id !== matchingScale.escala.id))
    setShowRemovePublishedDialog(false)
    setReload((value) => value + 1)
  }

  const createManualDraft = async () => {
    if (matchingScale || creatingManual || loading || generationInProgress) return
    setCreatingManual(true)
    setError('')
    try {
      const draft = await createDraft(year, month)
      replaceScale(draft)
      setSelectedDate(calendarDate(year, month - 1, 1))
      setView('week')
      setShowShiftDialog(true)
      setReload((value) => value + 1)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o rascunho para montagem manual.')
    } finally {
      setCreatingManual(false)
    }
  }

  const startScaleReview = async (scale: ScaleDetail) => {
    const reviewed = scale.escala.status === 'rascunho'
      ? await startReview(scale.escala.id, scale.escala.revisao)
      : scale
    if (reviewed.escala.status !== 'em_revisao') {
      throw new Error('A API não confirmou que a escala entrou em revisão. Tente novamente.')
    }
    return reviewed
  }

  const saveStagedChanges = async (pending: ShiftBatchChange[] = stagedChanges) => {
    if (!matchingScale || pending.length === 0 || savingBatch) return
    setSavingBatch(true)
    setBatchError('')
    try {
      const forceConflicts = pending.some((change) => change.forcarConflitos === true)
      const validation = await validateShiftBatch(matchingScale.escala.id, matchingScale.escala.revisao, pending, forceConflicts)
      if (!validation.valida) throw new Error(formatValidationErrors(validation.erros))
      const updated = await saveShiftBatch(matchingScale.escala.id, matchingScale.escala.revisao, pending, forceConflicts)
      replaceScale(updated)
      setStagedChanges([])
      setChangesSaved(true)
    } catch (cause: unknown) {
      setBatchError(cause instanceof Error ? cause.message : 'Não foi possível salvar as alterações. As mudanças continuam staged.')
    } finally {
      setSavingBatch(false)
    }
  }

  const validateAndPublish = async () => {
    if (!matchingScale || validating) return
    if (stagedChanges.length > 0) {
      setBatchError('Salve as alterações antes de validar e publicar a escala.')
      return
    }
    if (matchingScale.escala.status === 'validada') {
      setShowPublishDialog(true)
      return
    }

    setLoading(true)
    setValidating(true)
    setError('')
    try {
      const validated = await validateScale(matchingScale.escala.id, matchingScale.escala.revisao)
      if (validated.escala.status !== 'validada') {
        throw new Error('A validação não foi confirmada pela API. Tente novamente.')
      }
      replaceScale(validated)
      setChangesSaved(true)
      setShowPublishDialog(true)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível validar a escala.')
    } finally {
      setValidating(false)
      setLoading(false)
    }
  }

  const openReview = async () => {
    if (!matchingScale || matchingScale.escala.status !== 'rascunho') {
      setView('week')
      setSelectedDate(calendarDate(year, month - 1, 1))
      return
    }

    setLoading(true)
    setError('')
    try {
      const reviewed = await startScaleReview(matchingScale)
      replaceScale(reviewed)
      setView('week')
      setSelectedDate(calendarDate(year, month - 1, 1))
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a revisão da escala.')
    } finally {
      setLoading(false)
    }
  }

  const calendarTitle = view === 'month' ? monthLabel(selectedDate) : formatWeek(days)
  const monthIndex = selectedDate.getMonth()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 px-5 py-7 sm:px-7 lg:px-9">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.04em] text-text">Escala</h2>
          <p className="mt-2 text-sm text-text-muted">Liderança, equipes e setores organizados por dia de plantão.</p>
        </div>
        {isPublished ? <button type="button" onClick={() => { setExportError(''); setShowExportDrawer(true) }} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text hover:bg-neutral">Exportar PDF</button> : null}
      </header>

      <WorkflowCard scale={matchingScale} onGenerate={() => setShowGenerateDialog(true)} onCreateManual={() => void createManualDraft()} creatingManual={creatingManual} manualCreationDisabled={loading || generationInProgress} onReview={() => void openReview()} onValidateAndPublish={() => void validateAndPublish()} onExcludePublished={() => setShowRemovePublishedDialog(true)} stagedCount={stagedChanges.length} onSave={() => void saveStagedChanges()} saving={savingBatch} validating={validating} changesSaved={changesSaved} />
      {!loading && !generationInProgress && matchingScale ? <ScaleWarnings scale={matchingScale} /> : null}

      {error ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-error bg-error p-4 text-sm text-danger sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button type="button" onClick={retry} className="w-fit rounded-lg border border-danger/50 px-3 py-2 font-semibold hover:bg-error">
            Tentar novamente
          </button>
        </div>
      ) : null}

      {loading ? <p role="status" aria-live="polite" className="text-sm text-text-muted">Carregando escala...</p> : null}
      {!loading && !error && !generationInProgress && !matchingScale ? (
        <p role="status" className="rounded-2xl border border-border bg-white px-5 py-4 text-sm text-text-muted">
          Nenhuma escala encontrada para {calendarTitle}. O calendário está vazio.
        </p>
      ) : null}


      {batchError ? <p role="alert" className="rounded-xl border border-error bg-error px-4 py-3 text-sm text-danger">{batchError}</p> : null}

      {generationInProgress ? <GenerationLoading /> : <>
        <section aria-label="Navegação do calendário" className="flex flex-col gap-4 rounded-2xl border border-border bg-white px-4 py-4 shadow-(--shadow-soft) sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {view === 'month' ? (
            <MonthPeriodNavigation
              selectedDate={selectedDate}
              title={calendarTitle}
              yearId="scale-year"
              yearAriaLabel="Ano da escala"
              onChange={(next) => {
                if (stagedChanges.length > 0) { setBatchError('Salve ou descarte as alterações staged antes de mudar de período.'); return }
                setLoading(true); setError(''); setSelectedDate(next)
              }}
            />
          ) : (
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <button type="button" aria-label="Semana anterior" onClick={() => changePeriod(-1)} className="flex items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-page">‹ Semana anterior</button>
              <h3 aria-live="polite" className="min-w-45 text-center text-base font-bold text-text">{calendarTitle}</h3>
              <button type="button" aria-label="Próxima semana" onClick={() => changePeriod(1)} className="flex items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-page">Próxima semana ›</button>
            </div>
          )}
          <div role="group" aria-label="Visualização do calendário" className="flex rounded-xl bg-page p-1">
            <button type="button" aria-pressed={view === 'month'} onClick={() => {
              if (view !== 'month') { setLoading(true); setError(''); setView('month') }
            }} className={`rounded-lg px-4 py-2 text-xs font-semibold ${view === 'month' ? 'bg-white text-primary shadow-sm' : 'text-text-muted'}`}>
              Mês
            </button>
            <button type="button" aria-pressed={view === 'week'} onClick={() => {
              if (view !== 'week') { setLoading(true); setError(''); setView('week') }
            }} className={`rounded-lg px-4 py-2 text-xs font-semibold ${view === 'week' ? 'bg-white text-primary shadow-sm' : 'text-text-muted'}`}>
              Semana
            </button>
          </div>
        </section>

      <section aria-label="Calendário da escala" className="overflow-hidden rounded-2xl border border-border bg-white shadow-(--shadow-soft)">
        {view === 'month' ? <div aria-label="Legenda da escala" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border px-4 py-3 text-xs text-text-muted sm:px-6">
          <span><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-sm border border-primary/50 bg-highlight" />Escala regular</span>
          <span><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-sm border border-warning bg-warning" />Cobertura por restrição</span>
          <span><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-sm border border-danger/50 bg-error" />Conflito para revisar</span>
        </div> : null}

        {view === 'month' ? <div className="grid grid-cols-7 border-b border-border bg-card-header text-center text-[10px] font-bold uppercase tracking-wide text-text-muted">
          {WEEKDAYS.map((day) => <span key={day} className="px-1 py-3">{day}</span>)}
        </div> : null}
        {view === 'month' ? <div className="grid grid-cols-7">
          {days.map((date) => {
            const key = dateKey(date)
            return (
              <div key={key} className="min-w-0 border-b border-r border-border">
                <CalendarDay
                  date={date}
                  activeMonth={monthIndex}
                  selected={dateKey(selectedDate) === key}
                  scale={scales.find((item) => item.escala.ano === date.getFullYear() && item.escala.mes === date.getMonth() + 1) ?? null}
                  onSelect={() => {
                    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) {
                      setLoading(true)
                      setError('')
                    }
                    setSelectedDate(date)
                    const dayScale = scales.find((item) => item.escala.ano === date.getFullYear() && item.escala.mes === date.getMonth() + 1)
                    if (dayScale) setShowShiftDialog(true)
                  }}
                />
              </div>
            )
          })}
        </div> : <div className="grid gap-3 p-4">
          {days.map((date) => {
            const dayScale = scales.find((item) => item.escala.ano === date.getFullYear() && item.escala.mes === date.getMonth() + 1) ?? null
            return <WeeklyDayCard
              key={dateKey(date)}
              date={date}
              dayScale={dayScale}
              onEdit={dayScale && canEditScale(dayScale.escala.status)
                ? () => {
                  setSelectedDate(date)
                  setShowShiftDialog(true)
                }
                : undefined}
            />
          })}
        </div>}
      </section>

      {view === 'month' ? <p className="rounded-xl bg-highlight px-4 py-3 text-xs leading-relaxed text-primary">Plantões de 24h cobrem os turnos diurno e noturno; plantões de 12h cobrem somente o turno correspondente e ajudam a preencher lacunas e cargas regulares.</p> : null}
      </>}

      {showGenerateDialog ? (
        <GenerateScaleDialog
          initialDate={selectedDate}
          onGeneratingChange={setGenerationInProgress}
          onClose={() => setShowGenerateDialog(false)}
          onGenerated={async (draft) => {
            setShowGenerateDialog(false)
            replaceScale(draft)
            setSelectedDate(calendarDate(draft.escala.ano, draft.escala.mes - 1, 1))
            setView('week')
            setError('')
            setGenerationInProgress(false)
            try {
              const reviewed = await startScaleReview(draft)
              replaceScale(reviewed)
            } catch (cause: unknown) {
              setError(`Escala gerada como rascunho, mas não foi possível iniciar a revisão: ${cause instanceof Error ? cause.message : 'erro desconhecido.'}`)
            }
          }}
        />
      ) : null}
      {showExportDrawer ? (
        <ExportScaleDrawer
          monthLabel={monthLabel(selectedDate)}
          exporting={exporting}
          error={exportError}
          onClose={() => setShowExportDrawer(false)}
          onExport={(scope) => {
            void downloadScale(scope).then((success) => {
              if (success) setShowExportDrawer(false)
            })
          }}
        />
      ) : null}

      {matchingScale && showShiftDialog ? (
        <ScaleShiftDialog
          key={selectedDate.toISOString()}
          scale={matchingScale}
          dayShifts={matchingScale.plantoes.filter((shift) => shift.data === dateKey(selectedDate))}
          initialDate={dateKey(selectedDate)}
          stagedChanges={stagedChanges}
          onClose={() => setShowShiftDialog(false)}
          onStaged={(changes, scope) => {
            const pending = stageShiftChanges(stagedChanges, changes, scope)
            setStagedChanges(pending)
            setChangesSaved(false)
            setShowShiftDialog(false)
            void saveStagedChanges(pending)
          }}
        />
      ) : null}

      {matchingScale && matchingScale.escala.status === 'validada' && showPublishDialog ? (
        <PublishScaleDialog
          scale={matchingScale}
          onClose={() => setShowPublishDialog(false)}
          onPublished={(publishedScale) => {
            replaceScale(publishedScale)
            setShowPublishDialog(false)
          }}
        />
      ) : null}
      {matchingScale && isPublished && showRemovePublishedDialog ? (
        <RemovePublishedScaleDialog
          scale={matchingScale}
          onClose={() => setShowRemovePublishedDialog(false)}
          onRemoved={() => void removePublishedScale()}
        />
      ) : null}

    </div>
  )
}
