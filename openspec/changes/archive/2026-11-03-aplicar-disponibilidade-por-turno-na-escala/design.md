# Design

## Context

A escala já possui lógica de geração, validação e revisão baseada em disponibilidade e restrições. O problema atual é que parte dessa informação continua sendo interpretada a partir de texto livre em `observacao`, o que torna a alocação inconsistente para turnos, recorrências semanais e compatibilidade de disponibilidade.

## Goals / Non-Goals

**Goals:**

- Usar disponibilidade por turno e recorrência semanal como dados estruturados no cálculo da escala.
- Preservar compatibilidade com registros legados já persistidos.
- Manter a geração e a revisão da escala consistentes com as regras de descanso, carga e cobertura.

**Non-Goals:**

- Alterar a arquitetura geral do módulo de escalas ou do otimizador.
- Redesenhar a API de restrições como parte de esta mudança.
- Introduzir novos fluxos de autenticação ou autorização.

## Decisions

### 1. Modelar disponibilidade e indisponibilidade como dados estruturados

A regra de disponibilidade deve ser tratada como um conjunto explícito de campos: turno, dias da semana, vigência, motivo e profissional. Isso permite que a geração da escala e a validação do plantão usem informações consistentes em vez de inferir regras por concatenação textual.

**Alternatives considered:**

- Manter `observacao` como fonte dominante de regra. Rejeitado por ser frágil e ambíguo.
- Reescrever tudo em um novo modelo de restrições. Rejeitado por risco de quebra de compatibilidade.

### 2. Aplicar a regra no momento da geração e da validação

A verificação de disponibilidade deve acontecer tanto na geração automática quanto na validação final da escala. Isso reduz a chance de escalas inválidas passarem para revisão e garante que a regra seja aplicada consistentemente em cenários manuais e automáticos.

**Alternatives considered:**

- Validar somente após a escala ser criada. Rejeitado porque a falha seria detectada tarde demais.
- Validar apenas no front-end. Rejeitado porque permite inconsistência no back-end.

### 3. Preservar compatibilidade com registros legados

Qualquer migração ou adaptação deve aceitar registros antigos que usam `observacao` como proxy para disponibilidade e motivo, sem quebrar leitura e listagem. A compatibilidade serve como camada de transição até que os dados estejam totalmente estruturados.

**Alternatives considered:**

- Exigir limpeza completa antes da geração. Rejeitado por risco operacional e interrupção do calendário.

## Risks / Trade-offs

- [Compatibilidade de dados legados] → Manter conversão permissiva e validar com cenários de leitura e conflito.
- [Complexidade de recorrência semanal] → Centralizar a regra de validação em um único ponto do otimizador e da API.
- [Impacto em produção] → Aplicar a validação em duas etapas: geração e revisão, para facilitar rollback e inspeção manual.

## Migration Plan

1. Validar os campos estruturados já existentes em profissionais e restrições.
2. Ajustar a geração automática para considerar `turno`, `diaSemana` e vigência no cálculo da elegibilidade.
3. Revalidar conflitos e cobertura após a geração.
4. Manter suporte à leitura de registros legados sem exigir migração massiva.
5. Revisar e confirmar a escala em rascunho antes da publicação.

## Open Questions

- Nenhuma incerteza crítica bloqueia esta proposta; as decisões acima podem ser implementadas com base no contrato atual e na compatibilidade existente.
