# Casos funcionais complementares — Escalas

Este conjunto complementa a planilha `NurseFlow - Testes Funcionais.xlsx`, que não possui cenários específicos para o CRUD de escalas. Os testes automatizados correspondentes ficam em `back-end/test/escalas.e2e-spec.ts` e `front-end/src/pages/Scale`.

| ID | Fluxo | Pré-condições e passos | Resultado esperado |
|---|---|---|---|
| ESC-01 | Montagem manual | Coordenação autenticada; período sem escala. Selecionar **Montar manualmente**. | Um rascunho vazio é criado para o período e o formulário de inclusão é aberto. Se a API falhar, a tela informa o erro e não apresenta rascunho como criado. |
| ESC-02 | Inclusão com cobertura suficiente | Rascunho existente; setor e profissionais ativos elegíveis. Selecionar chefe, técnico, data e turno; validar e aplicar. | A pré-validação não grava dados; sem conflitos, a alteração fica staged e a cobertura mínima correspondente é apresentada como atendida. |
| ESC-03 | Inclusão abaixo do mínimo | Rascunho existente; equipe elegível que deixa vaga em um mínimo configurado. Validar, tentar aplicar sem reconhecer e depois reconhecer. | A tela identifica setor, data, turno, função, necessário/alocado/faltante. Sem reconhecimento a alteração não é aplicada; após reconhecimento, salva sem dispensar conflitos impeditivos e registra a decisão na auditoria. |
| ESC-04 | Edição entre escopos | Plantão existente. Alterar data, setor ou turno e validar/aplicar. | Os mínimos e pendências da localização/turno anterior e do novo são recalculados; conflitos invalidam a alteração sem gravação parcial. |
| ESC-05 | Enfermeiro-chefe do plantão de 24h | Consultar a revisão semanal com plantões de 24h e de 12h; tentar marcar chefe em plantão de 12h. | O enfermeiro-chefe existe apenas em plantões de 24h; plantão de 24h sem marcação informa **Nenhum enfermeiro chefe escalado** e plantões de 12h não exibem chefe. A API recusa liderança em plantão de 12h. |
| ESC-06 | Regeneração de escala validada | Escala `validada`, ainda não publicada. Solicitar nova geração sem confirmação e depois confirmar. | Sem confirmação, a API preserva o conteúdo. Com confirmação, substitui atomicamente, incrementa a revisão, retorna a `rascunho` e invalida a validação do conteúdo substituído. |
| ESC-07 | Preservação de versão oficial | Escala `publicada` ou `finalizada`, com snapshot oficial. Solicitar regeneração. | A substituição é recusada; estado, plantões e snapshot oficial permanecem intactos. |
| ESC-08 | Autorização e concorrência | Coordenador e usuário sem permissão; duas edições com a mesma revisão esperada. | Operações não autorizadas são recusadas. Somente uma edição com revisão válida é aceita; a concorrente recebe conflito e não altera dados. |
| ESC-09 | Publicação e remoção | Rascunho com pendências e escala pronta para publicação. Tentar publicar sem validar; validar/publicar; tentar remover estados não rascunho. | A publicação respeita revisão, conflitos e confirmação de pendências, cria versão oficial imutável e mantém auditoria. A remoção exige confirmação e só é permitida em rascunho. |

