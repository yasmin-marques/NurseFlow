/**
 * Classes compartilhadas do módulo de setores. Reproduzem os padrões da tela de Disponibilidade
 * (AvailabilityFormModal / DisponibilityPage): mesmos inputs, botões, painel lateral e rótulos.
 */
export const panelClassName =
    "relative ml-auto flex h-full max-h-[100dvh] w-full max-w-[min(29rem,100vw)] flex-col overflow-hidden border-l border-border bg-white shadow-[-16px_0_48px_rgba(22,29,24,0.16)]";
export const overlayClassName = "fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/35 backdrop-blur-[3px]";
export const headerClassName = "flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-7 sm:py-5";
export const bodyClassName = "flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6";
export const footerClassName = "flex shrink-0 flex-col-reverse gap-3 border-t border-border bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7";
export const closeButtonClassName = "shrink-0 rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text";

export const labelClassName = "block text-[13px] font-semibold text-text";
export const inputClassName =
    "mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text placeholder:text-text-muted/70 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export const primaryButtonClassName =
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(46,120,61,0.2)] transition-colors hover:bg-primary-hover disabled:opacity-60";
export const secondaryButtonClassName =
    "h-11 rounded-xl border border-border bg-white px-5 text-sm font-semibold text-text transition-colors hover:bg-page";
/** Botão compacto de ação em linha/cartão (mesmo peso dos links "Editar"/"Excluir" da tabela de Disponibilidade). */
export const compactButtonClassName =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-text transition-colors hover:bg-page disabled:opacity-60";
export const linkButtonClassName = "rounded-lg px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-secondary/70";
export const dangerLinkButtonClassName = "rounded-lg px-2 py-1 text-sm font-semibold text-danger transition-colors hover:bg-red-50";

/** Controle segmentado discreto (mesma trilha dos seletores do cadastro de profissionais). */
export const segmentedClassName = "inline-flex gap-1 rounded-xl bg-[#f3f5f1] p-1";
export const segmentClassName = (selected: boolean, disabled = false) =>
    `h-8 min-w-16 rounded-lg px-4 text-xs font-semibold transition-colors ${
        selected ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-text"
    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`;

export const infoCardClassName = "flex items-start gap-3 rounded-xl border border-[#dcebd9] bg-[#edf5eb] px-4 py-3.5";
