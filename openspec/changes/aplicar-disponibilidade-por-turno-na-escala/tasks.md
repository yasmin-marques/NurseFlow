## 1. Ajustar dados e regras de disponibilidade

- [ ] Revisar o modelo de restrição e disponibilidade atual para confirmar campos de turno, dia, vigência e motivo.
- [ ] Identificar todos os pontos de leitura e gravação que usam `observacao` como regra de disponibilidade.
- [ ] Definir como manter compatibilidade com registros legados sem quebrar leitura ou conflitos.

## 2. Atualizar geração automática de escalas

- [ ] Ajustar o otimizador para considerar disponibilidade por turno e recorrência semanal ao calcular elegibilidade.
- [ ] Validar que indisponibilidades, ausências e vínculos externos bloqueiam corretamente a alocação.
- [ ] Confirmar que o cálculo de descanso e carga continua respeitando os limites configurados.

## 3. Reforçar validação da escala

- [ ] Atualizar a validação de cobertura e conflitos para usar os dados estruturados de turno e vigência.
- [ ] Verificar o comportamento em cenários de plantão diurno, noturno e recorrência semanal.
- [ ] Garantir que vagas descobertas continuem sendo registradas sem relaxar regras obrigatórias.

## 4. Revisão e confirmação

- [ ] Revisar o fluxo de escala em rascunho e confirmar que a revisão usa as regras corrigidas.
- [ ] Validar compatibilidade com registros antigos e cenários de migração.
- [ ] Documentar mudanças de comportamento e validar que a proposta está pronta para implementação.
