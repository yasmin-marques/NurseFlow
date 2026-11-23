# Proposal

## Why

O NurseFlow precisa concluir a experiência de **trocas de plantão para Técnicos de Enfermagem**, perfil próprio e distinto de Enfermeiro e Coordenação. O Documento de Especificação de Requisitos v1.3 (16/11/2026) prevê que Técnicos consultem seus plantões e a escala geral, solicitem trocas, respondam aos pedidos recebidos, cancelem solicitações pendentes e acompanhem notificações (RU017–RU021; RF009/US13, RF014/US18, RF015/US19, RF016/US20 e RF027/US32).

O acordo entre profissionais **não efetiva a permuta**: a troca aceita deve aguardar a decisão da Coordenação (RN011 e RN022; RF017/US21). Somente a aprovação administrativa pode alterar a escala oficial, com histórico e notificação aos dois envolvidos (RN012, RN021 e ON004/ON007).

A mudança `implementar-trocas-enfermeiro` é a responsável pelo **domínio e contrato de API profissional compartilhados**. Esta change acrescenta a **entrada, a experiência e a homologação específicas do Técnico**, sem repetir o backend, duplicar estados ou assumir permissões de Enfermeiro ou Coordenação.

## What Changes

- Disponibilizar a página **Minhas trocas** na sessão autenticada do perfil Técnico, usando `ProfessionalLayout`, com abas **Recebidas**, **Enviadas** e **Histórico** e entrada **Nova solicitação**.
- Implementar a jornada de solicitação em três passos: escolher um plantão próprio futuro da versão oficial, selecionar um **par colega–plantão apto** e revisar/enviar a proposta.
- Exibir somente dados autorizados e reais: colega, os dois plantões, datas, horários/turnos, setores, funções, situação e histórico; preservar os rótulos e o contexto do perfil Técnico.
- Permitir **aceitar** ou **recusar** uma solicitação recebida que aguarda resposta e **cancelar** uma solicitação enviada ainda pendente, sempre com modais de confirmação e resultado do servidor.
- Distinguir os resultados: `aguardando_resposta`, `aguardando_coordenacao`, `recusada_pelo_profissional`, `recusada_pela_coordenacao`, `aprovada` e `cancelada`; preservar o significado de Enviadas, Recebidas e Histórico.
- Integrar a contagem real de pedidos recebidos aguardando resposta, as notificações internas e o acompanhamento da decisão final da Coordenação, sem alterar a escala localmente após aceite.
- Permitir troca entre setores diferentes para Técnicos e Enfermeiros. Restringir a seleção e a ação pela mesma formação/função, mantendo disponibilidade, descanso, carga, extras, cobertura mínima por setor/turno e limitações de liderança.
- Cobrir autorização entre perfis, isolamento por sessão e participantes, conflitos, concorrência, idempotência, estados vazios/erros e acessibilidade, utilizando chamadas reais da API nos testes integrados.

## Capabilities

### New Capabilities

Nenhuma. Não criar capacidade ou domínio exclusivo para Técnico.

### Modified Capabilities

- `trocas`: acrescentar requisitos, interface e critérios de aceite próprios da experiência do Técnico sobre o contrato profissional compartilhado definido em `implementar-trocas-enfermeiro`.

## Scope Boundaries

**Incluído:** tela profissional do Técnico; navegação e atalhos no contexto Técnico; formulário em três etapas; listas, detalhes, diálogos, notificações, histórico, badge e testes de integração do perfil; correções no contrato compartilhado estritamente necessárias para cumprir seus requisitos, feitas no módulo comum.

**Fora do escopo:** nova API de trocas para Técnicos; duplicação de coleções ou serviços; implementação/recriação da interface do Enfermeiro; redesenho da tela da Coordenação; cadastro e alteração de escalas pelo Técnico; troca manual registrada pela Coordenação (US11); sincronização com Google Agenda; alteração do limite configurável ou das regras de publicação; edição de `scale-workflow-interface`.

As mudanças da Coordenação e do Enfermeiro devem ser **reutilizadas** e não aplicadas pela segunda vez. Caso o contrato profissional compartilhado ainda não esteja disponível, componentes e testes podem ser preparados contra tipos definidos na especificação, mas a change do Técnico só pode ser considerada concluída após teste com API e persistência reais.

## Impact

- **Front-end React/TypeScript:** rota lógica/entrada específica do Técnico dentro de `App.tsx` e `ProfessionalLayout`, reutilizando componentes de trocas compartilháveis com Enfermeiro e preservando dados de sessão e acessibilidade.
- **API NestJS/Mongoose:** consumir `/trocas/minhas` e `/notificacoes/trocas` do contrato profissional v1, protegidos para os perfis previstos. Eventuais correções pertencem à implementação compartilhada, não a uma rota paralela `/trocas/tecnicos`.
- **Coordenação:** pedidos aceitos por Técnicos entram na mesma fila `aguardando_coordenacao` e seguem as mesmas operações administrativas; apenas a aprovação muda os dois vínculos na versão oficial.
- **Testes:** perfis Técnico, Enfermeiro e Coordenação; compatibilidade entre formação e função; proteção de informações de terceiros; estados e transições; notificações; regressões de escala e aprovação.

## References and Dependencies

- **Requisitos:** Documento de Especificação de Requisitos NurseFlow **v1.3, 16/11/2026**, especialmente ON004/ON007; RU017–RU021; RF009/US13, RF011/US15, RF014/US18, RF015/US19, RF016/US20, RF017/US21, RF019/US23, RF023/US28, RF027/US32; RN003–RN006, RN010–RN014, RN016, RN018, RN021–RN022; RNF001–RNF004, RNF006, RNF009 e RNF013.
- **Protótipos:** arquivos `NurseFlow Web - Trocas ...`, `NurseFlow Web - Solicitar Troca ...`, `NurseFlow Web - Solicitação ...` e `Container (sim, ...)` em **`design/nurseflow/`**, a mesma pasta de referência da Coordenação. Relação completa em `design.md`.
- **Dependência primária:** [`implementar-trocas-enfermeiro/design.md`](../implementar-trocas-enfermeiro/design.md), contrato profissional v1 e implementação do backend compartilhado.
- **Dependência administrativa:** `implementar-tela-de-trocas`, responsável pela fila e pela validação/aprovação/recusa final. Nenhum aceite do Técnico dispensa essa etapa.

> Estado de execução: a presente documentação é um **plano de implementação**; nenhum checkbox deve ser dado como concluído somente por existir o protótipo ou este documento.
