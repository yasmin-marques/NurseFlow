import { describe, expect, it } from 'vitest'
import { getScaleWorkflow } from './workflow'

const stepStates = (status: Parameters<typeof getScaleWorkflow>[0], changesSaved = false) =>
  getScaleWorkflow(status, changesSaved).steps.map(({ complete, current }) => ({ complete, current }))

describe('scale workflow presentation', () => {
  it('starts on generation when there is no scale or only a draft', () => {
    expect(getScaleWorkflow(null, false).badge).toBe('AGUARDANDO GERAÇÃO')
    expect(getScaleWorkflow('rascunho', false).badge).toBe('RASCUNHO')
    expect(stepStates(null)).toEqual([
      { complete: false, current: true },
      { complete: false, current: false },
      { complete: false, current: false },
      { complete: false, current: false },
    ])
    expect(stepStates('rascunho')).toEqual(stepStates(null))
  })

  it('marks generation complete and review active while a scale is in review', () => {
    expect(getScaleWorkflow('em_revisao', false).badge).toBe('EM REVISÃO')
    expect(stepStates('em_revisao')).toEqual([
      { complete: true, current: false },
      { complete: false, current: true },
      { complete: false, current: false },
      { complete: false, current: false },
    ])
  })

  it('shows saved changes at conflict validation only after a successful save', () => {
    expect(getScaleWorkflow('em_revisao', true).badge).toBe('ALTERAÇÕES SALVAS')
    expect(stepStates('em_revisao', true)).toEqual([
      { complete: true, current: false },
      { complete: true, current: false },
      { complete: false, current: true },
      { complete: false, current: false },
    ])
  })

  it('keeps the validation step active until publication', () => {
    expect(getScaleWorkflow('validada', false).badge).toBe('ALTERAÇÕES SALVAS')
    expect(stepStates('validada')).toEqual([
      { complete: true, current: false },
      { complete: true, current: false },
      { complete: false, current: true },
      { complete: false, current: false },
    ])
  })

  it('completes every step after publication', () => {
    expect(getScaleWorkflow('publicada', false).badge).toBe('PUBLICADA')
    expect(stepStates('publicada')).toEqual([
      { complete: true, current: false },
      { complete: true, current: false },
      { complete: true, current: false },
      { complete: true, current: false },
    ])
    expect(getScaleWorkflow('finalizada', false).badge).toBe('PUBLICADA')
  })
})
