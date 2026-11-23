# Implementação em andamento

Esta change continua aberta. Este registro documenta o que está implementado e as validações executadas; não substitui os critérios ainda pendentes em `tasks.md`.

## Rotas profissionais implementadas

- `GET /trocas/minhas/contagem`: total de pedidos recebidos em `aguardando_resposta`.
- `GET /trocas/minhas?aba=recebidas|enviadas|historico&pagina&limite`: lista paginada filtrada pelos participantes da sessão.
- `GET /trocas/minhas/plantoes`: vínculos futuros encontrados na versão publicada atual.
- `GET /trocas/minhas/plantoes/:vinculoId/candidatos`: pares de colega e vínculo na mesma escala mensal publicada.
- `POST /trocas/minhas`: cria pedido em `aguardando_resposta` usando IDs de `PlantaoProfissional`.
- `GET /trocas/minhas/:id`: detalhe visível somente aos participantes.
- `POST /trocas/minhas/:id/aceite`, `/recusar` e `/cancelar`: transições profissionais protegidas por perfil e participante.
- `GET /notificacoes/trocas` e `PATCH /notificacoes/trocas/:id/lida`: leitura e marcação das notificações da conta profissional.

O controller profissional é registrado antes das rotas administrativas com parâmetro `:id`. A identidade profissional é obtida do JWT e precisa apontar para cadastro ativo ligado ao mesmo usuário. Aprovação ou recusa administrativa mantém os endpoints e registros compartilhados existentes.

## Persistência e limites operacionais

A migration aditiva `20261117000011-trocas-profissionais.js` acrescenta `cancelada`, resumo dos vínculos, índices de consulta e eventos profissionais idempotentes. Ela não edita migrations anteriores nem altera snapshots oficiais. Solicitações e transições gravam estado, evento e notificação na mesma transação. Produção continua exigindo `MONGO_TRANSACTIONS_CONFIRMED=true`; a configuração operacional não foi verificada neste change.

## Evidências executadas

- `back-end`: `npm run build`.
- `back-end`: `npm test -- --runInBand` (12 suites, 121 testes).
- `back-end`: `npm run test:e2e -- --runInBand test/trocas.e2e-spec.ts` (13 testes; inclui solicitação criada pela API, aceite, entrada única na fila, aprovação, recusa profissional, cancelamento antes/depois do aceite, recusa administrativa, motivo e imutabilidade do snapshot anterior).
- `front-end`: `npx tsc -b`.
- `front-end`: `npm test -- --run` (40 arquivos, 181 testes; inclui axe-core na visão inicial da tela de Enfermeiro).
- `front-end`: `npm run build`.

## Trabalho que permanece aberto

- A consulta de candidatos usa a validação de domínio por par, e envio/aceite repetem a validação. Ainda faltam cenários automatizados para mudanças de elegibilidade, revisão aberta, virada do mês, ausência, cobertura, formação/função e disponibilidade entre seleção e resposta.
- Não foram completados testes de concorrência e chave reutilizada com payload diferente para os comandos profissionais, nem uma falha injetada cobrindo rollback dos três registros profissionais.
- O contador, erro, loading e navegação de telas estreitas precisam de cobertura de interface dedicada. O teste automatizado de acessibilidade cobre a visão inicial, não os diálogos e todas as larguras.
- A operação do sino já lista e marca notificações de troca, mas precisa de teste específico de isolamento por destinatário e acesso ao pedido pela notificação.
- Não houve sessão de usabilidade com profissionais. Não se afirma que esse requisito foi realizado.
- Não houve execução contra a infraestrutura local ou de produção; os testes e2e usam replica set efêmero.
