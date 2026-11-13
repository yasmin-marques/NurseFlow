import { useEffect, useState } from 'react'
import { CalendarDays, CalendarPlus, Check, ChevronRight, Download, Plus, Users } from '../../components/icons'
import { ExtraShiftDrawer, type ExtraShiftSubmission } from './ExtraShiftDrawer'
import { ProfessionalFormModal } from '../Professionals/components/ProfessionalFormModal'
import { ExportScaleDrawer } from '../Scale/ExportScaleDrawer'
import { createProfessional } from '../../services/professionals'
import type { Professional } from '../Professionals/types'
import { fetchAllRestrictions } from '../../services/restriction'
import { addShift, createDraft, exportScalePdf, listScales, startReview, type ScaleDetail } from '../../services/scales'
import { listSectors } from '../../services/sectors'
import { listarTrocas } from '../../services/trocas'
import { dateKey, formatMonth } from '../Scale/calendar'
import type { NavItemId } from '../../components/layout/navItems'

type CoordinationOverviewPageProps = {
  userName: string
  onNavigate: (id: NavItemId) => void
}

type DashboardData = {
  scale: ScaleDetail | null
  activeProfessionals: number
  activeSectors: number
  pendingExchanges: number
  upcomingAbsences: number
}

const initialData: DashboardData = {
  scale: null,
  activeProfessionals: 0,
  activeSectors: 0,
  pendingExchanges: 0,
  upcomingAbsences: 0,
}

function monthTitle(date: Date) {
  const month = formatMonth(date)
  return month.charAt(0).toUpperCase() + month.slice(1)
}

function scaleStatusLabel(status: ScaleDetail['escala']['status']) {
  const labels: Record<ScaleDetail['escala']['status'], string> = {
    rascunho: 'em preparação',
    em_revisao: 'em revisão',
    validada: 'validada para publicação',
    publicada: 'publicada',
    finalizada: 'finalizada',
  }
  return labels[status]
}

function withinUpcomingMonth(startDate: string, endDate: string, today: string, limit: string) {
  return startDate <= limit && endDate >= today
}

export function CoordinationOverviewPage({ userName, onNavigate }: CoordinationOverviewPageProps) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [showProfessionalForm, setShowProfessionalForm] = useState(false)
  const [showExtraDrawer, setShowExtraDrawer] = useState(false)
  const [showExportDrawer, setShowExportDrawer] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [notice, setNotice] = useState('')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthDate = new Date(year, month - 1, 1)
  const monthLabel = monthTitle(monthDate)

  useEffect(() => {
    let active = true
    const loadDashboard = async () => {
      try {
        const [scales, sectors, exchanges, availability] = await Promise.all([
          listScales(year, month),
          listSectors(),
          listarTrocas({ status: 'pendentes', ano: year, mes: month, pagina: 1 }),
          fetchAllRestrictions(),
        ])
        if (!active) return
        const todayDate = new Date()
        const today = dateKey(todayDate)
        const end = new Date(todayDate)
        end.setDate(end.getDate() + 30)
        const limit = dateKey(end)
        const upcomingAbsences = availability.records.absences.filter((absence) => {
          const startDate = absence.details?.startDate ?? ''
          const endDate = absence.details?.endDate ?? ''
          return withinUpcomingMonth(startDate, endDate, today, limit)
        }).length
        setData({
          scale: scales[0] ?? null,
          activeProfessionals: availability.professionals.length,
          activeSectors: sectors.filter((sector) => sector.active).length,
          pendingExchanges: exchanges.contadores.aguardandoCoordenacao,
          upcomingAbsences,
        })
      } catch (cause: unknown) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados da visão geral.')
        setData(initialData)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()
    return () => { active = false }
  }, [month, reload, year])

  const scale = data.scale
  const coverage = scale?.cobertura?.percentual ?? scale?.resumo.cobertura?.percentual ?? null
  const safeCoverage = coverage === null ? 0 : Math.max(0, Math.min(100, Math.round(coverage)))
  const pendingPositions = scale?.pendencias.reduce((total, item) => total + item.faltam, 0) ?? 0

  const handleCreateProfessional = async (professional: Professional) => {
    await createProfessional(professional)
    setShowProfessionalForm(false)
    setNotice('Profissional cadastrado com sucesso.')
    setLoading(true)
    setReload((value) => value + 1)
  }

  const handleRegisterExtra = async (submission: ExtraShiftSubmission) => {
    const [selectedYear, selectedMonth] = submission.date.split('-').map(Number)
    const [existing] = await listScales(selectedYear, selectedMonth)
    let targetScale = existing

    if (!targetScale) {
      targetScale = await createDraft(selectedYear, selectedMonth)
    } else if (targetScale.escala.status === 'publicada') {
      targetScale = await startReview(targetScale.escala.id, targetScale.escala.revisao)
    } else if (targetScale.escala.status === 'validada') {
      throw new Error('A escala está validada. Publique-a antes de iniciar uma nova revisão para registrar o extra.')
    } else if (targetScale.escala.status === 'finalizada') {
      throw new Error('A escala deste período está finalizada e não pode receber novos plantões.')
    }

    await addShift(targetScale.escala.id, {
      revisao: targetScale.escala.revisao,
      setorId: submission.sectorId,
      data: submission.date,
      opcao: submission.shift,
      tipo: 'extra',
      motivo: submission.reason,
      observacao: submission.observation || undefined,
      coberturaReconhecida: submission.coverageRecognized,
      equipe: [{
        profissionalId: submission.professionalId,
        funcao: submission.role,
        lideranca: submission.role === 'enfermeiro' && submission.shift === '24h',
        origemCobertura: 'complementar',
      }],
    })
    setShowExtraDrawer(false)
    setNotice('Plantão extra registrado na escala.')
    setLoading(true)
    setReload((value) => value + 1)
  }

  const handleExport = async (scope: 'general' | 'sector') => {
    if (!scale) {
      setExportError('Não há escala para exportar no período selecionado.')
      return
    }
    if (scale.escala.status !== 'publicada' && scale.escala.status !== 'finalizada') {
      setExportError('A escala precisa estar publicada para ser exportada.')
      return
    }
    setExporting(true)
    setExportError('')
    try {
      const options = scope === 'sector' ? { separarPorSetor: true as const } : undefined
      const { blob, filename } = await exportScalePdf(scale.escala.id, options)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setShowExportDrawer(false)
    } catch (cause: unknown) {
      setExportError(cause instanceof Error ? cause.message : 'Não foi possível exportar a escala.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:px-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-[-0.04em] text-text sm:text-[32px]">Bom dia, {userName}.</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            {scale ? `A escala de ${formatMonth(monthDate)} está ${scaleStatusLabel(scale.escala.status)}.` : `Acompanhe a equipe e prepare a escala de ${formatMonth(monthDate)}.`}
          </p>
        </div>
        <button type="button" onClick={() => onNavigate('escala')} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-95">
          <CalendarDays className="size-4" />
          Abrir escala
        </button>
      </header>

      {notice ? <p role="status" className="rounded-lg border border-primary/15 bg-highlight px-3 py-2 text-xs text-primary">{notice}</p> : null}
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error bg-error px-4 py-3 text-xs text-danger">
          <span>{error}</span>
          <button type="button" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }} className="rounded-lg border border-danger/30 px-3 py-1.5 font-semibold">Tentar novamente</button>
        </div>
      ) : null}

      <section aria-label={`Escala de ${formatMonth(monthDate)}`} className="flex flex-col gap-4 rounded-2xl border border-[#d9e7d6] bg-[#e7f0e5] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#d1e4ce] text-primary"><CalendarDays className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-text">Escala de {formatMonth(monthDate)}</h3>
            <span className="text-xs font-bold text-primary">{loading ? 'Carregando cobertura...' : coverage === null ? 'Sem dados de cobertura' : `${safeCoverage}% da cobertura preenchida`}</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#c9d8c6]">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${safeCoverage}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            {scale ? `${scale.resumo.plantoes} plantões · ${data.activeProfessionals} profissionais ativos · ${data.activeSectors} setores` : 'Ainda não há uma escala cadastrada para este período.'}
          </p>
        </div>
        <button type="button" onClick={() => onNavigate('escala')} className="shrink-0 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white hover:brightness-95">
          {scale?.escala.status === 'publicada' ? 'Ver escala' : 'Revisar e publicar'}
        </button>
      </section>

      <div className="grid gap-5 lg:flex-1 lg:grid-cols-2">
        <section aria-labelledby="attention-title" className="flex flex-col rounded-2xl border border-border bg-white p-5 shadow-(--shadow-soft) sm:p-6 lg:min-h-[380px]">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div><h3 id="attention-title" className="text-base font-bold text-text">O que precisa de atenção</h3><p className="mt-1 text-xs text-text-muted">Resumo operacional atualizado</p></div>
            {data.pendingExchanges > 0 ? <span className="rounded-full bg-neutral px-2.5 py-1.5 text-[10px] font-semibold text-text-muted">{data.pendingExchanges} {data.pendingExchanges === 1 ? 'ação pendente' : 'ações pendentes'}</span> : null}
          </header>
          <div className="flex flex-1 flex-col divide-y divide-border">
            <button type="button" onClick={() => onNavigate('escala')} className="flex min-h-[96px] w-full flex-1 items-center gap-4 px-2 py-5 text-left transition-colors hover:bg-page/60">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight text-primary"><Check className="size-6" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-text">{scale && pendingPositions === 0 && safeCoverage === 100 ? 'Cobertura da escala concluída' : scale ? `${pendingPositions} vagas de cobertura pendentes` : 'Escala ainda não criada'}</strong><span className="mt-1.5 block text-xs leading-relaxed text-text-muted">{scale ? `${scale.pendencias.length} pendências de cobertura registradas` : 'Acesse a escala para iniciar o planejamento.'}</span></span>
              <ChevronRight className="size-5 text-text-muted" />
            </button>
            <button type="button" onClick={() => onNavigate('trocas')} className="flex min-h-[96px] w-full flex-1 items-center gap-4 px-2 py-5 text-left transition-colors hover:bg-page/60">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-badge-blue text-badge-blue-text"><Users className="size-6" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-text">{data.pendingExchanges} {data.pendingExchanges === 1 ? 'troca aguardando análise' : 'trocas aguardando análise'}</strong><span className="mt-1.5 block text-xs leading-relaxed text-text-muted">Solicitações que precisam da validação da Coordenação.</span></span>
              <ChevronRight className="size-5 text-text-muted" />
            </button>
            <button type="button" onClick={() => onNavigate('disponibilidade')} className="flex min-h-[96px] w-full flex-1 items-center gap-4 px-2 py-5 text-left transition-colors hover:bg-page/60">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning text-warning-text"><CalendarDays className="size-6" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-text">{data.upcomingAbsences} {data.upcomingAbsences === 1 ? 'ausência próxima' : 'ausências próximas'}</strong><span className="mt-1.5 block text-xs leading-relaxed text-text-muted">Férias e ausências registradas para os próximos 30 dias.</span></span>
              <ChevronRight className="size-5 text-text-muted" />
            </button>
          </div>
        </section>

        <section aria-labelledby="quick-actions-title" className="flex flex-col rounded-2xl border border-border bg-white p-5 shadow-(--shadow-soft) sm:p-6 lg:min-h-[380px]">
          <header className="mb-4"><h3 id="quick-actions-title" className="text-base font-bold text-text">Acesso rápido</h3><p className="mt-1 text-xs text-text-muted">Tarefas frequentes</p></header>
          <div className="flex flex-1 flex-col divide-y divide-border">
            <button type="button" onClick={() => { setNotice(''); setShowProfessionalForm(true) }} className="flex min-h-[96px] w-full flex-1 items-center gap-4 px-2 py-5 text-left transition-colors hover:bg-page/60">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight text-primary"><Plus className="size-6" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-text">Novo profissional</strong><span className="mt-1.5 block text-xs leading-relaxed text-text-muted">Adicionar à equipe</span></span>
              <ChevronRight className="size-5 text-text-muted" />
            </button>
            <button type="button" onClick={() => { setNotice(''); setShowExtraDrawer(true) }} className="flex min-h-[96px] w-full flex-1 items-center gap-4 px-2 py-5 text-left transition-colors hover:bg-page/60">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight text-primary"><CalendarPlus className="size-6" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-text">Registrar extra</strong><span className="mt-1.5 block text-xs leading-relaxed text-text-muted">Cobrir ausência ou déficit</span></span>
              <ChevronRight className="size-5 text-text-muted" />
            </button>
            <button type="button" onClick={() => { setExportError(''); setShowExportDrawer(true) }} className="flex min-h-[96px] w-full flex-1 items-center gap-4 px-2 py-5 text-left transition-colors hover:bg-page/60">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight text-primary"><Download className="size-6" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-text">Exportar escala</strong><span className="mt-1.5 block text-xs leading-relaxed text-text-muted">Gerar PDF para assinatura</span></span>
              <ChevronRight className="size-5 text-text-muted" />
            </button>
          </div>
        </section>
      </div>

      {showProfessionalForm ? (
        <ProfessionalFormModal
          professional={{ name: '', cpf: '', email: '', coren: '', bond: 'CLT', status: true, formation: 'Enfemeiro' }}
          isCreating
          onClose={() => setShowProfessionalForm(false)}
          onSave={handleCreateProfessional}
        />
      ) : null}
      {showExtraDrawer ? <ExtraShiftDrawer onClose={() => setShowExtraDrawer(false)} onSave={handleRegisterExtra} /> : null}
      {showExportDrawer ? (
        <ExportScaleDrawer
          monthLabel={monthLabel}
          exporting={exporting}
          error={exportError}
          onClose={() => setShowExportDrawer(false)}
          onExport={(scope) => void handleExport(scope)}
        />
      ) : null}
    </div>
  )
}
