# Tasks

> **Estado:** implementação administrativa concluída e verificada localmente (42/44 tarefas); permanecem bloqueados o produtor RF015/RF016 e a confirmação operacional do MongoDB de produção.
>
> **Limite do change:** área web e backend de validação/decisão da Coordenação para trocas **já acordadas** pelos profissionais. A interface e os comandos RF015/RF016 são uma capacidade separada; este change define o contrato backend que ela deverá cumprir para integrar com a fila.
>
> **Linha de base verificada:** não há módulo, schema, endpoints ou fluxo de troca/aceite. O item Trocas existe no menu, mas abre placeholder e usa badge estático `3`; autenticação e autorização por perfil já existem. Regras de escala, configurações mensais, snapshots, auditoria e notificações de publicação são reutilizáveis com as limitações descritas em `design.md`.

## 1. Contrato backend e invariantes do domínio

- [ ] 1.1 Detalhar e versionar o contrato backend compartilhado com RF015/RF016 descrito em `design.md`, incluindo estado de aceite confiável, IDs dos dois plantões e autor/data do aceite, e validar que ambos pertencem ao mesmo mês/ano na criação e no aceite. **Verificar:** somente a capacidade separada pode produzir uma solicitação `aguardando_coordenacao`, após validar a mesma competência, sem aceitar status administrativo enviado diretamente pelo cliente.
- [x] 1.2 Aplicar a aprovação da Coordenação como etapa obrigatória em toda solicitação aceita; não usar como autoridade o toggle de Configurações que hoje só persiste localmente. **Verificar:** nenhuma aceitação altera a escala antes da decisão administrativa.
- [x] 1.3 Confirmar no contrato que a solicitação identifica os dois vínculos de `PlantaoProfissional` e que somente esses vínculos são trocados; preservar demais integrantes e seus metadados. **Verificar:** função, liderança e origem de cobertura permanecem consistentes conforme o domínio.
- [x] 1.4 Implementar a contagem mensal aprovada: cada troca efetivada conta uma vez para cada profissional no mês/ano comum; recusas não consomem limite. **Verificar:** leitura de `limiteTrocas` da competência; valor inicial 3 não é constante e trocas de competências diferentes são rejeitadas.
- [x] 1.5 Aplicar as políticas aprovadas para cobertura e revisão: insuficiência existente pode permanecer sem piora; revisão aberta bloqueia a aprovação e preserva a solicitação para revalidação após resolução. **Verificar:** comparação das faltas por setor/função/data/turno antes e depois; revisão de terceiros não é sobrescrita e snapshots publicados anteriores são preservados.
- [x] 1.6 Documentar os contratos HTTP, DTOs e erros dos novos endpoints da Coordenação, alinhados ao contrato compartilhado e aos padrões NestJS existentes. **Verificar:** contratos do `design.md` são implementados/testados e não confundidos com endpoints já existentes.

## 2. Persistência e leitura das solicitações

- [x] 2.1 Criar o modelo persistente de solicitações/decisões após definir 1.1–1.4; não há schema de trocas existente a adaptar. **Verificar:** status de acordo e decisão, dois vínculos da mesma competência, motivo, autoria/instante, exceção e referência de versão definidos sem campos duplicados.
- [x] 2.2 Criar/adaptar consulta paginável de trocas para Coordenação com filtros de situação e período e contador de solicitações aguardando decisão. **Verificar:** pendentes só incluem solicitações acordadas; contadores/filtros correspondem aos dados persistidos.
- [x] 2.3 Criar/adaptar consulta detalhada de uma troca trazendo os dois plantões, profissionais, situação do aceite, informações relevantes da escala e histórico da decisão. **Verificar:** datas/turnos/setores corretos, inexistência tratada e nenhuma exposição desnecessária de CPF/COREN/contatos.
- [x] 2.4 Proteger leitura e escrita administrativas com autenticação/autorização efetivas na API. **Verificar:** testes de 401/403 e ausência de alteração ou vazamento de dados.
- [x] 2.5 Ajustar índices e restrições necessários para consultas por período/status, integridade das decisões e unicidade de eventos, **apenas após** inspeção dos índices atuais. **Verificar:** não há regressão de consultas nem duplicidade de decisões por chave.

## 3. Validação de aptidão e limites

- [x] 3.1 Implementar validação da projeção pós-troca, reutilizando `validarAlocacoesPlantao` e `calcularPendenciasCobertura` sem confiar no resultado enviado pelo cliente. **Verificar:** vínculos originais retirados da projeção não causam falso conflito; validação completa repetida no commit.
- [x] 3.2 Validar status ativo, formação/função, restrições (inclusive férias, ausências e vínculo externo), sobreposições e descanso para ambos os profissionais. **Verificar:** testes para regras suportadas; não inventar compatibilidade por setor sem regra de domínio.
- [x] 3.3 Validar carga regular/extra, cobertura por setor/turno/função/data e identidade/revisão dos vínculos na escala oficial. **Verificar:** cobertura resultante sempre calculada; insuficiências existentes só são mantidas se nenhuma nova falta surgir ou aumentar; revisão aberta bloqueia a aprovação e exige revalidação após resolução.
- [x] 3.4 Integrar o limite configurável de trocas ao mês/ano comum e aos dois participantes; contar somente aprovações efetivadas e distinguir bloqueio por limite de impedimentos que não admitem exceção. **Verificar:** abaixo/no/acima do limite, recusa sem incremento e ausência de configuração sem número presumido.
- [x] 3.5 Implementar a autorização excepcional de limite somente pela Coordenação, com justificativa obrigatória e auditoria, sem desativar outras regras. **Verificar:** exceção registrada e tentativa de ignorar descanso, disponibilidade, cobertura ou outra regra obrigatória rejeitada.
- [x] 3.6 Expor resultado de aptidão para consulta prévia, com impedimentos e avisos estruturados, mas repetir toda a validação na decisão final. **Verificar:** alteração entre consulta e clique não passa despercebida.

## 4. Aprovação, recusa e consistência da escala oficial

- [x] 4.1 Implementar decisão de aprovação somente a partir de solicitação acordada, com checagem condicional de estado e versão e revalidação atual. **Verificar:** estado incorreto ou solicitação desatualizada retorna conflito sem efeitos.
- [x] 4.2 Implementar uma operação de domínio atômica que preserve as invariantes de revisão/publicação, atualize os dois vínculos e produza versão oficial, histórico e contagem mensal; não encadear os endpoints públicos atuais como se compartilhassem transação. **Verificar:** os dois vínculos, decisão, auditoria, contadores e versão são confirmados juntos e snapshots anteriores permanecem imutáveis.
- [x] 4.3 Aplicar as políticas definidas em 1.5 para revisão aberta e mesmo mês/ano. **Verificar:** revisão aberta bloqueia sem finalizar a solicitação; após resolução, revalida sobre a versão atual; competências diferentes são rejeitadas; nenhuma revisão de terceiros é sobrescrita.
- [x] 4.4 Implementar recusa administrativa com motivo obrigatório, confirmação no servidor e nenhuma alteração de plantões. **Verificar:** motivo vazio é rejeitado e recusa concluída preserva a escala oficial.
- [x] 4.5 Registrar decisões e vínculos com as versões em histórico auditável e imutável, inclusive justificativa de exceção quando aplicável. **Verificar:** autor, data/hora, plantões, decisão e razão são consultáveis sem possibilidade de edição indevida.
- [ ] 4.6 Garantir transação nas operações de decisão e alteração correlata; verificar a configuração de MongoDB necessária para transações. **Verificar:** falha injetada em qualquer etapa resulta em rollback integral e não gera falso estado aprovado.
- [x] 4.7 Implementar controle de concorrência e idempotência para repetição da mesma decisão, decisões conflitantes e solicitações diferentes que compartilham plantão. **Verificar:** no máximo uma atualização válida para cada versão/estado e nenhuma dupla inversão.

## 5. Notificações e rastreabilidade

- [x] 5.1 Estender o mecanismo de notificações de escala ou criar um evento de troca que suporte aprovação e recusa; o mecanismo atual exige uma versão publicada e não cobre recusa. **Verificar:** eventos persistidos na transação, com destinatários e chave de duplicação definidos.
- [x] 5.2 Notificar **ambos** os profissionais em aprovação, descrevendo os plantões resultantes. **Verificar:** destinatários corretos, ausência de dados indevidos e referência à troca aprovada.
- [x] 5.3 Notificar ambos em recusa, incluindo motivo legível, sem comunicar que houve alteração de escala. **Verificar:** conteúdo e isolamento por destinatário.
- [x] 5.4 Expor no detalhe/histórico administrativo a autoria, o instante, o motivo/justificativa, a situação e a versão oficial vinculada. **Verificar:** consultas de aprovada e recusada consistentes com auditoria.

## 6. Interface web de Trocas

- [x] 6.1 Substituir o placeholder de Trocas no `App.tsx`, mantendo o padrão de navegação por estado existente (sem introduzir roteador sem necessidade), integrando sidebar, autenticação e componentes visuais. **Verificar:** item/tela e ações de Coordenação não ficam disponíveis a perfis não autorizados.
- [x] 6.2 Implementar serviço tipado do front-end para listar, filtrar, consultar detalhes, validar, aprovar e recusar; mapear erros estruturados e conflitos. **Verificar:** testes de serialização, autenticação, timeout e mensagens de falha.
- [x] 6.3 Implementar abas **Pendentes / Aprovadas / Recusadas**, filtro de período e contadores; ligar o badge da navegação à contagem real global de solicitações aguardando Coordenação, independente do filtro. **Verificar:** número vem do servidor, zero não usa fallback fictício e erro de consulta não aparece como contagem válida.
- [x] 6.4 Implementar cartões de solicitações com data, solicitante → solicitado, resumo do plantão, situação de aptidão ou decisão e botões somente quando cabíveis. **Verificar:** estados visuais dos três protótipos e renderização correta de lista vazia.
- [x] 6.5 Implementar visualização acessível dos **dois plantões** e das informações de elegibilidade, conflitos e limites antes de aprovar. **Verificar:** a Coordenação identifica exatamente o que será permutado, inclusive dias/setores diferentes.
- [x] 6.6 Implementar modal de aprovação no padrão verde do protótipo, com ações Não/Sim, tratamento de bloqueios e indicação de processamento. **Verificar:** cancelar não envia decisão, confirmar só conclui após resposta da API.
- [x] 6.7 Implementar modal de recusa no padrão vermelho, acrescentando **motivo obrigatório** exigido por US21 e mantendo Não/Sim. **Verificar:** não permite envio sem motivo e cancelar preserva a solicitação.
- [x] 6.8 Implementar feedback textual de sucesso, recusa, impedimento, conflito de versão, falha de rede e novo carregamento; atualizar a lista a partir da resposta persistida. **Verificar:** pendência desaparece da aba após decisão e aparece somente na aba final correta.
- [x] 6.9 Garantir acessibilidade mínima de abas, cartões e modais: teclado, foco, rótulos, estados, mensagens e indicação de situação não baseada apenas em cor. **Verificar:** testes de navegação por teclado e verificações automatizadas de acessibilidade disponíveis.

## 7. Testes de integração, documentação e validação final

- [x] 7.1 Executar testes unitários de validação e transições cobrindo acordo prévio, mesma competência, aptidão, cobertura sem agravamento, limite/contagem e exceção, revisão aberta, recusa com motivo e estados terminais. **Verificar:** todos os cenários críticos de `specs/trocas/spec.md` cobertos.
- [x] 7.2 Executar testes e2e da API com banco de integração e versões publicadas reais ou fixtures equivalentes: aprovação, recusa, auditoria, notificações, rollback, retry, concorrência e 401/403/409. **Verificar:** escala oficial e histórico íntegros mesmo sob falha.
- [x] 7.3 Executar testes de interface dos estados Pendentes/Aprovadas/Recusadas, filtro por período, detalhes de dois plantões, modais, estados de rede e acessibilidade. **Verificar:** comportamento corresponde aos cinco protótipos mais os campos obrigatórios dos requisitos.
- [x] 7.4 Validar ponta a ponta uma solicitação acordada em escala publicada: consultar → validar → aprovar → inspecionar nova versão oficial → consultar histórico → conferir duas notificações; repetir com recusa e motivo. **Verificar:** nenhuma divergência entre status, escala e notificações.
- [x] 7.5 Atualizar documentação das rotas, estados, limites, tratamento de concorrência, operações transacionais e dependências de RF015/RF016. **Verificar:** exemplos/documentação correspondem à implementação e não apresentam endpoints fictícios como existentes.
- [x] 7.6 Verificar a implementação das decisões registradas em `design.md` — mesma competência, contagem mensal, revisão aberta e cobertura sem agravamento — e as diferenças visuais (dois plantões, período e justificativa de recusa). **Verificar:** nenhum caso bloqueado é efetivado e nenhuma decisão não aprovada é presumida.
- [x] 7.7 Executar a suíte relevante de front-end/back-end e revisar regressões sobre publicação de escala, edição de plantões, histórico e notificações. **Verificar:** testes passam e os fluxos de escala existentes continuam operacionais.
