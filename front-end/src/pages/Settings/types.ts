export type AppSettings = {
  swapLimitPerProfessional: number
  requireCoordinatorApproval: boolean
  concursadoExtraLimit: number
  cltExtraLimit: number
  generateExtrasForAbsences: boolean
  countCoverageTowardExtraLimit: boolean
  notifyOnPublication: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  swapLimitPerProfessional: 2,
  requireCoordinatorApproval: true,
  concursadoExtraLimit: 2,
  cltExtraLimit: 2,
  generateExtrasForAbsences: true,
  countCoverageTowardExtraLimit: true,
  notifyOnPublication: true,
}

export const SETTINGS_STORAGE_KEY = 'nurseflow.settings'
