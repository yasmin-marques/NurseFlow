export type AppSettings = {
  swapLimitPerProfessional: number
  requireCoordinatorApproval: boolean
  concursadoExtraLimit: number
  cltExtraLimit: number
  concursadoShift24h: number
  concursadoShift12h: number
  cltShift24h: number
  cltShift12h: number
  generateExtrasForAbsences: boolean
  countCoverageTowardExtraLimit: boolean
  notifyOnPublication: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  swapLimitPerProfessional: 2,
  requireCoordinatorApproval: true,
  concursadoExtraLimit: 2,
  cltExtraLimit: 2,
  concursadoShift24h: 6,
  concursadoShift12h: 1,
  cltShift24h: 5,
  cltShift12h: 2,
  generateExtrasForAbsences: true,
  countCoverageTowardExtraLimit: true,
  notifyOnPublication: true,
}

export const SETTINGS_STORAGE_KEY = 'nurseflow.settings'
