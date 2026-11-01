# Proposal

## Why

O NurseFlow precisa centralizar a validação das trocas de plantão pela Coordenação. O Documento de Especificação de Requisitos (versão 1.1, 14/09/2026) estabelece que o acordo entre os profissionais antecede a decisão da Coordenação e que a escala oficial somente deve ser alterada após sua aprovação (RF015–RF017; US19–US21; RN010–RN012). O objetivo de negócio ON004 também exige organizar e rastrear trocas antes controladas por papel e link externo.

Os protótipos `NurseFlow Web - Trocas*.png` mostram a página de gestão com as abas **Pendentes**, **Aprovadas** e **Recusadas**, cartões de solicitações, indicadores de aptidão e confirmações para aprovar/recusar. O diagrama **DA23 — Validação de Troca pela Coordenação** detalha consulta de solicitações aguardando decisão, consulta de plantões/profissionais/disponibilidades/limites/escala, verificação de impedimentos e efetivação ou rejeição da troca.

Esta mudança implementa a **área da Coordenação** para validar e decidir solicitações já acordadas pelos profissionais. O fluxo de solicitação e aceite (RF015/RF016) é uma capacidade separada; esta mudança define o contrato backend que essa capacidade deverá cumprir para entregar solicitações aceitas à fila da Coordenação.

## What Changes

- Substituir a área de **Trocas** por uma página funcional coerente com os protótipos: título, descrição, abas de situação, contador dinâmico de pendências, cartões, mensagens contextuais e estados vazios/de carregamento/de erro.
- Listar solicitações de troca com filtros por **status** e **período**, exibindo solicitante, profissional solicitado, plantões envolvidos, data, turno/horário, setor, situação e metadados da decisão quando aplicável.
- Exibir para a Coordenação somente solicitações que **já tenham o acordo exigido dos profissionais** na fila de decisão; distinguir uma solicitação ainda aguardando resposta de outra aguardando a Coordenação por meio do contrato backend de integração.
- Nesta versão, aceitar somente trocas entre plantões do mesmo mês e ano; validar novamente elegibilidade, disponibilidade/ausências, sobreposições, descanso, cobertura e limite usando dados atuais antes de efetivar.
- Permitir aprovar quando já há insuficiência de cobertura somente se a permuta não criar uma nova insuficiência nem aumentar qualquer insuficiência existente, além de respeitar todas as regras obrigatórias.
- Exigir **aprovação da Coordenação em toda solicitação aceita pelos profissionais**. Aprovar mediante confirmação, validando novamente regras e limite, efetivando os dois vínculos de plantão de forma atômica e preservando versionamento/histórico. Permitir **recusar mesmo sem impedimento técnico**, mediante confirmação e justificativa, sem modificar plantões.
- Bloquear temporariamente a aprovação enquanto houver revisão aberta da escala do período; manter a solicitação pendente e permitir nova validação após a resolução da revisão.
- Contabilizar cada troca efetivada uma vez para cada profissional envolvido no mês comum dos plantões. Recusas não consomem limite; somente a Coordenação pode autorizar exceção, com justificativa e registro de auditoria, sem dispensar outras restrições de segurança.
- Registrar ator, instante, resultado, motivo e eventuais exceções; notificar os dois profissionais envolvidos e impedir efeitos duplicados por repetição de requisição.
- Considerar exceção **expressamente autorizada e justificada** para limite de trocas, conforme US23, sem converter outros impedimentos em aprovações automáticas.
- Acrescentar testes do fluxo da Coordenação, incluindo conflito de dados, permissões, concorrência, falha transacional, filtros, mensagens, modais e notificações.

## Capabilities

### New Capabilities

- `trocas`: consulta e validação pela Coordenação de solicitações previamente acordadas; aprovação/recusa; integração com escala publicada, histórico, notificações e controle de limite.

### Modified Capabilities

- `scale-workflow-interface`: substituir o indicador ilustrativo fixo de Trocas por contagem real, retornada pelo backend, de solicitações aguardando validação da Coordenação. O contador considera a fila pendente, não apenas o período atualmente filtrado; zero é um resultado válido, sem fallback fictício.
- A mudança deve respeitar `gestao-escalas` e `publicacao-escalas`; não editar suas especificações vigentes silenciosamente. Se a aprovação exigir alteração de seus invariantes, incluir deltas explícitas antes de implementar.

## Scope Boundaries

**Incluído:** interface web da Coordenação apresentada nos cinco protótipos fornecidos; validação e decisão sobre trocas acordadas; atualização oficial decorrente da aprovação; consulta por status/período; auditoria e notificações associadas.

**Fora do escopo desta mudança:** implementar a interface e as operações de negócio para profissionais solicitarem, aceitarem ou recusarem pedidos (RF015/RF016); registro manual de troca pela Coordenação (US11); redesenhar a configuração geral do limite mensal (RF019), exceto integração indispensável ao valor vigente; refazer a geração automática de escalas; criar relatórios ou integrações externas sem relação com a decisão de troca.

O fluxo RF015/RF016 não existe no código atual e é uma **dependência de entrega**, não uma decisão de escopo em aberto. Antes de essa capacidade separada ser concluída, esta tela não terá solicitações reais para listar; o contrato de integração definido aqui permitirá implementações independentes sem presumir que o fluxo já existe.

## Impact

- **Front-end React:** substituir o placeholder de Trocas no fluxo de navegação por estado existente, integrar autorização de perfil, abas, cartões, estados de requisição, detalhes, validação e confirmações conforme os protótipos.
- **API NestJS e MongoDB:** criar o domínio/API de trocas — não há módulo, schema, controller ou serviço de trocas no código atual — e integrar autenticação, autorização, dados de escalas e configurações mensais existentes.
- **Escalas publicadas:** preservar snapshots imutáveis e o fluxo de revisão/publicação existente. Seus endpoints realizam transações separadas; a aprovação não pode encadear chamadas HTTP existentes e presumir atomicidade.
- **Histórico e notificações:** a auditoria existente é específica de escala. As notificações existentes são vinculadas a uma versão publicada e não representam recusas; será necessário definir extensão ou um evento de troca compatível com ambos os resultados.
- **Testes:** serviços, API, integração com persistência, interface e cenários ponta a ponta.

## References and Dependencies

**Fontes:** Documento de Especificação de Requisitos NurseFlow v1.1: ON004; RN003–RN006, RN010–RN014; RU007–RU008; RF007/US10, RF011/US15, RF015–RF019/US19–US23, RF022/US27, RF023/US28; RNF001, RNF002, RNF004, RNF006. Diagrama DA23 (página 1). Protótipos `NurseFlow Web - Trocas.png`, `NurseFlow Web - Trocas (Aprovadas).png`, `NurseFlow Web - Trocas (Recusadas).png`, `Container (Aprovar).png`, `Container  (Recusar).png`.

**Confirmado no checkout:** a navegação já tem o item Trocas, mas a página é placeholder e o badge é fixo (`3`); não há solicitações/aceites, domínio de trocas, endpoints, histórico de trocas ou notificações genéricas. Há autenticação JWT e autorização por perfil na API; a configuração de limite é mensal e configurável. A tela de Configurações também mostra “Aprovação da coordenação”, mas esse valor fica no `localStorage` e não é persistido pelo backend.

**Decisões incorporadas:** escopo limitado a plantões do mesmo mês/ano; troca aprovada incrementa uma vez o limite de cada profissional nesse mês e recusa não conta; exceção é autorizada somente pela Coordenação, com justificativa e auditoria, sem contornar demais regras; revisão aberta bloqueia a aprovação sem encerrar a solicitação; cobertura insuficiente existente pode permanecer desde que não piore nem surja nova insuficiência. A implementação deve aplicar as regras existentes de formação/função, sem inventar compatibilidade adicional de setor. O contrato de integração RF015/RF016 e o ambiente de implantação com transações MongoDB permanecem dependências a implementar/confirmar.
