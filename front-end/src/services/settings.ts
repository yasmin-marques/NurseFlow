import { api } from './api'
import type { AppSettings } from '../pages/Settings/types'

type ConfigurationApi = {
  limiteTrocas: number
  maxExtrasConcursado?: number
  maxExtrasClt?: number
  cargas?: Record<string, { plantoes24h: number; plantoes12h: number }>
}

/** Parte das configurações que o backend persiste por ano e mês. */
export type RemoteSettings = Pick<
  AppSettings,
  | 'swapLimitPerProfessional'
  | 'concursadoExtraLimit'
  | 'cltExtraLimit'
  | 'concursadoShift24h'
  | 'concursadoShift12h'
  | 'cltShift24h'
  | 'cltShift12h'
>

export type SettingsPeriod = { year: number; month: number }

export const currentPeriod = (date = new Date()): SettingsPeriod => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
})

const query = ({ year, month }: SettingsPeriod) =>
  `?ano=${String(year).padStart(4, '0')}&mes=${String(month).padStart(2, '0')}`

function daysInPeriod({ year, month }: SettingsPeriod) {
  const date = new Date(0)
  date.setUTCFullYear(year, month, 0)
  return date.getUTCDate()
}

const fromApi = (data: ConfigurationApi, period: SettingsPeriod): RemoteSettings => {
  const days = daysInPeriod(period)
  return {
    swapLimitPerProfessional: data.limiteTrocas,
    concursadoExtraLimit: data.maxExtrasConcursado ?? 0,
    cltExtraLimit: data.maxExtrasClt ?? 0,
    concursadoShift24h: data.cargas?.[`concursado_${days}`]?.plantoes24h ?? 0,
    concursadoShift12h: data.cargas?.[`concursado_${days}`]?.plantoes12h ?? 0,
    cltShift24h: data.cargas?.[`clt_${days}`]?.plantoes24h ?? 0,
    cltShift12h: data.cargas?.[`clt_${days}`]?.plantoes12h ?? 0,
  }
}

export async function fetchSettings(period = currentPeriod()): Promise<RemoteSettings> {
  return fromApi(await api<ConfigurationApi>(`/configuracoes${query(period)}`), period)
}

export async function saveSettings(
  settings: RemoteSettings,
  period = currentPeriod(),
): Promise<RemoteSettings> {
  const diasMes = daysInPeriod(period)
  const data = await api<ConfigurationApi>(`/configuracoes/limites${query(period)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      limiteTrocas: settings.swapLimitPerProfessional,
      maxExtrasConcursado: settings.concursadoExtraLimit,
      maxExtrasClt: settings.cltExtraLimit,
      cargas: [
        {
          vinculo: 'concursado',
          diasMes,
          plantoes24h: settings.concursadoShift24h,
          plantoes12h: settings.concursadoShift12h,
        },
        {
          vinculo: 'clt',
          diasMes,
          plantoes24h: settings.cltShift24h,
          plantoes12h: settings.cltShift12h,
        },
      ],
    }),
  })
  return fromApi(data, period)
}
