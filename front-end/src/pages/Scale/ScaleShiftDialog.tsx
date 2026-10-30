import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Drawer } from '../../components/ui/Drawer'
import { PersonCard } from '../../components/ui/ScaleComponents'
import { listProfessionals } from '../../services/professionals'
import type { Professional } from '../Professionals/types'
import { listSectors } from '../../services/sectors'
import type { Sector } from '../Sectors/types'
import { stageShiftChange } from './review'
import {
  validateShiftBatch,
  type ShiftBatchChange,
  type ScaleDetail,
  type ScheduledShift,
  type ShiftOption,
  type ShiftRole,
  type ShiftType,
} from '../../services/scales'

interface EditScaleShiftDialogProps {
  scale: ScaleDetail
  shift: ScheduledShift | null
  initialDate: string
  stagedChanges: ShiftBatchChange[]
  onClose: () => void
  onStaged: (change: ShiftBatchChange) => void
}

type ProfessionalWithId = Professional & { id: string }

const isProfessionalWithId = (person: Professional): person is ProfessionalWithId =>
  typeof person.id === 'string'

function optionFor(shift: ScheduledShift): ShiftOption {
  if (shift.duracaoHoras === 24) return '24h'
  return shift.horarioInicio === '07:00' ? '12d' : '12n'
}

function formationFor(person: Professional): ShiftRole {
  return person.formation === 'Técnico' ? 'tecnico' : 'enfermeiro'
}

export function ScaleShiftDialog({ scale, shift, initialDate, stagedChanges, onClose, onStaged }: EditScaleShiftDialogProps) {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sectorId, setSectorId] = useState(shift?.setor.id ?? '')
  const [date] = useState(shift?.data ?? initialDate)
  const option: ShiftOption = shift ? optionFor(shift) : '12d'
  const type: ShiftType = shift?.tipo ?? 'regular'
  const [selectedIds, setSelectedIds] = useState(() => shift?.profissionais.map((person) => person.id) ?? [])
  const [leaderId, setLeaderId] = useState(() => shift?.profissionais.find((person) => person.lideranca)?.id ?? '')
  const [showAddProfessional, setShowAddProfessional] = useState(false)
  const [professionalToAddId, setProfessionalToAddId] = useState('')
  const [addProfessionalError, setAddProfessionalError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [validated, setValidated] = useState(false)
  const [validationSummary, setValidationSummary] = useState('')
  const monthStart = `${scale.escala.ano}-${String(scale.escala.mes).padStart(2, '0')}-01`
  const monthEnd = `${scale.escala.ano}-${String(scale.escala.mes).padStart(2, '0')}-${String(new Date(scale.escala.ano, scale.escala.mes, 0).getDate()).padStart(2, '0')}`
  const initialShiftSectorId = shift?.setor.id
  const assignedLeaderId = shift?.profissionais.find((person) => person.lideranca)?.id
    ?? shift?.profissionais.find((person) => person.formacao === 'enfermeiro')?.id
  const addingShift = shift === null

  useEffect(() => {
    let active = true
    Promise.all([listSectors(), listProfessionals()])
      .then(([sectorList, professionalList]) => {
        if (!active) return
        const availableSectors = sectorList.filter((sector) => sector.active || sector.id === initialShiftSectorId)
        setSectors(availableSectors)
        if (addingShift) setSectorId(availableSectors.find((sector) => sector.active)?.id ?? '')
        setProfessionals(professionalList)
        const leader = assignedLeaderId
          ?? professionalList.find((person) => person.status && person.formation === 'Enfemeiro')?.id
          ?? ''
        setLeaderId(leader)
        if (leader) setSelectedIds((current) => current.includes(leader) ? current : [...current, leader])
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os cadastros.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [addingShift, assignedLeaderId, initialShiftSectorId])

  const sector = sectors.find((item) => item.id === sectorId)
  const availableProfessionals = useMemo(
    () => professionals.filter((person): person is ProfessionalWithId => person.status && isProfessionalWithId(person)),
    [professionals],
  )
  const activeById = new Map(availableProfessionals.map((person) => [person.id, person]))
  const currentlyAssigned = new Map((shift?.profissionais ?? []).map((person) => [person.id, person]))
  const selectedPeople = selectedIds.map((id) => {
    const activePerson = activeById.get(id)
    const existingPerson = currentlyAssigned.get(id)
    return {
      id,
      name: activePerson?.name ?? existingPerson?.nome ?? id,
      formation: activePerson ? formationFor(activePerson) : existingPerson?.formacao,
      active: activePerson !== undefined,
    }
  })
  const selectedTechnicians = selectedPeople.filter((person) => person.formation === 'tecnico')
  const nurseOptions = availableProfessionals.filter((person) => formationFor(person) === 'enfermeiro')
  const selectedTeamMembers = selectedPeople.filter((person) => person.id !== leaderId)
  const selectedTeamNurses = selectedTeamMembers.filter((person) => person.formation === 'enfermeiro')
  const professionalsToAdd = availableProfessionals.filter((person) => !selectedIds.includes(person.id))
  const teamCountLabel = [
    selectedTeamNurses.length ? `${selectedTeamNurses.length} ${selectedTeamNurses.length === 1 ? 'enfermeiro' : 'enfermeiros'}` : '',
    selectedTechnicians.length ? `${selectedTechnicians.length} ${selectedTechnicians.length === 1 ? 'técnico' : 'técnicos'}` : '',
  ].filter(Boolean).join(' · ')
  const hasInactiveSelection = selectedPeople.some((person) => !person.active)
  const validDate = date >= monthStart && date <= monthEnd
  const dateLabel = validDate
    ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`))
    : 'Data fora do período da escala'

  const invalidate = () => {
    setValidated(false)
    setValidationSummary('')
    setFormError('')
  }

  const addProfessional = () => {
    if (!professionalToAddId) {
      setAddProfessionalError('Selecione um técnico ou enfermeiro.')
      return
    }
    const professional = availableProfessionals.find((person) => person.id === professionalToAddId)
    if (!professional) {
      setAddProfessionalError('Selecione um profissional ativo da lista.')
      return
    }
    if (selectedIds.includes(professional.id)) {
      setAddProfessionalError('Este profissional já está na equipe.')
      return
    }
    invalidate()
    setSelectedIds((current) => [...current, professional.id])
    setProfessionalToAddId('')
    setAddProfessionalError('')
    setShowAddProfessional(false)
  }

  const removeProfessional = (professionalId: string) => {
    invalidate()
    setSelectedIds((current) => current.filter((id) => id !== professionalId))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validDate) {
      setFormError('Selecione uma data dentro do mês da escala.')
      return
    }
    if (!sector?.active) {
      setFormError('Selecione um setor ativo.')
      return
    }
    if (selectedIds.length === 0) {
      setFormError('Selecione ao menos um profissional para o plantão.')
      return
    }
    if (!leaderId || !selectedIds.includes(leaderId)) {
      setFormError('Selecione um enfermeiro chefe para o plantão.')
      return
    }
    if (hasInactiveSelection) {
      setFormError('Remova os profissionais inativos ou indisponíveis antes de salvar.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const input = {
        setorId: sectorId,
        data: date,
        opcao: option,
        tipo: type,
        equipe: selectedIds.map((profissionalId) => ({
          profissionalId,
          funcao: formationFor(activeById.get(profissionalId)!),
          ...(profissionalId === leaderId ? { lideranca: true } : {}),
        })),
      }
      const change: ShiftBatchChange = { ...input, ...(shift ? { plantaoId: shift.id } : {}) }
      const preview = await validateShiftBatch(
        scale.escala.id,
        scale.escala.revisao,
        stageShiftChange(stagedChanges, change),
      )
      if (!preview.valida) {
        setValidated(false)
        setValidationSummary('A validação encontrou conflitos neste conjunto de alterações.')
        setFormError(preview.erros.map((item) => item.motivo ?? item.tipo ?? 'Conflito de validação').join(' '))
        return
      }
      setValidated(true)
      setValidationSummary('Alteração válida. Nenhum dado foi salvo ainda.')
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível atualizar o plantão.')
    } finally {
      setSaving(false)
    }
  }

  const apply = () => {
    if (!validated) return
    const input: ShiftBatchChange = {
      setorId: sectorId,
      data: date,
      opcao: option,
      tipo: type,
      equipe: selectedIds.map((profissionalId) => ({
        profissionalId,
        funcao: formationFor(activeById.get(profissionalId)!),
        ...(profissionalId === leaderId ? { lideranca: true } : {}),
      })),
      ...(shift ? { plantaoId: shift.id } : {}),
    }
    onStaged(input)
  }

  return (
    <Drawer
      id="edit-scale-shift"
      title={shift ? `Editar plantão · ${dateLabel}` : `Novo plantão · ${dateLabel}`}
      description="Ajuste profissionais, setor, turno e responsabilidade."
      onClose={onClose}
      closeDisabled={saving}
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-page disabled:opacity-50">
          Cancelar
        </button>
        <button
          type="submit"
          form="edit-scale-shift-form"
          disabled={saving || loading || Boolean(loadError) || !validDate || !sector?.active || selectedIds.length === 0 || !leaderId || hasInactiveSelection}
          className="rounded-xl border border-primary px-4 py-2.5 text-sm font-bold text-primary hover:bg-soft-green disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Validando...' : 'Validar conflitos'}
        </button>
        <button type="button" onClick={apply} disabled={saving || !validated} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Aplicar alteração</button>
      </div>}
    >
      <form id="edit-scale-shift-form" onSubmit={submit} noValidate className="space-y-5">
        {loadError ? <p role="alert" className="rounded-xl border border-error bg-error p-3 text-sm text-danger">{loadError}</p> : null}
        {loading ? <p role="status" className="text-sm text-text-muted">Carregando setores e profissionais...</p> : null}

        <fieldset disabled={saving || loading || Boolean(loadError)} className="space-y-4">
          <label className="block space-y-2 text-xs font-semibold text-text">
            Enfermeiro chefe
            <select value={leaderId} onChange={(event) => {
              const nextLeaderId = event.target.value
              invalidate()
              setLeaderId(nextLeaderId)
              setSelectedIds((current) => current.includes(nextLeaderId) ? current : [...current, nextLeaderId])
            }} className="w-full rounded-xl border border-border bg-neutral px-3 py-3 text-sm font-normal">
              <option value="">Selecione o enfermeiro chefe</option>
              {nurseOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <label className="block space-y-2 text-xs font-semibold text-text">
            Setor
            <select required value={sectorId} onChange={(event) => { invalidate(); setSectorId(event.target.value) }} className="w-full rounded-xl border border-border bg-neutral px-3 py-3 text-sm font-normal">
              {sectors.map((item) => <option key={item.id} value={item.id} disabled={!item.active}>{item.name}{item.active ? '' : ' (inativo)'}</option>)}
            </select>
          </label>
        </fieldset>

        <section aria-label="Equipe do plantão" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-text">Equipe do plantão</h3>
              <p className="mt-1 text-[10px] text-text-muted">Profissionais escalados em {sector?.name ?? 'Setor'}</p>
            </div>
            <span className="rounded-full bg-highlight px-2.5 py-1 text-[10px] font-bold text-primary">{teamCountLabel || 'Sem equipe adicional'}</span>
          </div>
          {selectedTeamMembers.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {selectedTeamMembers.map((person) => <li key={person.id}>
                <PersonCard
                  name={person.name}
                  detail={`${person.formation === 'tecnico' ? 'Técnico de enfermagem' : 'Enfermeiro'} · ${option === '24h' ? '24h' : option === '12d' ? '07h—19h' : '19h—07h'}`}
                  statusLabel={!person.active ? 'Inativo' : undefined}
                  statusTone="conflict"
                  action={<button type="button" onClick={() => removeProfessional(person.id)} disabled={saving} aria-label={`Remover ${person.name} do plantão`} className="rounded-md px-2 py-1 text-base text-text-muted hover:bg-neutral">×</button>}
                />
              </li>)}
            </ul>
          ) : <p className="text-xs text-text-muted">Nenhum profissional adicional selecionado.</p>}

          <button type="button" onClick={() => { setShowAddProfessional(true); setAddProfessionalError('') }} className="w-full rounded-xl border border-dashed border-primary bg-soft-green px-4 py-3 text-left text-xs font-semibold text-primary">
            ＋ &nbsp;Adicionar profissional ao plantão
          </button>
          {showAddProfessional ? (
            <section className="space-y-4 rounded-xl border border-border bg-neutral p-4">
              <div>
                <h4 className="text-sm font-bold text-text">Adicionar profissional ao plantão</h4>
                <p className="mt-1 text-[10px] text-text-muted">Selecione o técnico ou enfermeiro que deseja adicionar.</p>
              </div>
              <label className="block space-y-2 text-[10px] font-semibold text-text">
                Técnico ou enfermeiro
                <select
                  value={professionalToAddId}
                  onChange={(event) => { setProfessionalToAddId(event.target.value); setAddProfessionalError('') }}
                  disabled={professionalsToAdd.length === 0}
                  className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm font-normal disabled:opacity-60"
                >
                  <option value="">Selecione o profissional</option>
                  {professionalsToAdd.map((person) => <option key={person.id} value={person.id}>
                    {person.formation === 'Técnico' ? 'Técnico' : 'Enfermeiro'} · {person.name}
                  </option>)}
                </select>
              </label>
              {professionalsToAdd.length === 0 ? <p className="text-xs text-text-muted">Todos os profissionais ativos já estão neste plantão.</p> : null}
              {addProfessionalError ? <p role="alert" className="text-xs text-danger">{addProfessionalError}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowAddProfessional(false); setProfessionalToAddId(''); setAddProfessionalError('') }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text">Cancelar</button>
                <button type="button" onClick={addProfessional} disabled={professionalsToAdd.length === 0} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Adicionar ao plantão</button>
              </div>
            </section>
          ) : null}
        </section>

        {hasInactiveSelection ? <p role="alert" className="text-sm text-warning-text">Remova da equipe os profissionais que não estão ativos.</p> : null}
        {validationSummary ? <p role="status" className="rounded-xl border border-primary/20 bg-highlight p-3 text-sm text-primary">✓ &nbsp;{validationSummary}</p> : null}
        {formError ? <p role="alert" className="rounded-xl border border-error bg-error p-3 text-sm text-danger">{formError}</p> : null}
        <section aria-label="Validações do plantão" className="grid gap-x-4 gap-y-2 rounded-xl bg-neutral p-4 text-[10px] text-text-muted sm:grid-cols-2">
          {['Status e disponibilidade', 'Férias, afastamentos e restrições', 'Conflito de horário', 'Descanso obrigatório', 'Sobreposição de plantões'].map((check) => (
            <p key={check} className={validated ? 'text-primary' : ''}>{validated ? '✓' : '○'} &nbsp;{check}</p>
          ))}
        </section>
      </form>
    </Drawer>
  )
}
