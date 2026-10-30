import { ArrowLeftRight, CalendarDays, Clock } from '../../components/icons'
import { NumberStepper } from '../../components/ui/NumberStepper'
import { Toast } from '../../components/ui/Toast'
import { ToggleSwitch } from '../../components/ui/ToggleSwitch'
import { ActionButtons } from './components/ActionButtons'
import { EmploymentTypeCard } from './components/EmploymentTypeCard'
import { SettingRow } from './components/SettingRow'
import { SettingsCard } from './components/SettingsCard'
import { useSettings } from './useSettings'

type SettingsPageProps = {
  searchQuery?: string
}

export function SettingsPage({ searchQuery = '' }: SettingsPageProps) {
  const { draft, isDirty, isLoading, loadError, isSaving, toast, period, setPeriod, update, discard, save, reload } = useSettings()
  const periodValue = `${String(period.year).padStart(4, '0')}-${String(period.month).padStart(2, '0')}`
  const query = searchQuery.trim().toLocaleLowerCase('pt-BR')
  const matches = (...values: string[]) =>
    !query || values.some((value) => value.toLocaleLowerCase('pt-BR').includes(query))

  const showSwapLimit = matches('Trocas Limites e fluxo de aprovação') ||
    matches('Limite por profissional', 'Quantidade máxima de trocas no período')
  const showCoordinatorApproval = matches('Trocas Limites e fluxo de aprovação') ||
    matches('Aprovação da coordenação', 'Toda troca aceita pelo colega passa por validação')
  const showSwapSettings = showSwapLimit || showCoordinatorApproval

  const showWorkloadSection = matches(
    'Carga e limites de plantões Parâmetros mensais por tipo de vínculo',
  )
  const showConcursado = showWorkloadSection ||
    matches('Concursado Carga fixa 6 plantões de 24h + 1 de 12h 7 alocações 156 horas regulares')
  const showClt = showWorkloadSection ||
    matches('CLT Carga fixa 8 plantões de 24h 8 cargas para meses de 30 ou 31 dias')
  const showRpa = showWorkloadSection ||
    matches('RPA Cobertura Sem carga regular fixa Alocação conforme cobertura programada Sem limite')
  const showAbsenceExtras = showWorkloadSection ||
    matches('Gerar extras para férias e ausências', 'Cria automaticamente sugestões de cobertura para manter o quantitativo')
  const showCoverageLimit = showWorkloadSection ||
    matches('Contabilizar coberturas no limite de extras', 'Ao exceder o limite, a Coordenação recebe um alerta e pode registrar exceção')
  const showWorkloadSettings =
    showConcursado || showClt || showRpa || showAbsenceExtras || showCoverageLimit

  const showPublicationNotification = matches(
    'Notificações Notificações após publicação de escala',
  ) || matches('Notificar ao publicar', 'Envia aviso para todos os profissionais')
  const showAnySettings =
    showSwapSettings || showWorkloadSettings || showPublicationNotification

  return (
    <div className="flex min-h-full w-full flex-col px-5 py-6 sm:px-7 lg:px-10 xl:px-12">
      <header className="mb-6">
        <h2 className="text-[28px] font-bold leading-none tracking-[-0.04em] text-text">Configurações</h2>
        <p className="mt-2.5 text-[14px] text-text-muted">
          Regras usadas na montagem e gestão das escalas.
        </p>
      </header>

      <section className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-white p-5 shadow-(--shadow-soft)">
        <div>
          <label htmlFor="settings-period" className="text-sm font-bold text-text">Período das regras mensais</label>
          <p className="mt-1 text-xs text-text-muted">Selecione qualquer mês entre 0001 e 9999 para consultar e configurar seus limites.</p>
        </div>
        <input
          id="settings-period"
          type="month"
          min="0001-01"
          max="9999-12"
          value={periodValue}
          disabled={isDirty || isSaving || isLoading}
          onChange={(event) => {
            const match = /^(\d{4})-(\d{2})$/.exec(event.target.value)
            if (match) setPeriod({ year: Number(match[1]), month: Number(match[2]) })
          }}
          className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-60"
        />
        {isDirty ? <p className="w-full text-xs text-text-muted">Salve ou descarte as alterações antes de trocar o período.</p> : null}
      </section>

      {isLoading ? <p role="status" className="mb-4 text-sm text-text-muted">Carregando configurações...</p> : null}
      {loadError ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>Falha ao carregar as configurações: {loadError}</span>
          <button type="button" onClick={() => { void reload() }} className="font-semibold underline">
            Tentar novamente
          </button>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-5 xl:grid xl:grid-rows-[0.9fr_1.8fr_0.9fr]">
        {showSwapSettings ? (
          <SettingsCard icon={ArrowLeftRight} title="Trocas" subtitle="Limites e fluxo de aprovação">
            {showSwapLimit ? (
              <SettingRow
                title="Limite por profissional"
                description="Quantidade máxima de trocas no período"
              >
                <NumberStepper
                  label="Limite por profissional"
                  value={draft.swapLimitPerProfessional}
                  onChange={(value) => update('swapLimitPerProfessional', value)}
                />
              </SettingRow>
            ) : null}
            {showCoordinatorApproval ? (
              <SettingRow
                title="Aprovação da coordenação"
                description="Toda troca aceita pelo colega passa por validação"
              >
                <ToggleSwitch
                  label="Aprovação da coordenação"
                  checked={draft.requireCoordinatorApproval}
                  onChange={(checked) => update('requireCoordinatorApproval', checked)}
                />
              </SettingRow>
            ) : null}
          </SettingsCard>
        ) : null}

        {showWorkloadSettings ? <SettingsCard
          icon={Clock}
          title="Carga e limites de plantões"
          subtitle="Parâmetros mensais por tipo de vínculo"
        >
          <div className="grid grid-cols-1 gap-5 bg-[#f7f8f6] p-6 md:grid-cols-2 xl:grid-cols-3">
            {showConcursado ? <EmploymentTypeCard
              title="Concursado"
              badge="CARGA CONFIGURÁVEL"
              headline={`${draft.concursadoShift24h} plantões de 24h + ${draft.concursadoShift12h} de 12h`}
              detail={`${draft.concursadoShift24h + draft.concursadoShift12h} alocações · ${draft.concursadoShift24h * 24 + draft.concursadoShift12h * 12} horas regulares`}
            >
              <div className="space-y-4">
                <SettingRow title="Plantões regulares de 24h" description="Carga mensal para concursados">
                  <NumberStepper
                    label="Plantões regulares de 24h para concursado"
                    value={draft.concursadoShift24h}
                    onChange={(value) => update('concursadoShift24h', value)}
                  />
                </SettingRow>
                <SettingRow title="Plantões regulares de 12h" description="Carga mensal para concursados">
                  <NumberStepper
                    label="Plantões regulares de 12h para concursado"
                    value={draft.concursadoShift12h}
                    onChange={(value) => update('concursadoShift12h', value)}
                  />
                </SettingRow>
                <div className="flex items-end justify-between gap-4 border-t border-border pt-4">
                  <div>
                    <p className="text-[13px] font-semibold text-text">Máximo de extras</p>
                    <p className="text-[12px] text-text-muted">Por profissional no mês</p>
                  </div>
                  <NumberStepper
                    label="Máximo de extras para concursado"
                    value={draft.concursadoExtraLimit}
                    onChange={(value) => update('concursadoExtraLimit', value)}
                  />
                </div>
              </div>
            </EmploymentTypeCard> : null}

            {showClt ? <EmploymentTypeCard
              title="CLT"
              badge="CARGA CONFIGURÁVEL"
              headline={`${draft.cltShift24h} plantões de 24h + ${draft.cltShift12h} de 12h`}
              detail={`${draft.cltShift24h + draft.cltShift12h} alocações · ${draft.cltShift24h * 24 + draft.cltShift12h * 12} horas regulares`}
            >
              <div className="space-y-4">
                <SettingRow title="Plantões regulares de 24h" description="Carga mensal para CLT">
                  <NumberStepper
                    label="Plantões regulares de 24h para CLT"
                    value={draft.cltShift24h}
                    onChange={(value) => update('cltShift24h', value)}
                  />
                </SettingRow>
                <SettingRow title="Plantões regulares de 12h" description="Carga mensal para CLT">
                  <NumberStepper
                    label="Plantões regulares de 12h para CLT"
                    value={draft.cltShift12h}
                    onChange={(value) => update('cltShift12h', value)}
                  />
                </SettingRow>
                <div className="flex items-end justify-between gap-4 border-t border-border pt-4">
                  <div>
                    <p className="text-[13px] font-semibold text-text">Máximo de extras</p>
                    <p className="text-[12px] text-text-muted">Por profissional no mês</p>
                  </div>
                  <NumberStepper
                    label="Máximo de extras para CLT"
                    value={draft.cltExtraLimit}
                    onChange={(value) => update('cltExtraLimit', value)}
                  />
                </div>
              </div>
            </EmploymentTypeCard> : null}

            {showRpa ? <EmploymentTypeCard
              title="RPA"
              badge="COBERTURA"
              headline="Sem carga regular fixa"
              detail="Alocação conforme cobertura programada"
            >
              <span className="inline-flex rounded-lg bg-badge-blue px-3 py-1.5 text-[11px] font-bold tracking-[0.04em] text-badge-blue-text">
                SEM LIMITE
              </span>
            </EmploymentTypeCard> : null}
          </div>

          {showAbsenceExtras ? <SettingRow
            title="Gerar extras para férias e ausências"
            description="Cria automaticamente sugestões de cobertura para manter o quantitativo"
          >
            <ToggleSwitch
              label="Gerar extras para férias e ausências"
              checked={draft.generateExtrasForAbsences}
              onChange={(checked) => update('generateExtrasForAbsences', checked)}
            />
          </SettingRow> : null}
          {showCoverageLimit ? <SettingRow
            title="Contabilizar coberturas no limite de extras"
            description="Ao exceder o limite, a Coordenação recebe um alerta e pode registrar exceção"
          >
            <ToggleSwitch
              label="Contabilizar coberturas no limite de extras"
              checked={draft.countCoverageTowardExtraLimit}
              onChange={(checked) => update('countCoverageTowardExtraLimit', checked)}
            />
          </SettingRow> : null}
        </SettingsCard> : null}

        {showPublicationNotification ? <SettingsCard
          icon={CalendarDays}
          title="Notificações"
          subtitle="Notificações após publicação de escala"
        >
          <SettingRow
            title="Notificar ao publicar"
            description="Envia aviso para todos os profissionais"
          >
            <ToggleSwitch
              label="Notificar ao publicar"
              checked={draft.notifyOnPublication}
              onChange={(checked) => update('notifyOnPublication', checked)}
            />
          </SettingRow>
        </SettingsCard> : null}
      </div>

      {!showAnySettings ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-white/70 px-6 py-10 text-center">
          <p className="text-base font-semibold text-text">Nenhuma configuração encontrada</p>
          <p className="mt-1.5 text-sm text-text-muted">
            Tente outro termo de pesquisa.
          </p>
        </div>
      ) : null}

      <ActionButtons isDirty={isDirty} isSaving={isSaving} disabled={isLoading || loadError !== null} onDiscard={discard} onSave={save} />
      <Toast message={toast} />
    </div>
  )
}
