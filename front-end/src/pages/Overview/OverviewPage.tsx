export function OverviewPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-12">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          NurseFlow
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-text sm:text-4xl">
          Visão geral
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
          Bem-vindo ao espaço de gestão de escalas. Escolha uma área no menu lateral para começar.
        </p>
      </header>

      <section className="grid flex-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-3xl border border-border bg-white p-7 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold text-text">Escalas e cobertura</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Acesse as áreas de escala, disponibilidade e extras pelo menu principal.
          </p>
        </article>
        <article className="rounded-3xl border border-border bg-white p-7 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold text-text">Equipe</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Consulte as opções de profissionais e setores disponíveis na navegação.
          </p>
        </article>
        <article className="rounded-3xl border border-border bg-white p-7 shadow-[var(--shadow-soft)] md:col-span-2 xl:col-span-1">
          <h3 className="text-lg font-semibold text-text">Configurações</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            As regras de trocas, plantões e notificações ficam disponíveis no item Configurações do
            menu lateral.
          </p>
        </article>
      </section>
    </div>
  )
}
