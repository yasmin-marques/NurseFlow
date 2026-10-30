import { useEffect, useState } from 'react'
import { exportScalePdf, listScales, saveShiftBatch, startReview, validateScale, validateShiftBatch, type ShiftBatchChange, type ScaleDetail, type ScheduledShift } from '../../services/scales'
import { GenerateScaleDialog } from './GenerateScaleDialog'
import { ExportScaleDrawer } from './ExportScaleDrawer'
import { PublishScaleDialog } from './PublishScaleDialog'
import { ScaleShiftDialog } from './ScaleShiftDialog'
import { canEditScale, stageShiftChange } from './review'
import { calendarDate, calendarDays, dateKey, dayIndicators, formatMonth, formatWeek, summarizeDayShifts, type CalendarView } from './calendar'
import { getScaleWorkflow } from './workflow'
import { CoverageAlert } from '../../components/ui/ScaleComponents'
import { coverageSurfaceClass } from '../../components/ui/coverageStyles'
import { WeeklyDayCard } from './WeeklyDayCard'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function monthLabel(date: Date) {
  const label = formatMonth(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function statusStyle(state: ReturnType<typeof dayIndicators>['state']) {
  return coverageSurfaceClass(state)
}

function WorkflowCard({ scale, onGenerate, onReview, onValidateAndPublish, stagedCount, onSave, saving, validating, changesSaved }: {
  scale: ScaleDetail | null
  onGenerate: () => void
  onReview: () => void
  onValidateAndPublish: () => void
  stagedCount: number
  onSave: () => void
  saving: boolean
  validating: boolean
  changesSaved: boolean
}) {
  const published = scale?.escala.status === 'publicada' || scale?.escala.status === 'finalizada'
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
    {!scale ? <div className="mx-5 mb-5 grid gap-4 rounded-xl bg-soft-green p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div><p className="text-xs font-bold text-text">Crie uma escala usando os dados da equipe</p><p className="mt-1 max-w-xl text-[11px] leading-relaxed text-text-muted">O sistema considera status, restrições, ausências, descanso, cobertura mínima, extras, setores e turnos individuais.</p></div>
      <button type="button" onClick={onGenerate} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:brightness-95">Configurar geração</button>
    </div> : <div className="flex flex-wrap gap-2 px-5 pb-5">
      {!published ? <>
        <button type="button" onClick={onReview} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-neutral">Editar escala</button>
        <button type="button" onClick={onGenerate} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-neutral">Gerar novamente</button>
        <button type="button" disabled={saving || stagedCount === 0} onClick={onSave} className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
        {canValidate ? <button type="button" disabled={saving || validating} onClick={onValidateAndPublish} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:brightness-95 disabled:opacity-50">{validating ? 'Validando...' : 'Validar e publicar'}</button> : null}
      </> : <button type="button" onClick={onReview} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text">Editar escala</button>}
    </div>}
  </section>
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
      className={`min-h-[176px] w-full min-w-0 border p-2 text-left transition-colors hover:bg-neutral sm:p-3 ${statusStyle(indicators.state)} ${outsideMonth ? 'opacity-55' : ''} ${selected ? 'ring-2 ring-inset ring-primary' : ''}`}
    >
      <span className={`inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold ${indicators.state === 'conflict' ? 'bg-error text-danger' : indicators.state === 'partial' || indicators.state === 'restricted' ? 'bg-warning text-warning-text' : 'bg-highlight text-primary'}`}>
        {date.getDate()}
      </span>
      {shifts.length ? <>
        <span className="mt-2 block text-[8px] font-bold uppercase tracking-wide text-text-muted">CHEFE</span>
        <span className="block truncate text-[10px] font-semibold text-text">{team.leader?.nome ?? 'Não informado'}</span>
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
    <section role="status" aria-live="polite" aria-label="Gerando a escala" className="flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-border bg-white px-6 text-center shadow-(--shadow-soft)">
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
  const [showExportDrawer, setShowExportDrawer] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [editingShift, setEditingShift] = useState<ScheduledShift | null>(null)
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
  const isPublished = matchingScale?.escala.status === 'publicada' || matchingScale?.escala.status === 'finalizada'

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

  const startScaleReview = async (scale: ScaleDetail) => {
    const reviewed = scale.escala.status === 'rascunho'
      ? await startReview(scale.escala.id, scale.escala.revisao)
      : scale
    if (reviewed.escala.status !== 'em_revisao') {
      throw new Error('A API não confirmou que a escala entrou em revisão. Tente novamente.')
    }
    return reviewed
  }

  const saveStagedChanges = async () => {
    if (!matchingScale || stagedChanges.length === 0 || savingBatch) return
    setSavingBatch(true)
    setBatchError('')
    try {
      const validation = await validateShiftBatch(matchingScale.escala.id, matchingScale.escala.revisao, stagedChanges)
      if (!validation.valida) throw new Error(validation.erros.map((item) => item.motivo ?? item.tipo ?? 'Conflito de validação').join(' '))
      const updated = await saveShiftBatch(matchingScale.escala.id, matchingScale.escala.revisao, stagedChanges)
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
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { setExportError(''); setShowExportDrawer(true) }} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text hover:bg-neutral">Exportar PDF</button>
          <button
            type="button"
            onClick={() => setShowGenerateDialog(true)}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-95"
          >
            Gerar Escala Automaticamente
          </button>
        </div>
      </header>

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


      <WorkflowCard scale={matchingScale} onGenerate={() => setShowGenerateDialog(true)} onReview={() => void openReview()} onValidateAndPublish={() => void validateAndPublish()} stagedCount={stagedChanges.length} onSave={() => void saveStagedChanges()} saving={savingBatch} validating={validating} changesSaved={changesSaved} />
      {batchError ? <p role="alert" className="rounded-xl border border-error bg-error px-4 py-3 text-sm text-danger">{batchError}</p> : null}

      {generationInProgress ? <GenerationLoading /> : <>
        <section aria-label="Navegação do calendário" className="flex flex-col gap-4 rounded-2xl border border-border bg-white px-4 py-4 shadow-(--shadow-soft) sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <button type="button" aria-label={view === 'week' ? 'Semana anterior' : 'Mês anterior'} onClick={() => changePeriod(-1)} className={`flex items-center justify-center rounded-lg border border-border font-semibold hover:bg-page ${view === 'week' ? 'px-3 py-2 text-xs' : 'size-9 text-lg'}`}>
              {view === 'week' ? '‹ Semana anterior' : '‹'}
            </button>
            <h3 aria-live="polite" className="min-w-[180px] text-center text-base font-bold text-text">{calendarTitle}</h3>
            <button type="button" aria-label={view === 'week' ? 'Próxima semana' : 'Próximo mês'} onClick={() => changePeriod(1)} className={`flex items-center justify-center rounded-lg border border-border font-semibold hover:bg-page ${view === 'week' ? 'px-3 py-2 text-xs' : 'size-9 text-lg'}`}>
              {view === 'week' ? 'Próxima semana ›' : '›'}
            </button>
          </div>
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
                  const key = dateKey(date)
                  const dayShifts = dayScale.plantoes.filter((shift) => shift.data === key)
                  setSelectedDate(date)
                  setEditingShift(dayShifts[0] ?? null)
                  setShowShiftDialog(true)
                }
                : undefined}
            />
          })}
        </div>}
      </section>

      {view === 'month' ? <p className="rounded-xl bg-highlight px-4 py-3 text-xs leading-relaxed text-primary">Jornadas de 12 horas são usadas somente quando há uma restrição específica, sempre com cobertura automática no turno complementar.</p> : null}
      </>}

      {showGenerateDialog ? (
        <GenerateScaleDialog
          initialDate={selectedDate}
          onGeneratingChange={setGenerationInProgress}
          onClose={() => setShowGenerateDialog(false)}
          onGenerated={async (draft) => {
            setShowGenerateDialog(false)
            try {
              const reviewed = await startScaleReview(draft)
              replaceScale(reviewed)
              setSelectedDate(calendarDate(reviewed.escala.ano, reviewed.escala.mes - 1, 1))
              setView('week')
              setError('')
            } catch (cause: unknown) {
              replaceScale(draft)
              setSelectedDate(calendarDate(draft.escala.ano, draft.escala.mes - 1, 1))
              setView('month')
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
          key={editingShift?.id ?? selectedDate.toISOString()}
          scale={matchingScale}
          shift={editingShift}
          initialDate={dateKey(selectedDate)}
          stagedChanges={stagedChanges}
          onClose={() => {
            setShowShiftDialog(false)
            setEditingShift(null)
          }}
          onStaged={(change) => {
            setStagedChanges((current) => stageShiftChange(current, change))
            setChangesSaved(false)
            setShowShiftDialog(false)
            setEditingShift(null)
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

    </div>
  )
}
