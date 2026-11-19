/**
 * Regra do setor fixo: cada profissional pertence a um único setor (definido no cadastro) e só pode
 * ser escalado nele. Não é preferência nem penalidade: qualquer alocação em outro setor é inválida.
 */
export interface AlocacaoSetor {
  profissionalId: string;
  /** Nome para a mensagem de erro (opcional). */
  profissional?: string;
  /** Setor da vaga/plantão/escala. */
  setorId: string;
}

export interface SetorFixoProfissional {
  setorId?: string | null;
}

/** Erros (vazio = ok) para alocações cujo setor difere do setor cadastrado do profissional. */
export function errosSetorFixo(
  alocacoes: AlocacaoSetor[],
  setorDoProfissional: ReadonlyMap<string, string | null | undefined>,
  nomesSetor?: ReadonlyMap<string, string>,
): string[] {
  const erros = new Set<string>();
  const rotulo = (id: string) => nomesSetor?.get(id) ?? id;
  for (const alocacao of alocacoes) {
    const nome = alocacao.profissional ?? alocacao.profissionalId;
    const fixo = setorDoProfissional.get(alocacao.profissionalId);
    if (!fixo) {
      erros.add(`${nome} não possui setor fixo cadastrado e não pode ser escalado.`);
    } else if (fixo !== alocacao.setorId) {
      erros.add(
        `${nome} pertence ao setor ${rotulo(fixo)} e não pode ser escalado no setor ${rotulo(alocacao.setorId)}.`,
      );
    }
  }
  return [...erros];
}
