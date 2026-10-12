import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
} from './types'
import { fetchSettings, saveSettings } from '../../services/settings'

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
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Limites de trocas e de extras vêm do MongoDB; os demais ajustes ficam neste navegador.
  const load = useCallback(() => {
    return fetchSettings()
      .then((remote) => {
        const next = normalizeSettings({ ...readStoredSettings(), ...remote })
        setSaved(next)
        setDraft(next)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar as configurações.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reload = useCallback(() => {
    setIsLoading(true)
    return load()
  }, [load])

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
      const remote = await saveSettings(next)
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
  }, [draft])

  return {
    draft,
    isDirty,
    isLoading,
    loadError,
    isSaving,
    toast,
    update,
    discard,
    save,
    reload,
  }
}
