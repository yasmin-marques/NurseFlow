import { useState, type FormEvent } from 'react'
import { Drawer } from '../../components/ui/Drawer'
import { cancelarExtra, criarExtra, editarExtra, type ExtraInput, type ScheduledExtra } from '../../services/extras'
import { createProfessional } from '../../services/professionals'
import type { Professional } from '../Professionals/types'

export type ExtraOption = '12d' | '12n' | '24h'
export type ExtraSector = { id: string; name: string }
export type ExtraProfessional = Professional & { id: string }

const inputClass = 'mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'
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
  return <label className="block text-xs font-semibold text-text">{label}{required ? <span className="text-danger"> *</span> : null}
    <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      <option value="">Selecione</option>
      {professionals.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.formation} · {person.bond}</option>)}
    </select>
  </label>
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

  return <Drawer id="extra-form" title={editing ? 'Editar extra' : 'Registrar extra'} description="Programe uma cobertura sem perder o histórico." onClose={onClose} closeDisabled={saving}
    footer={<div className="flex items-center justify-end gap-2">{error ? <p role="alert" className="mr-auto text-xs font-semibold text-danger">{error}</p> : null}<button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold">Cancelar</button><button form="extra-form-submit" type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white">{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Registrar extra'}</button></div>}>
    <form id="extra-form-submit" onSubmit={submit} className="space-y-4">
      <label className="block text-xs font-semibold text-text">Data civil *<input required type="date" value={form.data} onChange={(event) => set('data', event.target.value)} className={inputClass} /></label>
      <div className="grid grid-cols-3 gap-2"><label className="block text-xs font-semibold text-text">Jornada *<select value={form.opcao} onChange={(event) => set('opcao', event.target.value as ExtraOption)} className={inputClass}><option value="12d">12d · 07–19h</option><option value="12n">12n · 19–07h</option><option value="24h">24h · 07–07h</option></select></label><label className="block text-xs font-semibold text-text">Função *<select value={form.funcao} onChange={(event) => set('funcao', event.target.value as ExtraInput['funcao'])} className={inputClass}><option value="enfermeiro">Enfermeiro</option><option value="tecnico">Técnico</option></select></label><label className="block text-xs font-semibold text-text">Setor *<select required value={form.setorId} onChange={(event) => set('setorId', event.target.value)} className={inputClass}><option value="">Selecione</option>{sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></label></div>
      <label className="block text-xs font-semibold text-text">Motivo *<select value={form.motivo} onChange={(event) => set('motivo', event.target.value)} className={inputClass}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <ProfessionalSelect label="Substituto" required value={form.substitutoId} onChange={(value) => set('substitutoId', value)} professionals={professionals.filter((person) => person.status && (person.formation === 'Enfemeiro' ? form.funcao === 'enfermeiro' : form.funcao === 'tecnico'))} />
      {form.motivo !== 'reforco' ? <ProfessionalSelect label="Profissional coberto" required value={form.cobertoId ?? ''} onChange={(value) => set('cobertoId', value)} professionals={professionals} /> : null}
      <label className="block text-xs font-semibold text-text">Observação<textarea value={form.observacao ?? ''} onChange={(event) => set('observacao', event.target.value)} maxLength={500} rows={3} className={inputClass} /></label>
      <p className="rounded-xl bg-neutral p-3 text-xs text-text-muted">A API revalida férias, ausências, descanso, vínculos externos, limites e escala oficial antes de persistir.</p>
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
  const [form, setForm] = useState({ name: '', cpf: '', email: '', coren: '', formation: 'Enfemeiro' as Professional['formation'] })
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { const created = await createProfessional({ ...form, bond: 'RPA', status: true }); await onCreated(created) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o RPA.'); setSaving(false) } }
  return <Drawer id="rpa-form" title="Cadastrar RPA" description="Reutiliza o cadastro único de profissionais." onClose={onClose} closeDisabled={saving} footer={<div className="flex items-center justify-end gap-2">{error ? <p role="alert" className="mr-auto text-xs font-semibold text-danger">{error}</p> : null}<button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold">Cancelar</button><button form="rpa-form-submit" type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white">{saving ? 'Cadastrando…' : 'Cadastrar RPA'}</button></div>}><form id="rpa-form-submit" onSubmit={submit} className="space-y-4"><label className="block text-xs font-semibold text-text">Nome completo *<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} /></label><label className="block text-xs font-semibold text-text">CPF *<input required value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} className={inputClass} /></label><label className="block text-xs font-semibold text-text">E-mail *<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} /></label><label className="block text-xs font-semibold text-text">COREN *<input required value={form.coren} onChange={(event) => setForm({ ...form, coren: event.target.value })} className={inputClass} /></label><label className="block text-xs font-semibold text-text">Formação *<select value={form.formation} onChange={(event) => setForm({ ...form, formation: event.target.value as Professional['formation'] })} className={inputClass}><option value="Enfemeiro">Enfermeiro</option><option value="Técnico">Técnico</option></select></label></form></Drawer>
}
