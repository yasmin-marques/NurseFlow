import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Drawer } from '../../components/ui/Drawer'
import { PersonCard } from '../../components/ui/ScaleComponents'
import { listProfessionals } from '../../services/professionals'
import type { Professional } from '../Professionals/types'
import { listSectors } from '../../services/sectors'
import type { Sector } from '../Sectors/types'
import { stageShiftChanges } from './review'
import {
  SHIFT_CHOICES,
  buildShiftChanges,
  emptiedShifts,
  formationFor,
  searchProfessionals,
  seedDayMembers,
  shiftChoice,
  professionalsAvailableToAdd,
} from './shift-dialog.helpers'
import type { DayMember, ProfessionalWithId } from './shift-dialog.helpers'
import { daysInMonth } from './calendar'
import {
  validateShiftBatch,
  type CoverageVacancy,
  type ShiftBatchChange,
  type ScaleDetail,
  type ScheduledShift,
  type ShiftOption,
} from '../../services/scales'

export interface ShiftEditScope {
  setorId: string
  data: string
  plantaoIds: string[]
}

interface EditScaleShiftDialogProps {
  scale: ScaleDetail
  dayShifts: ScheduledShift[]
  focusSectorId?: string
  initialDate: string
  stagedChanges: ShiftBatchChange[]
  onClose: () => void
  onStaged: (changes: ShiftBatchChange[], scope: ShiftEditScope) => void
}

interface AddProfessionalGroup {
  id: string
  label: string
  professionals: ProfessionalWithId[]
  disabled?: boolean
}

const formationLabel = (formation?: string) => formation === 'tecnico' ? 'Técnico de enfermagem' : 'Enfermeiro'

export function ScaleShiftDialog({ scale, dayShifts, focusSectorId, initialDate, stagedChanges, onClose, onStaged }: EditScaleShiftDialogProps) {
  const date = initialDate
  const shiftsOf = (id: string) => dayShifts.filter((item) => item.setor.id === id)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sectorId, setSectorId] = useState(focusSectorId ?? dayShifts[0]?.setor.id ?? '')
  const [members, setMembers] = useState<DayMember[]>(() =>
    seedDayMembers(shiftsOf(focusSectorId ?? dayShifts[0]?.setor.id ?? ''), stagedChanges, focusSectorId ?? dayShifts[0]?.setor.id ?? '', date))
  const [showAddProfessional, setShowAddProfessional] = useState(false)
  const [openAddGroupId, setOpenAddGroupId] = useState<string | null>(null)
  const [professionalToAddId, setProfessionalToAddId] = useState('')
  const [professionalSearch, setProfessionalSearch] = useState('')
  const [addProfessionalOption, setAddProfessionalOption] = useState<ShiftOption>(() => members[0]?.option ?? '12d')
  const [addProfessionalError, setAddProfessionalError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [validated, setValidated] = useState(false)
  const [validationSummary, setValidationSummary] = useState('')
  const [coveragePending, setCoveragePending] = useState<CoverageVacancy[]>([])
  const [coverageAccepted, setCoverageAccepted] = useState(false)
  const [emergencyAccepted, setEmergencyAccepted] = useState(false)
  const [emergencyErrors, setEmergencyErrors] = useState<string[]>([])
  const [emergencyCanApply, setEmergencyCanApply] = useState(false)
  const monthStart = `${String(scale.escala.ano).padStart(4, '0')}-${String(scale.escala.mes).padStart(2, '0')}-01`
  const monthEnd = `${String(scale.escala.ano).padStart(4, '0')}-${String(scale.escala.mes).padStart(2, '0')}-${String(daysInMonth(scale.escala.ano, scale.escala.mes)).padStart(2, '0')}`
  const initialSectorId = focusSectorId ?? dayShifts[0]?.setor.id

  useEffect(() => {
    let active = true
    Promise.all([listSectors(), listProfessionals()])
      .then(([sectorList, professionalList]) => {
        if (!active) return
        const availableSectors = sectorList.filter((item) => item.active || item.id === initialSectorId)
        setSectors(availableSectors)
        if (!initialSectorId) setSectorId(availableSectors.find((item) => item.active)?.id ?? '')
        setProfessionals(professionalList)
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
  }, [initialSectorId])

  const sector = sectors.find((item) => item.id === sectorId)
  const sectorShifts = shiftsOf(sectorId)
  const availableProfessionals = useMemo(
    () => professionals.filter((person): person is ProfessionalWithId => person.status && typeof person.id === 'string' && person.sectorId === sectorId),
    [professionals, sectorId],
  )
  const activeById = new Map(availableProfessionals.map((person) => [person.id, person]))
  const knownById = new Map(scale.plantoes.flatMap((item) => item.profissionais).map((person) => [person.id, person]))
  const infoOf = (id: string) => {
    const activePerson = activeById.get(id)
    const known = knownById.get(id)
    return {
      name: activePerson?.name ?? known?.nome ?? id,
      formation: activePerson ? formationFor(activePerson) : known?.formacao,
      subsector: activePerson?.subsectorName ?? known?.subsetor?.nome ??
        sector?.subsectors.find((item) => item.id === activePerson?.subsectorId)?.name ?? '',
      subsectorId: activePerson?.subsectorId ?? known?.subsetor?.id,
      active: activePerson !== undefined,
    }
  }
  const nurseOptions = availableProfessionals.filter((person) => formationFor(person) === 'enfermeiro')
  const orderedMembers = SHIFT_CHOICES.flatMap((choice) => members
    .filter((member) => member.option === choice.value)
    .sort((a, b) => Number(b.leader) - Number(a.leader) || Number(infoOf(a.id).formation === 'tecnico') - Number(infoOf(b.id).formation === 'tecnico')))
  const professionalsToAdd = useMemo(
    () => professionalsAvailableToAdd(availableProfessionals, members.map((member) => member.id)),
    [availableProfessionals, members],
  )
  const matchingProfessionals = useMemo(
    () => searchProfessionals(professionalsToAdd, professionalSearch),
    [professionalsToAdd, professionalSearch],
  )
  const addProfessionalGroups = useMemo<AddProfessionalGroup[]>(() => {
    if (!sector?.hasSubsectors) {
      return [{ id: 'professionals', label: 'Profissionais disponíveis', professionals: matchingProfessionals }]
    }

    const activeSubsectors = sector.subsectors.filter((item) => item.active)
    const validSubsectorIds = new Set(activeSubsectors.map((item) => item.id))
    const groups: AddProfessionalGroup[] = [
      {
        id: 'nurses',
        label: 'Enfermeiros do setor',
        professionals: matchingProfessionals.filter((person) => formationFor(person) === 'enfermeiro'),
      },
      ...activeSubsectors.map((subsector) => ({
        id: `subsector-${subsector.id}`,
        label: subsector.name,
        professionals: matchingProfessionals.filter(
          (person) => formationFor(person) === 'tecnico' && person.subsectorId === subsector.id,
        ),
      })),
      {
        id: 'technicians-without-subsector',
        label: 'Técnicos sem vínculo ativo a subsetor',
        professionals: matchingProfessionals.filter(
          (person) => formationFor(person) === 'tecnico' && !validSubsectorIds.has(person.subsectorId ?? ''),
        ),
        disabled: true,
      },
    ]

    return groups.filter((group) =>
      group.professionals.length > 0 ||
      (!professionalSearch.trim() && group.id.startsWith('subsector-')),
    )
  }, [matchingProfessionals, professionalSearch, sector])
  const editSubsectorRows = sector?.hasSubsectors
    ? (() => {
        const rows = new Map(sector.subsectors.map((subsector) => [
          subsector.id,
          { id: subsector.id, name: subsector.name, professionals: [] as string[] },
        ] as const))
        for (const member of orderedMembers) {
          const info = infoOf(member.id)
          if (info.formation !== 'tecnico') continue
          const id = info.subsectorId ?? 'without-subsector'
          const row = rows.get(id) ?? {
            id,
            name: info.subsector || 'Sem subsetor cadastrado',
            professionals: [],
          }
          row.professionals.push(info.name)
          rows.set(id, row)
        }
        return [...rows.values()]
      })()
    : []
  const hasInactiveSelection = members.some((member) => !infoOf(member.id).active)
  const leader = members.find((member) => member.leader)
  const leaderCandidates = nurseOptions.filter((person) => members.some((member) => member.id === person.id && member.option === '24h'))
  const missingLeader = (leaderCandidates.length > 0 && !leader) ||
    members.some((member) => member.leader && member.option !== '24h')
  const emptied = emptiedShifts(sectorShifts, members)
  const changes = buildShiftChanges({
    sectorId,
    date,
    sectorShifts,
    members,
    formationOf: (id) => infoOf(id).formation ?? 'enfermeiro',
  })
  const scope: ShiftEditScope = { setorId: sectorId, data: date, plantaoIds: sectorShifts.map((item) => item.id) }
  const validDate = date >= monthStart && date <= monthEnd
  const dateLabel = validDate
    ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`))
    : 'Data fora do período da escala'
  const canValidate = !(saving || loading || loadError || !validDate || !sector?.active || members.length === 0 ||
    missingLeader || hasInactiveSelection || emptied.length > 0 || changes.length === 0)

  const invalidate = () => {
    setValidated(false)
    setValidationSummary('')
    setCoveragePending([])
    setCoverageAccepted(false)
    setEmergencyAccepted(false)
    setEmergencyErrors([])
    setEmergencyCanApply(false)
    setFormError('')
  }

  const changeSector = (nextSectorId: string) => {
    invalidate()
    setSectorId(nextSectorId)
    setMembers(seedDayMembers(shiftsOf(nextSectorId), stagedChanges, nextSectorId, date))
  }

  const setLeader = (id: string) => {
    invalidate()
    setMembers((current) => current.map((member) => ({ ...member, leader: member.id === id && member.option === '24h' })))
  }

  const addProfessional = () => {
    if (!professionalToAddId) {
      setAddProfessionalError('Selecione um profissional cadastrado.')
      return
    }
    const professional = professionalsToAdd.find((person) => person.id === professionalToAddId)
    if (!professional) {
      setAddProfessionalError('Selecione um profissional ativo da lista.')
      return
    }
    invalidate()
    setMembers((current) => [...current, { id: professional.id, option: addProfessionalOption, leader: false }])
    setProfessionalToAddId('')
    setProfessionalSearch('')
    setAddProfessionalError('')
    setOpenAddGroupId(null)
    setShowAddProfessional(false)
  }

  const openProfessionalPicker = () => {
    setProfessionalToAddId('')
    setProfessionalSearch('')
    setAddProfessionalError('')
    setOpenAddGroupId(null)
    setShowAddProfessional(true)
  }

  const closeProfessionalPicker = () => {
    setProfessionalToAddId('')
    setProfessionalSearch('')
    setAddProfessionalError('')
    setOpenAddGroupId(null)
    setShowAddProfessional(false)
  }

  const removeProfessional = (professionalId: string) => {
    invalidate()
    setMembers((current) => current.filter((member) => member.id !== professionalId))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canValidate) return
    setSaving(true)
    setFormError('')
    setCoverageAccepted(false)
    try {
      const preview = await validateShiftBatch(
        scale.escala.id,
        scale.escala.revisao,
        stageShiftChanges(stagedChanges, changes, scope),
        emergencyAccepted,
      )
      setCoveragePending(preview.pendencias)
      if (!preview.valida) {
        setValidated(false)
            const errors = preview.erros.map((error) => typeof error === 'string' ? error : error.motivo ?? error.tipo ?? 'Conflito de validação')
        const forceableErrors = errors.filter((error) => error.includes('não respeita o descanso obrigatório ou possui plantões sobrepostos') || error.includes('excede a carga regular configurada'))
        const blockingErrors = errors.filter((error) => !forceableErrors.includes(error))
        setEmergencyErrors(forceableErrors)
        setEmergencyCanApply(forceableErrors.length > 0 && blockingErrors.length === 0)
        setValidationSummary(forceableErrors.length > 0
          ? 'Há conflitos de descanso ou carga regular relacionados aos profissionais desta alteração.'
          : 'A validação encontrou conflitos neste conjunto de alterações.')
        setFormError(blockingErrors.length > 0 ? blockingErrors.join('\n') : '')
        return
      }
      setEmergencyErrors(preview.conflitosForcados ?? [])
      setEmergencyCanApply((preview.conflitosForcados?.length ?? 0) > 0)
        setValidated(true)
      setValidationSummary(preview.conflitosForcados?.length
        ? `Conflito(s) emergencial(is) reconhecido(s). ${preview.requerConfirmacaoCobertura ? 'A cobertura do setor/dia ainda apresenta pendências.' : 'A alteração pode ser aplicada.'}`
        : preview.requerConfirmacaoCobertura
        ? 'Sem conflitos impeditivos. A cobertura mínima ainda apresenta pendências.'
        : 'Alteração válida. Ela será salva ao aplicar.')
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível atualizar o plantão.')
    } finally {
      setSaving(false)
    }
  }

  const apply = () => {
    if (!validated || (coveragePending.length > 0 && !coverageAccepted)) return
    onStaged(
      changes.map((change) => ({
        ...change,
        ...(coverageAccepted ? { coberturaReconhecida: true } : {}),
        ...(emergencyAccepted ? { forcarConflitos: true } : {}),
      })),
      scope,
    )
  }

  return (
    <Drawer
      id="edit-scale-shift"
      title={`Editar plantões · ${dateLabel}`}
      description="Profissionais do setor neste dia e seus respectivos plantões."
      onClose={onClose}
      closeDisabled={saving}
      footer={<div className="flex flex-col-reverse gap-1.5 sm:flex-row sm:justify-end">
        <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-page disabled:opacity-50">
          Cancelar
        </button>
        <button
          type="submit"
          form="edit-scale-shift-form"
          disabled={!canValidate}
          className="rounded-lg border border-primary px-3 py-2 text-xs font-bold text-primary hover:bg-soft-green disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Validando...' : 'Validar conflitos'}
        </button>
        <button type="button" onClick={apply} disabled={saving || !validated || (coveragePending.length > 0 && !coverageAccepted)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Aplicar e salvar</button>
      </div>}
    >
      <form id="edit-scale-shift-form" onSubmit={submit} noValidate className="space-y-5">
        {loadError ? <p role="alert" className="rounded-xl border border-error bg-error p-2.5 text-xs text-danger whitespace-pre-line">{loadError}</p> : null}
        {loading ? <p role="status" className="text-sm text-text-muted">Carregando setores e profissionais...</p> : null}

        <fieldset disabled={saving || loading || Boolean(loadError)} className="space-y-4">
          <label className="block space-y-1.5 text-[11px] font-semibold text-text">
            Setor
            <select required value={sectorId} onChange={(event) => changeSector(event.target.value)} className="w-full rounded-xl border border-border bg-neutral px-2.5 py-2 text-xs font-normal">
              {sectors.map((item) => <option key={item.id} value={item.id} disabled={!item.active}>{item.name}{item.active ? '' : ' (inativo)'}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 text-[11px] font-semibold text-text">
            Enfermeiro chefe (plantão 24h)
            <select
              value={leader?.id ?? ''}
              onChange={(event) => setLeader(event.target.value)}
              className="w-full rounded-xl border border-border bg-neutral px-2.5 py-2 text-xs font-normal"
            >
              <option value="">Sem enfermeiro chefe</option>
              {leaderCandidates.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
        </fieldset>

        <section aria-label="Equipe do setor no dia" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-text">Profissionais do setor</h3>
              <p className="mt-1 text-[10px] text-text-muted">Escalados em {sector?.name ?? 'Setor'} em {dateLabel}</p>
            </div>
            <span className="rounded-full bg-highlight px-2.5 py-1 text-[10px] font-bold text-primary">
              {members.length} {members.length === 1 ? 'profissional' : 'profissionais'}
            </span>
          </div>
          {editSubsectorRows.length > 0 ? (
            <dl aria-label="Profissionais por subsetor" className="space-y-1 rounded-xl bg-page px-3 py-2">
              {editSubsectorRows.map((row) => (
                <div key={row.id} className="grid gap-0.5 text-[10px] sm:grid-cols-[minmax(8rem,0.3fr)_1fr] sm:gap-2">
                  <dt className="font-semibold text-text">{row.name}</dt>
                  <dd className="text-text-muted">{row.professionals.join(', ') || 'Nenhum profissional escalado'}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {orderedMembers.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {orderedMembers.map((member) => {
                const info = infoOf(member.id)
                const choice = shiftChoice(member.option)
                return <li key={member.id}>
                  <PersonCard
                    name={info.name}
                    detail={`${formationLabel(info.formation)}${info.formation === 'tecnico' && info.subsector ? ` · ${info.subsector}` : ''} · ${choice.label} · ${choice.hours}`}
                    badges={member.leader ? [{ label: 'Chefe', tone: 'covered' }] : []}
                    statusLabel={!info.active ? 'Inativo' : undefined}
                    statusTone="conflict"
                    action={<button type="button" onClick={() => removeProfessional(member.id)} disabled={saving} aria-label={`Remover ${info.name} do plantão`} className="rounded-md px-2 py-1 text-base text-text-muted hover:bg-neutral">×</button>}
                  />
                </li>
              })}
            </ul>
          ) : <p className="text-xs text-text-muted">Nenhum profissional escalado neste setor neste dia.</p>}

          <button type="button" onClick={openProfessionalPicker} className="w-full rounded-xl border border-dashed border-primary bg-soft-green px-4 py-3 text-left text-xs font-semibold text-primary">
            ＋ &nbsp;Adicionar profissional ao setor
          </button>
          {showAddProfessional ? (
            <section className="space-y-4 rounded-xl border border-border bg-neutral p-4">
              <div>
                <h4 className="text-xs font-bold text-text">Novo profissional no setor</h4>
                <p className="mt-1 text-[10px] text-text-muted">Digite o nome e escolha o plantão do profissional neste dia.</p>
              </div>
              <label htmlFor="new-technician-search" className="block space-y-2 text-[10px] font-semibold text-text">
                Nome do profissional
                <input
                  id="new-technician-search"
                  type="search"
                  value={professionalSearch}
                  onChange={(event) => {
                    setProfessionalSearch(event.target.value)
                    setProfessionalToAddId('')
                    setAddProfessionalError('')
                  }}
                  placeholder="Comece a digitar o nome"
                  autoComplete="off"
                  disabled={professionalsToAdd.length === 0}
                  className="w-full rounded-xl border border-border bg-white px-2.5 py-2 text-xs font-normal disabled:opacity-60"
                />
              </label>
              {professionalsToAdd.length === 0 ? (
                <p className="text-xs text-text-muted">Nenhum profissional ativo disponível para adicionar.</p>
              ) : sector?.hasSubsectors ? (
                <div className="space-y-2">
                  {addProfessionalGroups.map((group) => {
                    const isOpen = openAddGroupId === group.id
                    return (
                      <section key={group.id} className="overflow-hidden rounded-lg border border-border bg-white">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`add-professionals-${group.id}`}
                          disabled={group.disabled}
                          onClick={() => {
                            setOpenAddGroupId(isOpen ? null : group.id)
                            setProfessionalToAddId('')
                            setAddProfessionalError('')
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span>
                            <span className="block text-[11px] font-bold text-text">{group.label}</span>
                            <span className="text-[10px] text-text-muted">
                              {group.disabled ? 'Vínculo de subsetor necessário' : `${group.professionals.length} profissional(is) disponível(is)`}
                            </span>
                          </span>
                          {!group.disabled ? <span aria-hidden className="text-sm text-primary">{isOpen ? '−' : '+'}</span> : null}
                        </button>
                        {isOpen ? (
                          <div id={`add-professionals-${group.id}`} className="border-t border-border p-2">
                            {group.professionals.length > 0 ? (
                              <fieldset className="max-h-40 space-y-1 overflow-y-auto" aria-label={`Profissionais elegíveis: ${group.label}`}>
                                {group.professionals.map((person) => (
                                  <label key={person.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-neutral px-2 py-1.5 text-[11px] text-text">
                                    <input
                                      type="radio"
                                      name="professional-to-add"
                                      value={person.id}
                                      checked={professionalToAddId === person.id}
                                      onChange={() => { setProfessionalToAddId(person.id); setAddProfessionalError('') }}
                                    />
                                    <span>{person.name}</span>
                                    <span className="ml-auto rounded-full bg-highlight px-2 py-0.5 text-[10px] font-semibold text-primary">{formationLabel(formationFor(person))}</span>
                                  </label>
                                ))}
                              </fieldset>
                            ) : (
                              <p className="text-[10px] text-text-muted">Nenhum profissional disponível neste subsetor.</p>
                            )}
                          </div>
                        ) : null}
                      </section>
                    )
                  })}
                </div>
              ) : matchingProfessionals.length > 0 ? (
                <fieldset className="max-h-40 space-y-1 overflow-y-auto" aria-label="Profissionais elegíveis">
                  {matchingProfessionals.map((person) => (
                    <label key={person.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-[11px] text-text">
                      <input
                        type="radio"
                        name="professional-to-add"
                        value={person.id}
                        checked={professionalToAddId === person.id}
                        onChange={() => { setProfessionalToAddId(person.id); setAddProfessionalError('') }}
                      />
                      <span>{person.name}</span>
                      <span className="ml-auto rounded-full bg-highlight px-2 py-0.5 text-[10px] font-semibold text-primary">{formationLabel(formationFor(person))}</span>
                    </label>
                  ))}
                </fieldset>
              ) : <p className="text-xs text-text-muted">Nenhum profissional corresponde à busca.</p>}
              <fieldset className="space-y-1">
                <legend className="text-[14px] font-semibold text-text">Plantão neste dia</legend>
                <div className="grid grid-cols-3 gap-1" role="group" aria-label="Plantão do profissional">
                  {SHIFT_CHOICES.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={addProfessionalOption === choice.value}
                      onClick={() => setAddProfessionalOption(choice.value)}
                      className={`rounded-md border px-1 py-1.5 text-left leading-tight ${addProfessionalOption === choice.value ? 'border-primary bg-highlight text-primary' : 'border-border bg-white text-text'}`}
                    >
                      <span className="block font-bold text-[14px]">{choice.label}</span>
                      <span className="mt-0.5 block text-text-muted text-[11px]">{choice.hours}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {addProfessionalError ? <p role="alert" className="text-xs text-danger">{addProfessionalError}</p> : null}
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => {
                  closeProfessionalPicker()
                }} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-text">Cancelar</button>
                <button type="button" onClick={addProfessional} disabled={!professionalToAddId} className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">＋ &nbsp;Adicionar à equipe</button>
              </div>
            </section>
          ) : null}
        </section>

        {missingLeader ? <p role="alert" className="text-xs text-warning-text">Selecione o enfermeiro chefe entre os enfermeiros de plantão 24h do dia.</p> : null}
        {emptied.length > 0 ? <p role="alert" className="text-xs text-warning-text">Cada plantão existente precisa manter ao menos um profissional.</p> : null}
        {hasInactiveSelection ? <p role="alert" className="text-sm text-warning-text">Remova da equipe os profissionais que não estão ativos.</p> : null}
        {validationSummary ? <p role="status" className="rounded-xl border border-primary/20 bg-highlight p-3 text-xs text-primary">✓ &nbsp;{validationSummary}</p> : null}
        {emergencyErrors.length > 0 ? (
          <section aria-label="Conflitos dos profissionais alterados" className="space-y-3 rounded-xl border border-warning bg-warning/20 p-4">
            <div>
              <h3 className="text-sm font-bold text-text">Conflitos desta alteração</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text">{emergencyErrors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>
            </div>
            <label className="flex items-start gap-2 text-xs font-semibold text-text">
              <input type="checkbox" checked={emergencyAccepted} onChange={(event) => {
                const accepted = event.target.checked
                setEmergencyAccepted(accepted)
                setFormError('')
                if (accepted && emergencyCanApply) {
                  setValidated(true)
                  setValidationSummary('Conflitos emergenciais reconhecidos. A alteração pode ser aplicada e será validada novamente ao salvar.')
                } else {
                  setValidated(false)
                  setValidationSummary('Há conflitos de descanso ou carga regular relacionados aos profissionais desta alteração.')
                }
              }} />
              Emergência: permitir este plantão mesmo com conflito de descanso ou carga regular.
            </label>
          </section>
        ) : null}
        {coveragePending.length > 0 ? (
          <section aria-label="Pendências de cobertura" className="space-y-3 rounded-xl border border-warning bg-warning/20 p-4">
            <div>
              <h3 className="text-sm font-bold text-text">Cobertura abaixo do mínimo</h3>
              <p className="mt-1 text-xs text-text-muted">Estas vagas permanecerão abertas após salvar; isso não impede a edição:</p>
            </div>
            <ul className="space-y-1 text-xs text-text">
              {coveragePending.map((pending) => (
                <li key={`${pending.setorId}-${pending.data}-${pending.turno}-${pending.funcao}`}>
                  {pending.setor}{pending.subsetor ? ` · ${pending.subsetor}` : ''} · {pending.data} · {pending.turno === 'diurno' ? 'Diurno' : pending.turno === '24h' ? '24h' : 'Noturno'} · {pending.funcao}: {pending.alocado}/{pending.necessario}; faltam {pending.faltam}
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2 text-xs font-semibold text-text">
              <input
                type="checkbox"
                checked={coverageAccepted}
                onChange={(event) => setCoverageAccepted(event.target.checked)}
              />
              Reconheço que a alteração deixará estas vagas de cobertura em aberto.
            </label>
          </section>
        ) : null}
        {formError ? <p role="alert" className="rounded-xl border border-error bg-error p-2.5 text-xs text-danger whitespace-pre-line">{formError}</p> : null}
        <section aria-label="Validações do plantão" className="grid gap-x-4 gap-y-2 rounded-xl bg-neutral p-4 text-[10px] text-text-muted sm:grid-cols-2">
          {['Status e disponibilidade', 'Férias, afastamentos e restrições', 'Conflito de horário', 'Descanso obrigatório', 'Sobreposição de plantões'].map((check) => (
            <p key={check} className={validated ? 'text-primary' : ''}>{validated ? '✓' : '○'} &nbsp;{check}</p>
          ))}
        </section>
      </form>
    </Drawer>
  )
}
