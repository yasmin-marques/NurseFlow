import { useState } from 'react'
import { Drawer } from '../../components/ui/Drawer'

interface ExportScaleDrawerProps {
  monthLabel: string
  exporting: boolean
  error: string
  onClose: () => void
  onExport: (scope: 'general' | 'sector') => void
}

export function ExportScaleDrawer({ monthLabel, exporting, error, onClose, onExport }: ExportScaleDrawerProps) {
  const [month = monthLabel] = monthLabel.split(' de ')
  const [scope, setScope] = useState<'general' | 'sector'>('general')
  return <Drawer id="export-scale" title="Exportar PDF" description="Prepare o documento para assinatura" onClose={onClose} closeDisabled={exporting}
    footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={exporting} onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-neutral">Cancelar</button><button type="button" disabled={exporting} onClick={() => onExport(scope)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{exporting ? 'Gerando PDF...' : 'Gerar PDF'}</button></div>}>
    <div className="space-y-5">
      <fieldset className="space-y-3"><legend className="mb-2 text-sm font-bold text-text">Escopo do documento</legend>
        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${scope === 'general' ? 'border-primary bg-soft-green' : 'border-border'}`}><input type="radio" name="pdf-scope" checked={scope === 'general'} onChange={() => setScope('general')} className="mt-1 accent-primary" /><span><strong className="block text-sm text-text">Escala geral de {month.toLocaleLowerCase('pt-BR')}</strong><span className="mt-1 block text-xs text-text-muted">Todos os setores e turnos.</span></span></label>
        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${scope === 'sector' ? 'border-primary bg-soft-green' : 'border-border'}`}><input type="radio" name="pdf-scope" checked={scope === 'sector'} onChange={() => setScope('sector')} className="mt-1 accent-primary" /><span><strong className="block text-sm text-text">Por setor</strong><span className="mt-1 block text-xs text-text-muted">Gerar um arquivo para cada setor.</span></span></label>
      </fieldset>
      <p className="rounded-xl bg-highlight p-4 text-sm text-primary">✓ &nbsp;Inclui campos para assinatura da Coordenação e Diretoria</p>
      {error ? <p role="alert" className="rounded-xl border border-error bg-error p-3 text-sm text-danger">{error}</p> : null}
    </div>
  </Drawer>
}
