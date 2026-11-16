## 1. Ajustar dados e regras de disponibilidade

- [x] Revisar o modelo de restrição e disponibilidade atual para confirmar campos de turno, dia, vigência e motivo.
- [x] Identificar todos os pontos de leitura e gravação que usam `observacao` como regra de disponibilidade.
- [x] Definir como manter compatibilidade com registros legados sem quebrar leitura ou conflitos.

## 2. Atualizar geração automática de escalas

- [x] Ajustar o otimizador para considerar disponibilidade por turno e recorrência semanal ao calcular elegibilidade.
- [x] Validar que indisponibilidades, ausências e vínculos externos bloqueiam corretamente a alocação.
- [x] Confirmar que o cálculo de descanso e carga continua respeitando os limites configurados.

## 3. Reforçar validação da escala

- [x] Atualizar a validação de cobertura e conflitos para usar os dados estruturados de turno e vigência.
- [x] Verificar o comportamento em cenários de plantão diurno, noturno e recorrência semanal.
- [x] Garantir que vagas descobertas continuem sendo registradas sem relaxar regras obrigatórias.

## 4. Revisão e confirmação

- [x] Revisar o fluxo de escala em rascunho e confirmar que a revisão usa as regras corrigidas.
- [x] Validar compatibilidade com registros antigos e cenários de migração.
- [x] Documentar mudanças de comportamento e validar que a proposta está pronta para implementação.
