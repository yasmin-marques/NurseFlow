import { canEditScale, groupShiftsByDateAndTurn } from './review'
import type { ScaleDetail, ScheduledShift, ScaleShift } from '../../services/scales'

interface ScaleReviewProps {
  scale: ScaleDetail
  onEdit: (shift: ScheduledShift) => void
}

function shiftLabel(shift: ScheduledShift) {
  if (shift.duracaoHoras === 24) return '24h · cobre os turnos diurno e noturno'
  return shift.horarioInicio === '07:00' ? '12h diurno' : '12h noturno'
}

function turnLabel(turn: ScaleShift) {
  return turn === 'diurno' ? 'Diurno · 07h–19h' : 'Noturno · 19h–07h'
}

export function ScaleReview({ scale, onEdit }: ScaleReviewProps) {
  const groups = groupShiftsByDateAndTurn(scale.plantoes)
  const editable = canEditScale(scale.escala.status)

  return (
    <section aria-label="Revisão por data e turno" className="rounded-2xl border border-border bg-white shadow-(--shadow-soft)">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-bold text-text">Revisão por data e turno</h3>
        <p className="mt-1 text-xs text-text-muted">Confira a equipe e edite plantões antes de validar ou publicar.</p>
      </div>
      {groups.length === 0 ? (
        <p className="px-5 py-4 text-sm text-text-muted">Não há plantões para revisar neste período.</p>
      ) : (
        <div className="divide-y divide-border">
          {groups.map((group) => (
            <details key={group.date} className="group">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-text hover:bg-page">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>{new Date(`${group.date}T12:00:00`).toLocaleDateString('pt-BR', { dateStyle: 'full' })}</span>
                  <span className="rounded-full bg-page px-2.5 py-1 text-xs text-text-muted">
                    {group.total} plantão(ões)
                  </span>
                </span>
              </summary>
              <div className="grid gap-4 border-t border-border bg-page/50 p-4 lg:grid-cols-2">
                {(['diurno', 'noturno'] as const).map((turn) => {
                  const shifts = group[turn]
                  const vacancies = scale.pendencias.filter((vacancy) => vacancy.data === group.date && vacancy.turno === turn)
                  return (
                    <section key={turn} aria-label={`${turnLabel(turn)} em ${group.date}`} className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-text-muted">{turnLabel(turn)}</h4>
                      {shifts.length === 0 ? <p className="text-xs text-text-muted">Nenhum plantão neste turno.</p> : null}
                      {shifts.map((shift) => (
                        <article key={`${turn}-${shift.id}`} className="rounded-xl border border-border bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h5 className="text-sm font-bold text-text">{shift.setor.nome}</h5>
                              <p className="mt-1 text-xs text-text-muted">
                                {shift.horarioInicio}–{shift.horarioFim} · {shiftLabel(shift)} · {shift.tipo === 'extra' ? 'Extra' : 'Regular'}
                              </p>
                            </div>
                            {editable ? (
                              <button
                                type="button"
                                onClick={() => onEdit(shift)}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-soft-green"
                              >
                                Editar plantão
                              </button>
                            ) : null}
                          </div>
                          {shift.profissionais.length === 0 ? (
                            <p className="mt-3 text-xs text-warning-text">Equipe não informada.</p>
                          ) : (
                            <ul className="mt-3 space-y-1">
                              {shift.profissionais.map((person) => (
                                <li key={person.id} className="text-xs text-text">
                                  <span className="font-semibold">{person.formacao === 'enfermeiro' ? 'Enfermeiro' : 'Técnico'}:</span> {person.nome}
                                </li>
                              ))}
                            </ul>
                          )}
                        </article>
                      ))}
                      {vacancies.length > 0 ? (
                        <ul aria-label="Pendências do turno" className="space-y-1">
                          {vacancies.map((vacancy, index) => (
                            <li key={`${vacancy.setorId}-${vacancy.funcao}-${index}`} className="rounded-lg border border-warning bg-warning px-3 py-2 text-xs text-warning-text">
                              {vacancy.setor}: {vacancy.funcao} {vacancy.alocado}/{vacancy.necessario}; faltam {vacancy.faltam}.
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  )
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
