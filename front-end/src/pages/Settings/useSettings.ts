import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
} from './types'

function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function normalizeSettings(value: Partial<AppSettings> | null): AppSettings {
  return {
    swapLimitPerProfessional: clampNonNegativeInteger(
      value?.swapLimitPerProfessional ?? DEFAULT_SETTINGS.swapLimitPerProfessional,
    ),
    requireCoordinatorApproval:
      value?.requireCoordinatorApproval ?? DEFAULT_SETTINGS.requireCoordinatorApproval,
    concursadoExtraLimit: clampNonNegativeInteger(
      value?.concursadoExtraLimit ?? DEFAULT_SETTINGS.concursadoExtraLimit,
    ),
    cltExtraLimit: clampNonNegativeInteger(
      value?.cltExtraLimit ?? DEFAULT_SETTINGS.cltExtraLimit,
    ),
    generateExtrasForAbsences:
      value?.generateExtrasForAbsences ?? DEFAULT_SETTINGS.generateExtrasForAbsences,
    countCoverageTowardExtraLimit:
      value?.countCoverageTowardExtraLimit ?? DEFAULT_SETTINGS.countCoverageTowardExtraLimit,
    notifyOnPublication: value?.notifyOnPublication ?? DEFAULT_SETTINGS.notifyOnPublication,
  }
}

function readStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>)
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSettings() {
  const [saved, setSaved] = useState<AppSettings>(readStoredSettings)
  const [draft, setDraft] = useState<AppSettings>(saved)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const isDirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [draft, saved])

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((current) => ({
      ...current,
      [key]: typeof value === 'number' ? clampNonNegativeInteger(value) : value,
    }))
  }, [])

  const discard = useCallback(() => {
    setDraft(saved)
  }, [saved])

  const save = useCallback(async () => {
    const next = normalizeSettings(draft)
    setIsSaving(true)
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
    setSaved(next)
    setDraft(next)
    setIsSaving(false)
    setToast('Configurações salvas com sucesso')
  }, [draft])

  return {
    draft,
    isDirty,
    isSaving,
    toast,
    update,
    discard,
    save,
  }
}
