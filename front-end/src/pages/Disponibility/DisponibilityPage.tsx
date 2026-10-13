import { useCallback, useEffect, useState } from 'react'
import { Plus } from '../../components/icons'
import { Toast } from '../../components/ui/Toast'
import { createRestriction, deleteRestriction, fetchAllRestrictions, type ListedRecord, type ProfessionalStatus } from '../../services/restriction'
import {
  AvailabilityFormModal,
  type AvailabilityCategory,
  type AvailabilityRecord,
} from './components/AvailabilityFormModal'

const INITIAL_RECORDS: Record<AvailabilityCategory, ListedRecord[]> = {
  restrictions: [], externalLinks: [], absences: [],
}

const STATUS_LABELS: Record<ProfessionalStatus, string> = {
  ativo: 'Ativo',
  desativado: 'Desativado',
  afastado: 'Afastado',
  ferias: 'Férias',
}

const TABS: { id: AvailabilityCategory; label: string }[] = [
  { id: 'restrictions', label: 'Restrições' },
  { id: 'externalLinks', label: 'Vínculos externos' },
  { id: 'absences', label: 'Férias e ausências' },
]

export function DisponibilityPage() {
  const [records, setRecords] = useState(INITIAL_RECORDS)
  const [professionals, setProfessionals] = useState<{id:string;name:string}[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Consulta a API: nunca usa uma lista fictícia para determinar o status.
  const reload = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const result = await fetchAllRestrictions()
      setRecords(result.records)
      setProfessionals(result.professionals)
      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a disponibilidade.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    // Ao voltar à janela, atualiza o status alterado em Profissionais.
    const onFocus = () => { void reload() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  const [activeCategory, setActiveCategory] = useState<AvailabilityCategory>('restrictions')
  const [editingRecord, setEditingRecord] = useState<AvailabilityRecord | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const activeRecords = records[activeCategory]


  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const openCreateForm = () => {
    setEditingRecord(null)
    setIsFormOpen(true)
  }

  const closeForm = () => { setEditingRecord(null); setIsFormOpen(false) }

  const saveRecord = async (record: AvailabilityRecord) => {
    try {
      await createRestriction(record, professionals)
      const refreshed = await reload()
      setActiveCategory(record.category)
      setToast(refreshed ? 'Registro salvo no servidor' : 'Registro salvo; falha ao atualizar a lista')
      closeForm()
    } catch (e) { setToast(e instanceof Error ? e.message : 'Falha ao salvar') }
  }

  const removeRecord = async (record: ListedRecord) => {
    if (!window.confirm(`Excluir restrição de ${record.name}?`)) return
    try {
      await deleteRestriction(record.professionalId, record.id)
      const refreshed = await reload()
      setToast(refreshed ? 'Registro excluído' : 'Registro excluído; falha ao atualizar a lista')
    }
    catch (e) { setToast(e instanceof Error ? e.message : 'Falha ao excluir') }
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
          disabled={loading || professionals.length === 0}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(46,120,61,0.2)] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" strokeWidth={2.4} />
          Adicionar registro
        </button>
      </header>

      {loading && <p role="status" className="mb-4 text-sm text-text-muted">Carregando registros...</p>}
      {error && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>Falha ao carregar os dados: {error}</span>
          <button type="button" onClick={() => { void reload() }} className="font-semibold underline">
            Tentar novamente
          </button>
        </div>
      )}
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
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeRecords.map((record) => {
                  const isActive = record.professionalStatus === 'ativo'
                  const statusLabel = STATUS_LABELS[record.professionalStatus]
                  const initials = record.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part: string) => part.charAt(0))
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
                          <span className={`size-2 rounded-full ${isActive ? 'bg-success' : 'bg-gray-400'}`} aria-hidden="true" />
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeRecord(record)}
                          className="rounded-lg px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-secondary/70"
                          aria-label={`Excluir registro de ${record.name}`}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!loading && !error && activeRecords.length === 0 ? (
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
      </section>

      {isFormOpen ? (
        <AvailabilityFormModal
          category={activeCategory}
          record={editingRecord ?? undefined}
          professionals={professionals.map(p => p.name)}
          onClose={closeForm}
          onSave={saveRecord}
        />
      ) : null}
      <Toast message={toast} />
    </div>
  )
}