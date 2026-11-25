export type AccentCardTone = 'primary' | 'warning' | 'neutral'

export function accentCardClass(tone: AccentCardTone = 'primary', radiusClass = 'rounded-xl') {
  const tones = {
    primary: 'border-l-4 border-l-primary',
    warning: 'border-l-4 border-l-warning',
    neutral: 'border-l-4 border-l-border',
  } as const

  return `box-border ${radiusClass} border border-border bg-white ${tones[tone]}`
}
