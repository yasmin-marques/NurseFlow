# Design

## Context

- A escala oficial é a **última `VersaoEscala`** de cada escala (snapshot imutável de plantões e `profissionaisRelacionados`). Publicar e aprovar troca criam uma versão nova em transações MongoDB; edições e revisões abertas não afetam a versão oficial.
- O backend responde na raiz (sem prefixo global) e o frontend (nginx) faz proxy de `/api`. O JWT fica no `sessionStorage`; por isso o *callback* do OAuth (navegação vinda do Google, sem `Authorization`) precisa ser público e depender apenas do `state`.
- Os horários são locais (Fortaleza, UTC-3) e `Plantao.data` é o dia de início em 00:00 UTC; o fim é `início + duracaoHoras`.
- O repositório não tinha fila de jobs; o worker usa o próprio MongoDB.

## Decisions

1. **Sem SDK do Google.** Cliente HTTP mínimo (`fetch`) atrás da porta abstrata `GoogleCalendarClient`; os testes injetam um fake. Evita dependência pesada e não altera lockfiles.
2. **Escopo `calendar.events`.** É o menor escopo que permite criar/atualizar/remover eventos no calendário `primary`. `calendar.app.created` exigiria uma agenda secundária, contrariando o uso da agenda pessoal.
3. **Identidade estável do evento.** `id = "nf" + base32hex(sha256("nurseflow:{profissionalId}:{plantaoId}"))` (alfabeto aceito pelo Google). A inserção é idempotente; `PUT` → `404` → `POST` → `409` → `PUT` resolve corridas sem duplicar. O `plantaoId` é preservado quando uma revisão reabre a escala.
4. **A tarefa não carrega dados.** Cada execução recalcula o estado oficial atual do profissional (última versão por escala) e converge o Google para ele; por isso uma tarefa antiga nunca sobrescreve um estado mais novo. Execuções do mesmo profissional são serializadas por um *lease* (`lockToken`/`lockExpiraEm`) renovado a cada chamada; desativar a integração invalida o lease e interrompe o envio.
5. **Enfileirar na transação.** `publicarEscala` e `aprovar` inserem as tarefas com a mesma `session`: ou a versão oficial e a tarefa existem, ou nenhuma (sem janela de perda entre *commit* e fila). A inserção só toca o banco local. Depois do *commit* o worker é apenas acionado (best-effort); o *polling* é a garantia.
6. **Confirmação do Google.** O registro em `eventosGoogleAgenda` só é gravado depois da resposta de sucesso. Falha parcial → resultado `parcial`; falha total → `falha`; ambos são exibidos ao usuário e reagendados.
7. **Falhas.** Erros temporários (rede, 429, 5xx, limite) e rejeições têm até 5 tentativas (espera de 1/5/15/60 min) e depois a tarefa vira `falha`. `invalid_grant`, 401 e permissão insuficiente colocam a integração em `reconexao_necessaria` (token descartado, tarefas pendentes canceladas).
8. **Remoção (decisão nossa).** Um evento só é apagado se houver registro em `eventosGoogleAgenda` (criado pelo NurseFlow) e o plantão não pertencer mais ao profissional na versão oficial. Plantões encerrados há mais de 24 h não são tocados (histórico). Eventos pessoais nunca são listados nem alterados.
9. **Desativar.** Marca `desativada`, descarta o token (revogação em melhor esforço), cancela tarefas e põe `sincronizaAgenda=false`; os eventos exportados permanecem. Reativar exige novo consentimento. Ao (re)conectar, os hashes são zerados para reenviar tudo por id fixo (cobre troca de conta; na mesma conta não duplica).
10. **A conexão dispara uma sincronização inicial** (tarefa `conexao`), para o profissional não precisar clicar em *Sincronizar agora* após autorizar.
11. **Segredos.** AES-256-GCM com `GOOGLE_TOKEN_ENCRYPTION_KEY`; a API nunca devolve tokens; os logs só têm tipo/mensagem genérica. Configuração parcial das variáveis `GOOGLE_*` impede o boot; configuração ausente apenas desabilita a integração.

## Risks / Trade-offs

- Com o consentimento OAuth em modo *Teste*, o Google expira refresh tokens em 7 dias → o fluxo *Reconectar* cobre isso.
- Se o profissional apaga manualmente um evento no Google, o próximo envio com conteúdo novo o recria (id fixo); sem mudança de conteúdo o NurseFlow não detecta a exclusão (não lê a agenda — requisito de unidirecionalidade). Conectar de novo força o reenvio.
- Trocar a chave de criptografia exige reconexão de todos os profissionais.

## Pontos em aberto (a definir com o time)

- **Trocas de plantão entre enfermeiros e técnicos**: como o fluxo de troca deve funcionar nesse cenário e como a sincronização das agendas (criação/remoção de eventos) deve se comportar quando ela acontecer. **Não implementado nesta mudança**; a regra de remoção da decisão 8 vale apenas para o comportamento atual e deve ser revista quando esse fluxo for definido.
