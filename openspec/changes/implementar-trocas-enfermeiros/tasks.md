# Tasks

> Este change é responsável pelo domínio e pela API profissional compartilhada e pela UI de Enfermeiro. A UI de Técnico pertence a `implementar-trocas-tecnico`. As pendências da Coordenação pertencem a `implementar-tela-de-trocas`.

## 1. Contrato e compatibilidade

- [x] 1.1 Conferir a base do checkout a implementar e fixar os DTOs do [contrato v1](design.md), preservando GET `/trocas/minhas/contagem` e as rotas administrativas. **Verificar:** `/trocas/minhas` não é capturada por `/trocas/:id`; Swagger distingue os dois tipos de recusa.
- [x] 1.2 Estender `SolicitacaoTroca`/enum com resumo dos vínculos originais e `cancelada`, adicionar eventos/recibos profissionais, índices necessários e migração aditiva. **Verificar:** registros já existentes continuam consultáveis, sem sobrescrever decisões nem migrar snapshots oficiais.
- [ ] 1.3 Aplicar identificação pelo profissional da sessão e DTOs com lista de campos permitidos, filtro por participante e projeções sem dados privados. **Verificar:** 401/403/404, mass assignment, sessão sem vínculo e acesso a ID de terceiro para ambos os perfis.

## 2. Leitura oficial e validação compartilhada

- [ ] 2.1 Implementar consultas paginadas dos plantões próprios futuros e dos pares colega–plantão elegíveis com base nos snapshots oficiais. **Verificar:** excluir terceiros na etapa 1 e rascunhos em todas as etapas; manter pares distinguíveis para um colega com vários vínculos; rejeitar plantão iniciado, competências distintas e vínculo repetido.
- [ ] 2.2 Extrair/reusar validação da permuta sem depender de estado administrativo. **Verificar:** aptidão dos dois, liderança/função, descanso com virada de mês, carga/extras, ausência, conflito, vínculo externo e cobertura antes/depois, sem impor regra de mesmo setor. Testar casos de Enfermeiro e Técnico no mesmo serviço.
- [ ] 2.3 Integrar o limite vigente e a contagem de aprovadas à criação, aceite e Coordenação conforme v1. **Verificar:** casos abaixo/no limite, zero, configuração ausente, aumento/redução após abertura e limite do destinatário; sem contagem em ações profissionais e sem expor cota do colega.

## 3. Escrita, consultas profissionais e notificações

- [ ] 3.1 Implementar envio transacional, validando os dois vínculos, titulares, competência da escala e versão esperada. **Verificar:** envio válido persiste `aguardando_resposta` e uma notificação ao destinatário; envio inválido/repetido não duplica efeitos.
- [ ] 3.2 Implementar aceite e recusa para o destinatário. **Verificar:** alteração de titular, termos, horário inicial ou disponibilidade impede aceite; gravação válida guarda autor/data e coloca o ID real na fila; recusa profissional não exige motivo administrativo e avisa o solicitante.
- [ ] 3.3 Implementar cancelamento pelo remetente nos dois estados pendentes. **Verificar:** antes e depois do aceite, remove das listas ativas e/ou fila administrativa, registra no Histórico e notifica o destinatário. Ações depois de resultado terminal falham.
- [ ] 3.4 Implementar lista, detalhe e contagem por sessão, com direção, ações disponíveis, histórico e motivo de recusa da Coordenação. **Verificar:** os cartões mantêm o resumo original após alterações na escala e não trocam o significado dos dois plantões.
- [ ] 3.5 Expor leitura e marcação de notificações de troca para o destinatário de cada evento. **Verificar:** criação, aceite, recusa e cancelamento produzem os destinatários esperados; avisos administrativos existentes são consumidos; outro usuário não lê ou altera o evento.
- [ ] 3.6 Cobrir idempotência e falha transacional na criação/transições com replica set de teste. **Verificar:** replay da mesma operação não duplica pedido/evento; outro payload com a mesma chave conflita; cancelamento concorrente com aceite/recusa do colega ou do administrador mantém resultado íntegro.

## 4. Página profissional de Enfermeiro

- [x] 4.1 Substituir o placeholder para Enfermeiro dentro de `ProfessionalLayout`; corrigir os atalhos da visão geral para usar a navegação profissional. **Verificar:** entrar em Minhas trocas, iniciar uma solicitação e voltar; nenhuma tela administrativa é montada.
- [ ] 4.2 Montar Recebidas, Enviadas e Histórico, cartões com os dois vínculos e badge autenticado no cabeçalho/aba. **Verificar:** zero real, erro, carregamento, vazio, tentativas e valores atualizados após ação/foco, sem misturar sessões.
- [ ] 4.3 Implementar o passo a passo com os três estados de seleção/revisão, botões Voltar e Enviar e validação atual. **Verificar:** mudança do vínculo limpa o candidato, respostas atrasadas não sobrescrevem a seleção atual e falha não anuncia sucesso.
- [ ] 4.4 Implementar confirmações e feedback distintos para aceite, recusa e cancelamento. **Verificar:** Não/Escape não envia; Enter/foco/retorno acessíveis; aceitar mostra que ainda depende da Coordenação e ação terminal fica consultável no Histórico.
- [ ] 4.5 Integrar eventos de troca ao `NotificationCenter` com abertura de pedido próprio; preservar eventos de publicação e acesso autorizado ao snapshot. **Verificar:** não lidas, marcar como lida, destino correto, ressincronização de Meus plantões e ausência de atualizações otimistas na escala.

## 5. Homologação e documentação

- [ ] 5.1 Cobrir acessibilidade e aderência às capturas da pasta `enfermeiro` em desktop e layout estreito. Validar a tarefa solicitar troca no teste de usabilidade previsto em RNF004, registrando contexto e resultado, sem dar por feito teste com usuários ainda não realizado.
- [x] 5.2 Executar integração real Enfermeiro A → Enfermeiro B → Coordenação → os dois profissionais. **Verificar:** aprovar muda somente os dois vínculos e a versão oficial; recusar exibe motivo sem alterar escala; cancelar ou recusar pelo colega não produz decisão da Coordenação.
- [x] 5.3 Atualizar documentação de rotas, erros, estados e operação, executar suites/build relevantes e registrar evidência. Só marcar completa a tarefa 1.1 da Coordenação após o aceite real aparecer no consumidor administrativo.
