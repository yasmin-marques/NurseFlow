import { useEffect, useState, type FormEvent } from 'react'
import { Check, X } from '../../components/icons'
import { createProfessional } from '../../services/professionals'
import type { FormationType, Professional } from '../Professionals/types'

type Props = { onClose: () => void; onCreated: (professional: Professional) => Promise<void> | void }
type Form = { name: string; cpf: string; email: string; coren: string; formation: FormationType; status: boolean }

const input = 'mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'

function Choice({ title, description, selected, onClick }: { title: string; description: string; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`relative flex min-h-[62px] items-center gap-2 rounded-xl border px-4 py-3 text-left ${selected ? 'border-primary bg-[#f1f7ef]' : 'border-border bg-white hover:bg-[#fbfcfa]'}`}>
    <span className={`size-2 shrink-0 rounded-full ${selected ? 'bg-primary' : 'bg-[#a4ada2]'}`} />
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text">{title}</span><span className="mt-1 block text-xs leading-relaxed text-text-muted">{description}</span></span>
    {selected ? <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} /> : null}
  </button>
}

export function RpaFormModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<Form>({ name: '', cpf: '', email: '', coren: '', formation: 'Enfemeiro', status: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('')
    try { await onCreated(await createProfessional({ ...form, bond: 'RPA', status: true })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o RPA.'); setSaving(false) }
  }

  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="rpa-form-title" className="flex h-full w-full max-w-[443px] flex-col bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-border px-5 py-5"><div><h2 id="rpa-form-title" className="text-base font-bold text-text">Cadastrar RPA</h2><p className="mt-1 text-xs text-text-muted">Dados profissionais e disponibilidade</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Fechar cadastro de RPA" className="rounded-xl border border-border p-2 text-text-muted hover:bg-card-header disabled:opacity-50"><X className="size-5" /></button></header>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col"><div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
        <label className="block text-[11px] font-semibold text-text">Nome completo <span className="text-danger">*</span><input required value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Digite o nome do profissional" className={input} /></label>
        <label className="block text-[11px] font-semibold text-text">CPF <span className="text-danger">*</span><input required value={form.cpf} onChange={(event) => set('cpf', event.target.value)} placeholder="Digite o CPF do profissional" className={input} /></label>
        <label className="block text-[11px] font-semibold text-text">E-mail <span className="text-danger">*</span><input required type="email" value={form.email} onChange={(event) => set('email', event.target.value)} placeholder="Digite o e-mail do profissional" className={input} /></label>
        <p className="rounded-xl bg-warning px-3.5 py-2 text-[10px] leading-relaxed text-warning-text"><strong>Recomendação:</strong> Para profissionais de faixa etária mais avançada, recomenda-se informar um e-mail durante o cadastro para facilitar o acesso e a recuperação da conta.</p>
        <label className="block text-[11px] font-semibold text-text">COREN <span className="text-danger">*</span><input required value={form.coren} onChange={(event) => set('coren', event.target.value)} placeholder="123.456" className={input} /></label>
        <section><h3 className="text-[11px] font-semibold text-text">Status do profissional <span className="text-danger">*</span></h3><div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-[#f3f5f1] p-1.5"><Choice title="Desativado" description="Não participa de novas escalas" selected={!form.status} onClick={() => set('status', false)} /><Choice title="Ativo" description="Disponível para participar das escalas" selected={form.status} onClick={() => set('status', true)} /></div></section>
        <section><h3 className="text-[11px] font-semibold text-text">Tipo de formação <span className="text-danger">*</span></h3><div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-[#f3f5f1] p-1.5"><Choice title="Enfermeiro" description="Graduação em enfermagem" selected={form.formation === 'Enfemeiro'} onClick={() => set('formation', 'Enfemeiro')} /><Choice title="Técnico" description="Formação em nível técnico" selected={form.formation === 'Técnico'} onClick={() => set('formation', 'Técnico')} /></div></section>
      </div><footer className="flex justify-end gap-2 border-t border-border px-5 py-4">{error ? <p role="alert" className="mr-auto self-center text-[11px] font-semibold text-danger">{error}</p> : null}<button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text hover:bg-card-header">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-95">{saving ? 'Cadastrando…' : 'Cadastrar RPA'}</button></footer></form>
    </aside>
  </div>
}
