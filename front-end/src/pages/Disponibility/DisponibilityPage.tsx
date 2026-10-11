import { useEffect, useState } from 'react'
import { Check, Plus } from '../../components/icons'
import { Toast } from '../../components/ui/Toast'
import {
  AvailabilityFormModal,
  type AvailabilityCategory,
  type AvailabilityRecord,
} from './components/AvailabilityFormModal'

const INITIAL_RECORDS: Record<AvailabilityCategory, AvailabilityRecord[]> = {
  restrictions: [
    {
      id: 'restriction-ana',
      category: 'restrictions',
      name: 'Ana Ribeiro',
      role: 'Enfermagem',
      rule: 'Não disponível às quartas',
      period: 'Recorrente',
    },
    {
      id: 'restriction-lucas',
      category: 'restrictions',
      name: 'Lucas Mendes',
      role: 'Enfermagem',
      rule: 'Somente turno diurno',
      period: 'Até 30 jun',
    },
    {
      id: 'restriction-beatriz',
      category: 'restrictions',
      name: 'Beatriz Lima',
      role: 'Enfermagem',
      rule: 'Indisponível aos domingos',
      period: 'Recorrente',
    },
  ],
  externalLinks: [
    {
      id: 'external-mariana',
      category: 'externalLinks',
      name: 'Mariana Costa',
      role: 'Enfermagem',
      rule: 'Vínculo no Hospital Central',
      period: '12h semanais',
    },
    {
      id: 'external-rafael',
      category: 'externalLinks',
      name: 'Rafael Souza',
      role: 'Enfermagem',
      rule: 'Plantões em clínica parceira',
      period: 'Fins de semana',
    },
  ],
  absences: [
    {
      id: 'absence-carolina',
      category: 'absences',
      name: 'Carolina Alves',
      role: 'Enfermagem',
      rule: 'Férias',
      period: '1–15 jul',
    },
    {
      id: 'absence-pedro',
      category: 'absences',
      name: 'Pedro Nunes',
      role: 'Enfermagem',
      rule: 'Licença médica',
      period: 'Até 20 jun',
    },
  ],
}

const TABS: { id: AvailabilityCategory; label: string }[] = [
  { id: 'restrictions', label: 'Restrições' },
  { id: 'externalLinks', label: 'Vínculos externos' },
  { id: 'absences', label: 'Férias e ausências' },
]

export function DisponibilityPage() {
  const [records, setRecords] = useState(INITIAL_RECORDS)
  const [activeCategory, setActiveCategory] = useState<AvailabilityCategory>('restrictions')
  const [editingRecord, setEditingRecord] = useState<AvailabilityRecord | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const activeRecords = records[activeCategory]
  const professionals = [...new Set(Object.values(records).flat().map((record) => record.name))]

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const openCreateForm = () => {
    setEditingRecord(null)
    setIsFormOpen(true)
  }

  const openEditForm = (record: AvailabilityRecord) => {
    setEditingRecord(record)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setEditingRecord(null)
    setIsFormOpen(false)
  }

  const saveRecord = (record: AvailabilityRecord) => {
    setRecords((current) => {
      const next = { ...current }
      for (const category of TABS) {
        next[category.id] = next[category.id].filter((item) => item.id !== record.id)
      }
      next[record.category] = [...next[record.category], record]
      return next
    })
    setActiveCategory(record.category)
    setToast(editingRecord ? 'Registro atualizado com sucesso' : 'Registro adicionado com sucesso')
    closeForm()
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-6 sm:px-7 lg:px-10 xl:px-12">
      <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.04em] text-text">
            Disponibilidade
          </h2>
          <p className="mt-2.5 text-[14px] text-text-muted">
            Restrições, vínculos externos e ausências da equipe.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(46,120,61,0.2)] transition-colors hover:bg-primary-hover"
        >
          <Plus className="size-4" strokeWidth={2.4} />
          Adicionar registro
        </button>
      </header>

      <section aria-label="Registros de disponibilidade" className="min-w-0">
        <div
          role="tablist"
          aria-label="Categorias de disponibilidade"
          className="mb-5 flex gap-1 overflow-x-auto border-b border-border"
        >
          {TABS.map((tab) => {
            const isActive = activeCategory === tab.id
            return (
              <button
                key={tab.id}
                id={`availability-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="availability-panel"
                onClick={() => setActiveCategory(tab.id)}
                className={`relative inline-flex shrink-0 items-center gap-2.5 px-3 pb-3 pt-2 text-sm font-semibold transition-colors sm:px-4 ${
                  isActive ? 'text-primary' : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
                <span
                  className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    isActive ? 'bg-secondary text-primary' : 'bg-[#ecefeb] text-text-muted'
                  }`}
                >
                  {records[tab.id].length}
                </span>
                {isActive ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary sm:inset-x-4" />
                ) : null}
              </button>
            )
          })}
        </div>

        <div
          id="availability-panel"
          role="tabpanel"
          aria-labelledby={`availability-tab-${activeCategory}`}
          className="overflow-hidden rounded-2xl border border-border bg-white shadow-(--shadow-soft)"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-170 border-collapse text-left">
              <thead className="bg-[#f8f9f7]">
                <tr className="border-b border-border">
                  <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Profissional
                  </th>
                  <th scope="col" className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Regra
                  </th>
                  <th scope="col" className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Período
                  </th>
                  <th scope="col" className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeRecords.map((record) => {
                  const initials = record.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')
                    .toLocaleUpperCase('pt-BR')

                  return (
                    <tr key={record.id} className="transition-colors hover:bg-[#fbfcfa]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e4efe2] text-xs font-bold text-primary"
                          >
                            {initials}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-text">
                              {record.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-text-muted">{record.role}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-text">{record.rule}</td>
                      <td className="px-5 py-4 text-sm text-text-muted">{record.period}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-text">
                          <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                          Ativo
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditForm(record)}
                          className="rounded-lg px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-secondary/70"
                          aria-label={`Editar registro de ${record.name}`}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {activeRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-sm font-semibold text-text">Nenhum registro nesta categoria</p>
                      <p className="mt-1 text-sm text-text-muted">
                        Adicione um registro para começar.
                      </p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="mt-5 flex items-start gap-3 rounded-2xl border border-[#dcebd9] bg-[#edf5eb] px-5 py-4 sm:items-center sm:px-6">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#dcebd8] text-primary sm:mt-0">
            <Check className="size-4" strokeWidth={2.5} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#285f34]">Usado na geração automática</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#53705a]">
              Essas regras são consideradas ao criar o rascunho da escala.
            </p>
          </div>
        </aside>
      </section>

      {isFormOpen ? (
        <AvailabilityFormModal
          category={activeCategory}
          record={editingRecord ?? undefined}
          professionals={professionals}
          onClose={closeForm}
          onSave={saveRecord}
        />
      ) : null}
      <Toast message={toast} />
    </div>
  )
}