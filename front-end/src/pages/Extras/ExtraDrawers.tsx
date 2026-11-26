import { useState, type FormEvent, type ReactNode } from 'react'
import { Drawer } from '../../components/ui/Drawer'
import { cancelarExtra, criarExtra, editarExtra, type ExtraInput, type ScheduledExtra } from '../../services/extras'
import type { Professional } from '../Professionals/types'
import { RpaFormModal } from './RpaFormModal'

export type ExtraOption = '12d' | '12n' | '24h'
export type ExtraSector = { id: string; name: string }
export type ExtraProfessional = Professional & { id: string }

const inputClass = 'mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'
const compactClass = inputClass
const reasons = [
  ['ferias', 'Férias'], ['ausencia', 'Ausência'], ['atestado', 'Atestado médico'], ['reforco', 'Reforço'], ['outro', 'Outro'],
] as const

type FormProps = {
  sectors: ExtraSector[]
  professionals: ExtraProfessional[]
  extra?: ScheduledExtra | null
  onClose: () => void
  onSaved: (extra: ScheduledExtra) => Promise<void> | void
}

function initialForm(extra?: ScheduledExtra | null): ExtraInput {
  return {
    data: extra?.data ?? '',
    opcao: extra?.opcao ?? '12d',
    setorId: typeof extra?.setorId === 'string' ? extra.setorId : extra?.setorId?._id ?? '',
    funcao: extra?.funcao ?? 'enfermeiro',
    substitutoId: typeof extra?.substitutoId === 'string' ? extra.substitutoId : extra?.substitutoId?.id ?? '',
    motivo: extra?.motivo ?? 'reforco',
    cobertoId: typeof extra?.cobertoId === 'string' ? extra.cobertoId : extra?.cobertoId?.id ?? '',
    observacao: extra?.observacao ?? '',
  }
}

function ProfessionalSelect({ label, value, onChange, professionals, required = false }: { label: string; value: string; onChange: (value: string) => void; professionals: ExtraProfessional[]; required?: boolean }) {
  return <label className="block text-[13px] font-semibold text-text">{label}{label === 'Quem será coberto' ? <span className="sr-only"> (profissional coberto)</span> : null}{required ? <span className="text-danger"> *</span> : null}
    <select aria-label={label === 'Quem será coberto' ? 'Profissional coberto' : undefined} required={required} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      <option value="">Selecione</option>
      {professionals.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.formation} · {person.bond}</option>)}
    </select>
  </label>
}

function FieldSelect({ label, value, onChange, children, required = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; required?: boolean }) {
  return <label className="block text-[13px] font-semibold text-text">{label}{required ? <span className="text-danger"> *</span> : null}<select required={required} value={value} onChange={(event) => onChange(event.target.value)} className={compactClass}>{children}</select></label>
}

export function ExtraFormDrawer({ sectors, professionals, extra, onClose, onSaved }: FormProps) {
  const [form, setForm] = useState<ExtraInput>(() => initialForm(extra))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editing = Boolean(extra)
  const set = <K extends keyof ExtraInput>(key: K, value: ExtraInput[K]) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (form.motivo !== 'reforco' && !form.cobertoId) { setError('Informe o profissional coberto para este motivo.'); return }
    setSaving(true); setError('')
    try {
      const result = editing
        ? await editarExtra(extra!.id, { ...form, revisaoEsperada: extra!.revisao })
        : await criarExtra({ ...form, cobertoId: form.cobertoId || undefined })
      await onSaved(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o extra.')
      setSaving(false)
    }
  }

  const eligibleProfessionals = professionals.filter((person) => person.status && (person.formation === 'Enfemeiro' ? form.funcao === 'enfermeiro' : form.funcao === 'tecnico'))
  return <Drawer id="extra-form" title={editing ? `Editar extra de ${typeof extra?.substitutoId === 'object' ? extra.substitutoId.nome ?? 'profissional' : 'profissional'}` : 'Registrar extra'} description="Informe os dados da cobertura" onClose={onClose} closeDisabled={saving}
    footer={<div className="flex items-center justify-end gap-2">{error ? <p role="alert" className="mr-auto text-xs font-semibold text-danger">{error}</p> : null}<button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold">Cancelar</button><button form="extra-form-submit" type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white">{saving ? 'Salvando…' : editing ? 'Salvar' : 'Salvar extra'}</button></div>}>
    <form id="extra-form-submit" onSubmit={submit} className="space-y-5">
      {!editing ? <div className="flex gap-3 rounded-xl bg-[#eef8e9] p-4 text-sm text-primary"><span className="mt-0.5 text-lg">◷</span><span><strong className="block">Período extra</strong><span className="text-text-muted">Esta informação será considerada ao gerar novas escalas.</span></span></div> : null}
      {editing ? <ProfessionalSelect label="Profissional" required value={form.substitutoId} onChange={(value) => set('substitutoId', value)} professionals={eligibleProfessionals} /> : null}
      <FieldSelect label="Motivo" required value={form.motivo} onChange={(value) => set('motivo', value)}><option value="">Selecione o motivo</option>{reasons.map(([value, label]) => <option key={value} value={value}>{value === 'ferias' ? 'Cobertura de férias' : label}</option>)}</FieldSelect>
      {form.motivo !== 'reforco' ? <ProfessionalSelect label="Quem será coberto" required value={form.cobertoId ?? ''} onChange={(value) => set('cobertoId', value)} professionals={professionals} /> : null}
      <div className="grid gap-5"><label className="block text-sm font-semibold text-text">Data <span className="text-danger">*</span><input aria-label="Data *" required type="date" value={form.data} onChange={(event) => set('data', event.target.value)} className={compactClass} /></label><FieldSelect label="Turno" required value={form.opcao} onChange={(value) => set('opcao', value as ExtraOption)}><option value="12d">Diurno · 07–19h</option><option value="12n">Noturno · 19–07h</option><option value="24h">24h · 07–07h</option></FieldSelect></div>
      {!editing ? <div className="grid gap-5"><FieldSelect label="Setor" required value={form.setorId} onChange={(value) => set('setorId', value)}><option value="">Selecione o setor</option>{sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</FieldSelect><FieldSelect label="Categoria" required value={form.funcao} onChange={(value) => set('funcao', value as ExtraInput['funcao'])}><option value="enfermeiro">Enfermeiro</option><option value="tecnico">Técnico</option></FieldSelect></div> : null}
      {!editing ? <ProfessionalSelect label="Profissional" required value={form.substitutoId} onChange={(value) => set('substitutoId', value)} professionals={eligibleProfessionals} /> : null}
      {!editing ? <label className="block text-xs font-semibold text-text">Observação<textarea value={form.observacao ?? ''} onChange={(event) => set('observacao', event.target.value)} maxLength={500} rows={3} placeholder="Adicione um contexto para a coordenação" className="mt-3 min-h-20 w-full resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs text-text outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15" /></label> : null}
      {!editing ? <p className="flex gap-3 rounded-xl bg-[#eef8e9] p-4 text-sm leading-relaxed text-primary"><span className="text-lg">✓</span><span><strong className="block">Atualização automática</strong><span className="text-text-muted">Plantões já publicados não serão alterados. A regra será aplicada aos próximos rascunhos.</span></span></p> : null}
    </form>
  </Drawer>
}

export function CancelExtraDrawer({ extra, onClose, onCancelled }: { extra: ScheduledExtra; onClose: () => void; onCancelled: (extra: ScheduledExtra) => Promise<void> | void }) {
  const [justificativa, setJustificativa] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!justificativa.trim()) { setError('A justificativa é obrigatória.'); return }; setSaving(true); setError(''); try { await onCancelled(await cancelarExtra(extra.id, { revisaoEsperada: extra.revisao, justificativa: justificativa.trim() })) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar o extra.'); setSaving(false) } }
  return <Drawer id="cancel-extra" title="Cancelar extra" description="O registro será preservado no histórico." onClose={onClose} closeDisabled={saving} footer={<div className="flex items-center justify-end gap-2">{error ? <p role="alert" className="mr-auto text-xs font-semibold text-danger">{error}</p> : null}<button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold">Voltar</button><button form="cancel-extra-form" type="submit" disabled={saving} className="rounded-xl bg-danger px-4 py-2.5 text-xs font-bold text-white">{saving ? 'Cancelando…' : 'Confirmar cancelamento'}</button></div>}><form id="cancel-extra-form" onSubmit={submit} className="space-y-4"><p className="rounded-xl bg-neutral p-3 text-sm text-text">O extra de <strong>{extra.data}</strong> ficará cancelado, não entrará nos indicadores ativos e não será apagado.</p><label className="block text-xs font-semibold text-text">Justificativa *<textarea required value={justificativa} onChange={(event) => setJustificativa(event.target.value)} maxLength={500} rows={5} className={inputClass} /></label></form></Drawer>
}

export function RpaDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: (professional: Professional) => Promise<void> | void }) {
  return <RpaFormModal onClose={onClose} onCreated={onCreated} />
}
