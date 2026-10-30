import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
} from './types'
import { currentPeriod, fetchSettings, saveSettings, type SettingsPeriod } from '../../services/settings'

function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

export function normalizeSettings(value: Partial<AppSettings> | null): AppSettings {
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
    concursadoShift24h: clampNonNegativeInteger(
      value?.concursadoShift24h ?? DEFAULT_SETTINGS.concursadoShift24h,
    ),
    concursadoShift12h: clampNonNegativeInteger(
      value?.concursadoShift12h ?? DEFAULT_SETTINGS.concursadoShift12h,
    ),
    cltShift24h: clampNonNegativeInteger(
      value?.cltShift24h ?? DEFAULT_SETTINGS.cltShift24h,
    ),
    cltShift12h: clampNonNegativeInteger(
      value?.cltShift12h ?? DEFAULT_SETTINGS.cltShift12h,
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
  const [period, setPeriod] = useState<SettingsPeriod>(currentPeriod)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Limites e cargas mensais vêm do MongoDB; os demais ajustes ficam neste navegador.
  useEffect(() => {
    let active = true
    fetchSettings(period)
      .then((remote) => {
        if (!active) return
        const next = normalizeSettings({ ...readStoredSettings(), ...remote })
        setSaved(next)
        setDraft(next)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar as configurações.')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [period, reloadKey])

  const reload = useCallback(() => {
    setIsLoading(true)
    setLoadError(null)
    setReloadKey((key) => key + 1)
  }, [])

  const changePeriod = useCallback((next: SettingsPeriod) => {
    setIsLoading(true)
    setLoadError(null)
    setPeriod(next)
  }, [])

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
    try {
      const remote = await saveSettings(next, period)
      const confirmed = normalizeSettings({ ...next, ...remote })
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(confirmed))
      } catch {
        // Armazenamento local indisponível: os limites já estão salvos no servidor.
      }
      setSaved(confirmed)
      setDraft(confirmed)
      setToast('Configurações salvas com sucesso')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Não foi possível salvar as configurações')
    } finally {
      setIsSaving(false)
    }
  }, [draft, period])

  return {
    draft,
    isDirty,
    isLoading,
    loadError,
    isSaving,
    toast,
    period,
    setPeriod: changePeriod,
    update,
    discard,
    save,
    reload,
  }
}
