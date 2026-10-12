export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const CLASSES_ACENTUADAS: Record<string, string> = {
  a: 'aàáâãä',
  e: 'eèéêë',
  i: 'iìíîï',
  o: 'oòóôõö',
  u: 'uùúûü',
  c: 'cç',
  n: 'nñ',
};

/** Regex (para usar com a opção "i") que ignora acentos: "joao" encontra "João". */
export function regexSemAcentos(texto: string): string {
  return [...semAcentos(texto).toLowerCase()]
    .map((letra) => (CLASSES_ACENTUADAS[letra] ? `[${CLASSES_ACENTUADAS[letra]}]` : escaparRegex(letra)))
    .join('');
}

/** Remove espaços nas pontas e colapsa espaços repetidos. Retorna o valor original se não for string. */
export function normalizarEspacos(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : valor;
}

/** Collation usada em ordenação/índices de texto: ignora maiúsculas e acentos. */
export const COLLATION_PT = { locale: 'pt', strength: 1 } as const;
