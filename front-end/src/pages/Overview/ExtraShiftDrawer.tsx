import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Clock } from '../../components/icons'
import { Drawer } from '../../components/ui/Drawer'
import { listProfessionals } from '../../services/professionals'
import type { Professional } from '../Professionals/types'
import { listSectors } from '../../services/sectors'
import type { Sector } from '../Sectors/types'
import type { ExtraShiftReason, ShiftOption, ShiftRole } from '../../services/scales'

export type ExtraShiftSubmission = {
  date: string
  sectorId: string
  shift: ShiftOption
  professionalId: string
  role: ShiftRole
  reason: ExtraShiftReason
  observation: string
  coverageRecognized: boolean
}

type ExtraShiftDrawerProps = {
  onClose: () => void
  onSave: (submission: ExtraShiftSubmission) => Promise<void>
}

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const fieldClass = 'mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3 text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'
const roleOf = (professional: Professional): ShiftRole =>
  professional.formation === 'Enfemeiro' ? 'enfermeiro' : 'tecnico'

export function ExtraShiftDrawer({ onClose, onSave }: ExtraShiftDrawerProps) {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [date, setDate] = useState(today)
  const [sectorId, setSectorId] = useState('')
  const [shift, setShift] = useState<ShiftOption | ''>('')
  const [role, setRole] = useState<ShiftRole | ''>('')
  const [professionalId, setProfessionalId] = useState('')
  const [reason, setReason] = useState<ExtraShiftReason>('cobertura_ferias')
  const [observation, setObservation] = useState('')
  const [coverageRecognized, setCoverageRecognized] = useState(false)
  const [requiresCoverageConfirmation, setRequiresCoverageConfirmation] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listProfessionals(), listSectors()])
      .then(([professionalList, sectorList]) => {
        if (!active) return
        setProfessionals(professionalList.filter((item) => item.status && item.id))
        const activeSectors = sectorList.filter((item) => item.active)
        setSectors(activeSectors)
        setSectorId(activeSectors[0]?.id ?? '')
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar os cadastros.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const eligibleProfessionals = useMemo(
    () => professionals.filter((person) => !role || roleOf(person) === role),
    [professionals, role],
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const professional = eligibleProfessionals.find((item) => item.id === professionalId)
    if (!professional || !sectorId || !shift) {
      setError('Selecione setor, turno e profissional ativo para registrar o extra.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave({
        date,
        sectorId,
        shift,
        professionalId,
        role: roleOf(professional),
        reason,
        observation: observation.trim(),
        coverageRecognized,
      })
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível registrar o plantão extra.'
      if (/reconheça as pendências de cobertura/i.test(message)) {
        setRequiresCoverageConfirmation(true)
        setCoverageRecognized(false)
        setError('A inclusão deixa vagas abertas na cobertura. Revise e reconheça essa condição para continuar.')
      } else {
        setError(message)
      }
      setSaving(false)
    }
  }

  return (
    <Drawer
      id="register-extra"
      title="Registrar Extra"
      description="Informe os dados da cobertura"
      onClose={onClose}
      closeDisabled={saving}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-text hover:bg-neutral disabled:opacity-50">Cancelar</button>
          <button type="submit" form="extra-shift-form" disabled={saving || loading || Boolean(loadError)} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar registro'}</button>
        </div>
      }
    >
      {loading ? <p role="status" className="text-sm text-text-muted">Carregando profissionais e setores...</p> : null}
      {loadError ? <p role="alert" className="rounded-xl border border-error bg-error p-3 text-xs text-danger">{loadError}</p> : null}
      {!loading && !loadError ? (
        <form id="extra-shift-form" onSubmit={(event) => void submit(event)} className="space-y-4">
          <aside className="flex items-start gap-3 rounded-xl bg-soft-green px-3.5 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-highlight text-primary"><Clock className="size-4" /></span>
            <div><p className="text-[11px] font-bold text-primary">Período extra</p><p className="mt-0.5 text-[10px] leading-relaxed text-text-muted">O plantão será incluído na escala do mês selecionado e validado pelas regras de cobertura.</p></div>
          </aside>

          <label className="block text-[11px] font-semibold text-text">
            Motivo <span className="text-danger">*</span>
            <select required value={reason} onChange={(event) => setReason(event.target.value as ExtraShiftReason)} className={fieldClass}>
              <option value="cobertura_ferias">Cobertura de férias</option>
              <option value="cobertura_ausencia">Cobertura de ausência</option>
              <option value="cobertura_deficit">Déficit de cobertura</option>
              <option value="outro">Outro</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[11px] font-semibold text-text">
              Data <span className="text-danger">*</span>
              <input required type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-[11px] font-semibold text-text">
              Turno <span className="text-danger">*</span>
              <select required value={shift} onChange={(event) => setShift(event.target.value as ShiftOption | '')} className={fieldClass}>
                <option value="">Selecione</option>
                <option value="12d">Diurno · 12h</option>
                <option value="12n">Noturno · 12h</option>
                <option value="24h">24 horas</option>
              </select>
            </label>
          </div>

          <label className="block text-[11px] font-semibold text-text">
            Setor <span className="text-danger">*</span>
            <select required value={sectorId} onChange={(event) => setSectorId(event.target.value)} className={fieldClass}>
              <option value="">Selecione o setor</option>
              {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
            </select>
          </label>

          <label className="block text-[11px] font-semibold text-text">
            Categoria <span className="text-danger">*</span>
            <select required value={role} onChange={(event) => { setRole(event.target.value as ShiftRole | ''); setProfessionalId('') }} className={fieldClass}>
              <option value="">Selecione a categoria</option>
              <option value="enfermeiro">Enfermeiro</option>
              <option value="tecnico">Técnico</option>
            </select>
          </label>

          <label className="block text-[11px] font-semibold text-text">
            Profissional <span className="text-danger">*</span>
            <select required value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} disabled={!role} className={fieldClass}>
              <option value="">{role ? 'Selecione o profissional' : 'Selecione primeiro a categoria'}</option>
              {eligibleProfessionals.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            {role && eligibleProfessionals.length === 0 ? <span className="mt-1 block text-[10px] text-text-muted">Nenhum profissional ativo nesta categoria.</span> : null}
          </label>

          <label className="block text-[11px] font-semibold text-text">
            Observação
            <textarea maxLength={500} value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Adicione um contexto para a coordenação" className="mt-1.5 min-h-14 w-full resize-y rounded-xl border border-border bg-white px-3 py-2.5 text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
          </label>

          {requiresCoverageConfirmation ? (
            <label className="flex items-start gap-2 rounded-xl border border-warning bg-warning/20 p-3 text-[10px] leading-relaxed text-text">
              <input type="checkbox" checked={coverageRecognized} onChange={(event) => setCoverageRecognized(event.target.checked)} className="mt-0.5 accent-primary" />
              Reconheço que a cobertura mínima ficará pendente para esta escala.
            </label>
          ) : null}

          <aside className="flex items-start gap-2 rounded-xl bg-highlight p-3 text-[10px] leading-relaxed text-primary">
            <Check className="mt-0.5 size-3.5 shrink-0" />
            Se a escala do período já estiver publicada, será aberta uma revisão antes da inclusão.
          </aside>

          {error ? <p role="alert" className="rounded-xl border border-error bg-error p-3 text-xs text-danger">{error}</p> : null}
        </form>
      ) : null}
    </Drawer>
  )
}
