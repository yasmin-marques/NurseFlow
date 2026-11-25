/**
 * Classes compartilhadas do módulo de setores. Reproduzem os padrões da tela de Disponibilidade
 * (AvailabilityFormModal / DisponibilityPage): mesmos inputs, botões, painel lateral e rótulos.
 */
export const panelClassName =
    "relative ml-auto flex h-full max-h-[100dvh] w-full max-w-[min(29rem,100vw)] flex-col overflow-hidden border-l border-border bg-white shadow-[-16px_0_48px_rgba(22,29,24,0.16)]";
export const overlayClassName = "fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/35 backdrop-blur-[3px]";
export const headerClassName = "flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-7 sm:py-5";
export const bodyClassName = "flex flex-1 flex-col gap-5 overflow-y-auto [scrollbar-gutter:stable] px-5 py-5 sm:px-7 sm:py-6";
export const closeButtonClassName = "shrink-0 rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text";

export const labelClassName = "block text-[13px] font-semibold text-text";
export const inputClassName =
    "mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text placeholder:text-text-muted/70 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export const primaryButtonClassName =
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(46,120,61,0.2)] transition-colors hover:bg-primary-hover disabled:opacity-60";
export const secondaryButtonClassName =
    "h-11 rounded-xl border border-border bg-white px-5 text-sm font-semibold text-text transition-colors hover:bg-page";
/** Botão compacto de ação em linha/cartão (mesmo peso dos links "Editar"/"Excluir" da tabela de Disponibilidade). */
export const linkButtonClassName = "rounded-lg px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-secondary/70";
export const dangerLinkButtonClassName = "px-2 py-1 text-[11px]! font-medium text-red-600 underline underline-offset-2 transition-colors hover:text-red-800";

/** Controle segmentado discreto (mesma trilha dos seletores do cadastro de profissionais). */
export const segmentedClassName = "inline-flex shrink-0 gap-0.5 rounded-lg bg-[#f3f5f1] p-0.5";

export const segmentClassName = (selected: boolean, disabled = false) =>
    `h-7 min-w-10 rounded-md px-2 text-xs font-semibold transition-colors ${
        selected ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-text"
    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`;

export const infoCardClassName = "flex items-start gap-3 rounded-xl border border-[#dcebd9] bg-[#edf5eb] px-4 py-3.5";

export const compactButtonClassName =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-text transition-colors hover:bg-page disabled:opacity-60";

export const editCompactButtonClassName =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#d9ddd6] bg-[#f3f5f1] px-3 text-xs font-semibold text-text transition-colors hover:bg-[#e9ece6] disabled:opacity-60";

export const dangerCompactButtonClassName =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#efc2bf] bg-[#fdf1f0] px-3 text-xs font-semibold text-danger transition-colors hover:bg-[#f9e5e3] disabled:opacity-60";

export const successCompactButtonClassName =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#cfe3cf] bg-[#eef6ee] px-3 text-xs font-semibold text-primary transition-colors hover:bg-[#e3f0e3] disabled:opacity-60";