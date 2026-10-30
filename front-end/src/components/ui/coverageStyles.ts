export type CoverageState = 'covered' | 'restricted' | 'partial' | 'conflict' | 'empty'

const COVERAGE_SURFACES: Record<CoverageState, string> = {
  covered: 'border-primary/30 bg-white',
  restricted: 'border-warning bg-warning',
  partial: 'border-warning bg-warning',
  conflict: 'border-error bg-error',
  empty: 'border-border bg-white',
}

const COVERAGE_BADGES: Record<CoverageState, string> = {
  covered: 'bg-highlight text-primary',
  restricted: 'bg-warning text-warning-text',
  partial: 'bg-warning text-warning-text',
  conflict: 'bg-error text-danger',
  empty: 'bg-neutral text-text-muted',
}

export function coverageSurfaceClass(state: CoverageState) {
  return COVERAGE_SURFACES[state]
}

export function coverageBadgeClass(state: CoverageState) {
  return COVERAGE_BADGES[state]
}
