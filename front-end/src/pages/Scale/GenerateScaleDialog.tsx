import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Drawer } from '../../components/ui/Drawer'
import { SelectionChip } from '../../components/ui/ScaleComponents'
import { listSectors } from '../../services/sectors'
import type { Sector } from '../Sectors/types'
import { daysInMonth } from './calendar'
import {
  generateScale,
  listScales,
  type ScaleDetail,
  type ScaleShift,
} from '../../services/scales'
import { isScaleReplaceable, validateGenerationSelection } from './generation-form'

interface GenerateScaleDialogProps {
  initialDate: Date
  onClose: () => void
  onGenerated: (scale: ScaleDetail) => void | Promise<void>
  onGeneratingChange: (generating: boolean) => void
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível gerar a escala.'
}

function monthDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const TURNOS: { id: '24h' | ScaleShift; label: string }[] = [
  { id: '24h', label: '24 horas' },
  { id: 'diurno', label: 'Diurno' },
  { id: 'noturno', label: 'Noturno' },
]

export function GenerateScaleDialog({ initialDate, onClose, onGenerated, onGeneratingChange }: GenerateScaleDialogProps) {
  const initialYear = initialDate.getFullYear()
  const initialMonth = initialDate.getMonth() + 1
  const [startDate, setStartDate] = useState(monthDate(initialYear, initialMonth, 1))
  const [endDate, setEndDate] = useState(monthDate(initialYear, initialMonth, daysInMonth(initialYear, initialMonth)))
  const [sectors, setSectors] = useState<Sector[]>([])
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([])
  const [selectedShifts, setSelectedShifts] = useState<Array<'24h' | ScaleShift>>(['24h', 'diurno', 'noturno'])
  const [sectorsLoading, setSectorsLoading] = useState(true)
  const [sectorsError, setSectorsError] = useState('')
  const [periodResult, setPeriodResult] = useState<{
    key: string
    scale: ScaleDetail | null
    error: string
  }>({ key: '', scale: null, error: '' })
  const [confirmReplacement, setConfirmReplacement] = useState(false)
  const [formError, setFormError] = useState('')
  const [generating, setGenerating] = useState(false)
  const dateParts = /^(\d{4})-(\d{2})-\d{2}$/.exec(startDate)
  const year = dateParts ? Number(dateParts[1]) : 0
  const month = dateParts ? Number(dateParts[2]) : 0
  const apiShifts: ScaleShift[] = [...new Set<ScaleShift>(
    selectedShifts.flatMap((shift) => shift === '24h' ? ['diurno', 'noturno'] : [shift]),
  )]

  useEffect(() => {
    let active = true
    listSectors()
      .then((result) => {
        if (!active) return
        const activeSectors = result.filter((sector) => sector.active)
        setSectors(activeSectors)
        setSelectedSectorIds(activeSectors.map((sector) => sector.id))
      })
      .catch((error: unknown) => {
        if (active) setSectorsError(messageOf(error))
      })
      .finally(() => {
        if (active) setSectorsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const periodKey = `${year}-${month}`
  const validPeriod =
    Number.isInteger(year) && year >= 1 && year <= 9999 && Number.isInteger(month) && month >= 1 && month <= 12 &&
    startDate === monthDate(year, month, 1) &&
    endDate === monthDate(year, month, daysInMonth(year, month))

  useEffect(() => {
    if (!validPeriod) return
    let active = true
    listScales(year, month)
      .then((scalesForPeriod) => {
        if (active) setPeriodResult({ key: periodKey, scale: scalesForPeriod[0] ?? null, error: '' })
      })
      .catch((error: unknown) => {
        if (active) setPeriodResult({ key: periodKey, scale: null, error: messageOf(error) })
      })
    return () => {
      active = false
    }
  }, [year, month, periodKey, validPeriod])

  const selectionError = validateGenerationSelection({
    year,
    month,
    startDate,
    endDate,
    sectorIds: selectedSectorIds,
    shifts: apiShifts,
  })
  const periodResultIsCurrent = periodResult.key === periodKey
  const periodLoading = validPeriod && !periodResultIsCurrent
  const periodError = periodResultIsCurrent ? periodResult.error : ''
  const existingScale = periodResultIsCurrent ? periodResult.scale : null
  const existingReplaceable = isScaleReplaceable(existingScale?.escala.status)
  const existingNonReplaceable = existingScale !== null && !existingReplaceable
  const canSubmit =
    !generating &&
    !sectorsLoading &&
    !sectorsError &&
    validPeriod &&
    !periodLoading &&
    !periodError &&
    !selectionError &&
    !existingNonReplaceable &&
    (!existingReplaceable || confirmReplacement)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      setFormError(
        selectionError ??
          (existingReplaceable && !confirmReplacement
            ? 'Confirme a substituição da escala existente.'
            : existingNonReplaceable
              ? 'O período já possui uma escala que não pode ser substituída.'
              : 'Aguarde a validação do período e dos setores.'),
      )
      return
    }

    const operacaoId = crypto.randomUUID()
    setGenerating(true)
    onGeneratingChange(true)
    setFormError('')

    try {
      const scale = await generateScale({
        ano: year,
        mes: month,
        operacaoId,
        setorIds: selectedSectorIds,
        turnos: apiShifts,
        substituirRascunho: existingReplaceable ? confirmReplacement : false,
      })
      await onGenerated(scale)
    } catch (error: unknown) {
      setFormError(messageOf(error))
    } finally {
      setGenerating(false)
      onGeneratingChange(false)
    }
  }

  const toggleSector = (sectorId: string) => {
    setSelectedSectorIds((current) =>
      current.includes(sectorId) ? current.filter((id) => id !== sectorId) : [...current, sectorId],
    )
  }

  const toggleShift = (shift: '24h' | ScaleShift) => {
    setSelectedShifts((current) =>
      current.includes(shift) ? current.filter((item) => item !== shift) : [...current, shift],
    )
  }

  if (generating) return null

  return (
    <Drawer
      id="generate-scale"
      title="Configurar geração automática"
      description="Defina o período e o escopo da nova escala."
      onClose={onClose}
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-page">Cancelar</button>
        <button
          type="submit"
          form="generate-scale-form"
          disabled={!canSubmit}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gerar Escala
        </button>
      </div>}
    >
      <form id="generate-scale-form" onSubmit={submit} noValidate className="space-y-5">
            <section className="rounded-xl bg-soft-green p-4">
              <h3 className="text-sm font-bold text-text">Nova escala</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">A escala será criada como rascunho e poderá ser revisada antes da publicação.</p>
            </section>

            <fieldset disabled={generating} className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-text">Data inicial
                <input type="date" value={startDate} onChange={(event) => { setConfirmReplacement(false); setStartDate(event.target.value) }} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 font-normal" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-text">Data final
                <input type="date" value={endDate} onChange={(event) => { setConfirmReplacement(false); setEndDate(event.target.value) }} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 font-normal" />
              </label>
            </fieldset>

            {periodLoading ? <p role="status" className="text-sm text-text-muted">Verificando escala existente...</p> : null}
            {periodError ? <p role="alert" className="text-sm text-danger">{periodError}</p> : null}
            {existingReplaceable ? (
              <label className="flex items-start gap-3 rounded-xl border border-warning bg-warning p-3 text-sm text-warning-text">
                <input
                  type="checkbox"
                  checked={confirmReplacement}
                  disabled={generating}
                  onChange={(event) => setConfirmReplacement(event.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span>Substituir o conteúdo da escala existente. A versão atual só será substituída após uma geração concluída.</span>
              </label>
            ) : null}
            {existingNonReplaceable ? (
              <p role="alert" className="rounded-xl border border-error bg-error p-3 text-sm text-danger">
                Este período já possui uma escala {existingScale?.escala.status}. Escalas validadas, publicadas ou finalizadas não são substituídas.
              </p>
            ) : null}

            <fieldset disabled={generating || sectorsLoading || sectorsError !== ''} className="space-y-3">
              <legend className="mb-2 text-sm font-bold text-text">Setores considerados</legend>
              {sectorsLoading ? <p role="status" className="text-sm text-text-muted">Carregando setores ativos...</p> : null}
              {sectorsError ? <p role="alert" className="text-sm text-danger">{sectorsError}</p> : null}
              {!sectorsLoading && !sectorsError && sectors.length === 0 ? (
                <p className="text-sm text-text-muted">Não há setores ativos para incluir na escala.</p>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {sectors.map((sector) => (
                  <SelectionChip
                    key={sector.id}
                    checked={selectedSectorIds.includes(sector.id)}
                    disabled={generating || sectorsLoading || sectorsError !== ''}
                    onChange={() => toggleSector(sector.id)}
                  >
                    {sector.name}
                  </SelectionChip>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={generating} className="space-y-3">
              <legend className="mb-2 text-sm font-bold text-text">Turnos aplicáveis</legend>
              <div className="grid grid-cols-3 gap-2">
                {TURNOS.map((shift) => (
                  <SelectionChip
                    key={shift.id}
                    checked={selectedShifts.includes(shift.id)}
                    disabled={generating}
                    onChange={() => toggleShift(shift.id)}
                  >
                    {shift.label}
                  </SelectionChip>
                ))}
              </div>
            </fieldset>

            {selectionError ? <p className="text-sm text-text-muted">{selectionError}</p> : null}
            {formError ? <p role="alert" className="rounded-xl border border-error bg-error p-3 text-sm text-danger">{formError}</p> : null}
            <section className="rounded-xl border border-border bg-neutral p-4">
              <h3 className="text-sm font-bold text-text">O que será validado</h3>
              <ul className="mt-3 space-y-2 text-xs text-text-muted">
                <li><span className="mr-2 font-bold text-primary">✓</span>Profissionais ativos e disponíveis</li>
                <li><span className="mr-2 font-bold text-primary">✓</span>Férias, afastamentos e restrições</li>
                <li><span className="mr-2 font-bold text-primary">✓</span>Descanso dos técnicos e sobreposição</li>
                <li><span className="mr-2 font-bold text-primary">✓</span>Cobertura mínima por setor e turno</li>
                <li><span className="mr-2 font-bold text-primary">✓</span>Enfermeiro chefe e responsabilidades</li>
              </ul>
            </section>
      </form>
    </Drawer>
  )
}
