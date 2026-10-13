import { api } from './api'
import type { AppSettings } from '../pages/Settings/types'

type ConfigurationApi = {
  limiteTrocas: number
  maxExtrasConcursado?: number
  maxExtrasClt?: number
}

/** Parte das configurações que o backend persiste (por mês). */
export type RemoteSettings = Pick<
  AppSettings,
  'swapLimitPerProfessional' | 'concursadoExtraLimit' | 'cltExtraLimit'
>

export type SettingsPeriod = { year: number; month: number }

export const currentPeriod = (date = new Date()): SettingsPeriod => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
})

const query = ({ year, month }: SettingsPeriod) => `?ano=${year}&mes=${month}`

const fromApi = (data: ConfigurationApi): RemoteSettings => ({
  swapLimitPerProfessional: data.limiteTrocas,
  concursadoExtraLimit: data.maxExtrasConcursado ?? 0,
  cltExtraLimit: data.maxExtrasClt ?? 0,
})

export async function fetchSettings(period = currentPeriod()): Promise<RemoteSettings> {
  return fromApi(await api<ConfigurationApi>(`/configuracoes${query(period)}`))
}

export async function saveSettings(
  settings: RemoteSettings,
  period = currentPeriod(),
): Promise<RemoteSettings> {
  return fromApi(
    await api<ConfigurationApi>(`/configuracoes/limites${query(period)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        limiteTrocas: settings.swapLimitPerProfessional,
        maxExtrasConcursado: settings.concursadoExtraLimit,
        maxExtrasClt: settings.cltExtraLimit,
      }),
    }),
  )
}
