# Design

## Context

Este change implementa a **validação de trocas pela Coordenação** prevista em RF017/US21 e no diagrama DA23. O Documento de Especificação de Requisitos NurseFlow v1.1 descreve duas etapas anteriores: criação da solicitação (RF015/US19) e concordância do profissional solicitado (RF016/US20). A Coordenação recebe solicitações **já acordadas**, verifica os plantões e as restrições vigentes e decide aprovar ou recusar. A aprovação da Coordenação é obrigatória para toda solicitação aceita pelos profissionais; a aprovação inverte os dois vínculos de plantão atomicamente na escala oficial, preservando versões e histórico. A Coordenação também pode recusar uma solicitação sem impedimentos técnicos, desde que registre uma justificativa. RF015/RF016 permanecem uma capacidade separada e devem integrar-se pelo contrato backend definido neste change.

Os cinco protótipos recebidos representam: tela principal de pendências; abas Aprovadas e Recusadas; diálogo de confirmação de aprovação e diálogo de confirmação de recusa. Os cartões mostram uma síntese da troca (solicitante → solicitado, dia, setor e horário), uma indicação de aptidão e as ações de decisão. O documento exige também consulta por período, identificação dos **dois plantões** e motivo da recusa, elementos que deverão ser expostos sem abandonar o layout de referência.

**Levantamento do checkout concluído para esta revisão:** o front-end é React/TypeScript sem roteador; `App.tsx` escolhe a página pelo estado do item de navegação. O item Trocas já existe em `navItems.ts`, com badge fixo `3`; em `App.tsx` a seleção ainda cai no placeholder. O menu exibe Trocas também para Enfermeiro/Técnico, enquanto a página funcional pretendida é administrativa.

O backend é NestJS/Mongoose. `AppModule` registra JWT e `RolesGuard` globalmente, e endpoints administrativos usam `@Perfis(Perfil.COORDENACAO)`. Não há `TrocasModule`, schema, controller, service, rota, solicitações ou fluxo de aceite dos profissionais. Portanto, todos os contratos HTTP e estruturas de troca propostos neste documento são **novos contratos**, não extensões de uma API de troca existente.

O domínio de escala já contém `Escala`, `Plantao`, `PlantaoProfissional`, snapshots `VersaoEscala`, `AuditoriaEscala` e `NotificacaoEscala`. A revisão de uma escala publicada copia o último snapshot para os dados editáveis; edição, validação e publicação são operações separadas, cada uma com sua própria transação. Publicar cria novo snapshot, auditoria e notificações na mesma transação. Isso preserva versões anteriores, mas não fornece uma operação pública de troca atômica entre revisão, decisão e publicação.

As regras reutilizáveis estão em `validarAlocacoesPlantao`/`calcularPendenciasCobertura` e no fluxo de geração/edição. Cobrem status ativo, formação, restrições (incluindo indisponibilidade, férias, ausência e vínculo externo), sobreposição/descanso, cargas e extras; cobertura é calculada como pendência. Não existe validador específico de uma permuta nem contagem de trocas efetivadas. `ConfiguracoesService` persiste `limiteTrocas` por ano/mês, inicializando-o em 3 quando o período é criado. A política aprovada para esta mudança define que cada troca aprovada incrementa uma vez a contagem de cada profissional no mês comum dos plantões; recusas não contam; exceções administrativas devem ser auditadas.

O cliente possui helper autenticado `api`, `Drawer` com foco/teclado, `Toast`, diálogos próprios da escala e `NotificationCenter`. As notificações atuais são eventos de escala associados a uma versão, não um canal genérico para recusa de troca. A opção “Aprovação da coordenação” da tela de Configurações fica em `localStorage`; não faz parte dos DTOs persistidos pela API.

## Referências visuais revisadas

As cinco referências indicadas foram localizadas e abertas em `design/nurseflow/`, na raiz do repositório:

Protótipos revisados:

| Estado da interface | Referência a procurar em `design/nurseflow/` |
| --- | --- |
| Solicitações pendentes | `NurseFlow Web - Trocas.png` |
| Solicitações aprovadas | `NurseFlow Web - Trocas (Aprovadas).png` |
| Solicitações recusadas | `NurseFlow Web - Trocas (Recusadas).png` |
| Confirmação de aprovação | `Container (Aprovar).png` |
| Confirmação de recusa | `Container  (Recusar).png` (há dois espaços antes do parêntese no arquivo recebido) |

Usar os protótipos como **referência de UI/UX**, não como imagens estáticas a serem exibidas pela aplicação: reproduzir a hierarquia visual (menu lateral, cabeçalho, abas, cartões, tags, cores e modais), mas construir componentes React funcionais, responsivos e acessíveis integrados aos dados da API. As regras funcionais do Documento de Requisitos e do DA23 prevalecem quando o protótipo omitir um campo obrigatório (por exemplo, motivo da recusa, dois plantões ou filtro por período). Reutilizar componentes, tokens e padrões visuais existentes no projeto; não criar um segundo design system para esta tela.

**Lacunas visuais observadas:** os cartões mostram apenas um resumo de plantão, sem revelar o segundo; nenhuma tela mostra filtro de período; o modal de recusa não contém campo de motivo. A página Pendentes ilustra `3`, mas não define comportamento para zero. Os protótipos também não especificam estados de erro/carregamento nem acesso de perfis não administrativos.

## Goals / Non-Goals

**Goals:**

- Dar à Coordenação uma lista operacional clara de solicitações acordadas, organizada por situação e período.
- Verificar novamente, no servidor e no momento da decisão, aptidão, limites e regras de escala, em vez de confiar no estado exibido pelo front-end.
- Aplicar a permuta dos dois plantões à versão oficial, sem alterar versões publicadas anteriores ou deixar dados parcialmente atualizados.
- Manter rastreabilidade, motivo de recusa, eventual exceção formal de limite e notificações internas para ambos os profissionais.
- Preservar os padrões visuais e de navegação dos protótipos, com estados e acessibilidade apropriados.

**Non-Goals:**

- Criar o aplicativo/tela para o profissional abrir solicitações ou aceitar/recusar pedidos recebidos (RF015 e RF016).
- Implementar registro manual de trocas negociadas no papel (US11).
- Redesenhar configurações de limites, calendário, geração automática ou publicação de escalas além da integração necessária para efetivar a troca.
- Integrar email, SMS, WhatsApp ou calendário externo como novo canal de notificação.
- Usar os documentos e as imagens como dados a serem importados pelo sistema.

## Decisions

### Tratar a decisão da Coordenação como etapa distinta do acordo entre profissionais

A interface exibirá três abas: **Pendentes**, **Aprovadas**, **Recusadas**. “Pendentes” significa *aguardando decisão da Coordenação*, não qualquer solicitação que ainda aguarda aceite do colega. O repositório não contém modelo nem status de troca; estados como `AGUARDANDO_COORDENACAO` são rótulos conceituais, não valores persistidos. A capacidade RF015/RF016 separada deverá publicar solicitações aceitas usando o contrato backend abaixo; este change implementa a leitura e decisão administrativas, sem duplicar o fluxo do profissional.

A transição lógica esperada é:

```text
[Solicitação criada pelo profissional]    (capacidade separada RF015/RF016)
                   |
                   v
[Aguardando resposta do colega]           (capacidade separada RF015/RF016)
          |                    |
          | aceita             | recusa
          v                    v
[AGUARDANDO_COORDENACAO]       [RECUSADA_PELO_PROFISSIONAL]
          |                    (fora da fila administrativa)
          v
[Consulta + validação atual]
     |                   |
     | aprovar           | recusar, com motivo
     v                   v
[APROVADA]        [RECUSADA_PELA_COORDENACAO + justificativa]
     |
     v
[Permuta oficial + versão + auditoria + notificações]
```

Esses rótulos são **semânticos** e não impõem nomes persistidos. A API rejeitará transições administrativas a partir de solicitações não acordadas, finalizadas ou inválidas. Uma pendência pode tornar-se inválida se os plantões mudarem antes da decisão: nesse caso a solicitação não deve ser aprovada silenciosamente.

**Alternativa descartada:** considerar todas as solicitações com status genérico `PENDENTE` como prontas para aprovação; isso permitiria decidir sem o acordo exigido em US20.

### Expor lista leve e detalhes completos, sem inventar um segundo plantão

Os cartões replicam a hierarquia visual do protótipo: data em destaque, nomes unidos por seta, resumo do plantão, informação relativa de solicitação/decisão, status ou aptidão, e ações de aprovação/recusa somente nas pendentes.

A consulta detalhada (ao clicar no cartão ou em um comando de detalhes) deverá incluir **os dois plantões envolvidos**. Na troca de turnos ou dias diferentes, mostrar só a data resumida seria insuficiente para decisão segura. Se alguma solicitação não contiver dois plantões identificáveis, tratá-la como informação incompleta e bloquear a aprovação até regularização.

A lista oferece filtro por período e estado, contador de pendências dinâmico, estados vazios, loading, erro e recuperação. O contador global do badge representa todas as solicitações no estado aguardando decisão da Coordenação, sem ser afetado pelo filtro de período da página; o valor vem do backend e zero é apresentado como zero (nunca como valor de exemplo). Em Aprovadas/Recusadas, os avisos e selos textuais seguem o padrão das imagens. A interface não revela CPF, COREN ou contatos quando não são necessários ao fluxo.

### Calcular a aptidão sobre a permuta resultante, não sobre os plantões isolados

A validação deve partir da última versão oficial e construir uma **projeção pós-troca** das atribuições de ambos os profissionais, removendo logicamente suas alocações originais e adicionando as resultantes antes de aplicar os validadores. Esse procedimento evita falsos conflitos com a atribuição que será substituída.

Reutilizar preferencialmente as regras de escala já implementadas, incluindo:

1. Situação ativa e correspondência entre formação e função atribuída.
2. Restrições de indisponibilidade, férias, ausência e vínculo externo, interpretadas pelas regras existentes.
3. Sobreposição e descanso, incluindo a exceção existente para plantões diurnos/noturnos de 12h no mesmo dia.
4. Carga regular, extras e limite de plantões do período.
5. Resultado da cobertura por setor, função, data e turno antes e depois da permuta. Insuficiências existentes podem permanecer, mas não podem surgir nem aumentar em nenhum agrupamento após a troca.
6. Compatibilidade dos vínculos dos plantões com a versão oficial consultada.

`validarAlocacoesPlantao` retorna mensagens de erro, e não uma classificação de aptidão específica para troca. `calcularPendenciasCobertura` calcula faltas separadamente. A implementação precisará adaptar/projetar as duas atribuições para o estado pós-troca e comparar as pendências por setor, função, data e turno: uma troca é apta quanto à cobertura se nenhum grupo ganhar nova falta e nenhuma quantidade de faltas aumentar. Impedimentos e avisos devem ser explícitos, sem alterar silenciosamente as regras do gerador. O resultado de análise proposto é `apta`, `impedimentos[]`, `avisos[]`, referência de revisão/versão e resumo dos dois plantões. O rótulo “Profissional apto” é **informativo**; o servidor repete a validação com dados atuais na decisão.

O único desvio expressamente previsto nos materiais para este fluxo é a **exceção do limite de trocas** em US23. Somente a Coordenação pode autorizá-la; a justificativa é obrigatória e a exceção deve constar no registro de auditoria. Ela permite ultrapassar apenas o limite de quantidade, não qualquer regra de elegibilidade, disponibilidade, descanso, compatibilidade, cobertura (incluindo a regra de não criar/agravar insuficiências), concorrência ou integridade transacional. Cada aprovação regular ou excepcional conta uma vez para cada participante no mês comum; recusa não consome limite. A política de cobertura aprovada para esta mudança é mais restritiva que a confirmação de pendências usada na publicação e não deve ser substituída por ela.

### Reutilizar o ciclo de publicação para produzir uma nova versão oficial

A referência do change arquivado descreve uma escala de trabalho por mês e versões de publicação imutáveis. Ao aprovar uma troca, o servidor deverá produzir o efeito equivalente a **revisar + validar + publicar uma nova versão oficial**, preservando o snapshot anterior e associando a alteração à solicitação. A solicitação somente passa para aprovada quando **a versão oficial atualizada está comprometida**.

Para evitar deixar uma revisão incompleta aguardando publicação manual, a aprovação de troca deve reutilizar operações de domínio já existentes como parte de **uma única operação de negócio**, sem tentar editar diretamente um snapshot imutável. Se houver revisão aberta da escala correspondente (incluindo edição ou validação ainda não publicada), a aprovação deve ser bloqueada sem alterar a solicitação terminalmente ou a escala; a solicitação permanece aguardando decisão. Após a revisão ser publicada ou descartada/resolvida, a Coordenação pode reabrir a solicitação para nova validação sobre a versão vigente. A operação não pode sobrescrever alterações de terceiros.

Os dois vínculos que compõem a permuta devem ser atualizados atomicamente e qualquer aprovação deve preservar os snapshots oficiais anteriores. Nesta versão, os plantões devem pertencer à mesma escala de mesmo mês e ano; o backend deve validar isso antes de aceitar o pedido e novamente antes da decisão. Plantões de meses/anos diferentes são rejeitados sem transição para `aguardando_coordenacao`. Uma aprovação válida produz a nova versão oficial do período, registra a decisão e a contagem de limite para cada profissional dentro da mesma fronteira transacional, sem estado parcial.

**Alternativa descartada:** substituir os profissionais diretamente nas coleções de plantões da versão publicada, sem versionamento; isso contraria a preservação histórica da escala e pode fazer consultas oficiais e exportações divergirem.

### Tornar decisão e efeitos persistentes consistentes e idempotentes

A aprovação envolve, no mínimo, verificação de estado, permuta, criação da nova versão oficial, registro da decisão, auditoria e notificações internas. O repositório já usa `executarTransacao`/`withTransaction`; o Compose local inicia MongoDB como replica set. A configuração do ambiente de implantação, contudo, ainda precisa ser confirmada.

Os endpoints existentes de iniciar revisão, editar, validar e publicar são operações distintas e cada uma abre sua própria transação. Encadeá-los por HTTP não torna a aprovação atômica. A implementação precisará de uma operação de domínio que preserve as invariantes existentes e coordene a mutação dos dois vínculos, snapshot, decisão, incremento do limite, auditoria e eventos pertinentes dentro de uma única fronteira transacional. A recusa persiste decisão, justificativa e notificação sem tocar nos plantões nem consumir limite. Uma revisão aberta bloqueia a aprovação e mantém a solicitação pendente, para revalidação após a revisão ser resolvida.

Usar condição de atualização por estado atual da solicitação e versão/revisão da escala (concorrência otimista). A operação de aprovação deve verificar uma chave de unicidade ou idempotência de decisão. Repetições da mesma operação não invertem os plantões novamente e não criam auditorias ou notificações duplicadas. Duas solicitações distintas que compartilhem plantão devem competir pelo mesmo controle de versão ou lock transacional.

O publicador atual persiste notificações de escala na mesma transação, vinculadas à versão e às alterações detectadas no snapshot. Ele pode ser reutilizado/adaptado no resultado de aprovação se a troca criar uma versão; não cobre uma recusa, que não gera versão. Definir o modelo de evento necessário para as duas decisões e manter a persistência transacional; não presumir um serviço genérico ou outbox já existente.

**Alternativa descartada:** fazer uma chamada para trocar os nomes na escala e depois uma segunda chamada para marcar a solicitação como aprovada. Falhas entre as chamadas deixariam a escala divergente do status da troca.

### Manter a recusa simples, explícita e justificável

O modal vermelho do protótipo pergunta “Tem certeza que deseja recusar?” e informa que a troca não acontecerá. Contudo, US21 exige que o motivo seja comunicado aos profissionais. A implementação final acrescentará um **campo obrigatório de motivo** no diálogo (ou etapa imediatamente associada à mesma confirmação), mantendo os botões Não / Sim e a linguagem visual do modelo.

DA23 descreve rejeição pela Coordenação quando há impedimentos; US21 exige que o motivo seja comunicado. Para esta mudança, também fica definida a rejeição sem impedimento técnico, desde que a Coordenação forneça justificativa. O motivo deve ser salvo e aparecer no detalhe/histórico e na notificação. Não confundir *recusa do profissional* com *recusa pela Coordenação*.

### Contrato backend com a capacidade separada de solicitação/aceite

RF015/RF016 serão entregues por capacidade separada; o change atual não implementa a interface nem os comandos de solicitação e aceite dos profissionais. Como não existe domínio de trocas no backend atual, ambas as capacidades deverão compartilhar o seguinte contrato de domínio. Os nomes de rota são a proposta normativa a confirmar ao detalhar os DTOs; os campos e a semântica de estado são a fronteira obrigatória de integração:

```text
SolicitacaoTroca {
  id: string
  status: "aguardando_resposta" | "aguardando_coordenacao" |
          "recusada_pelo_profissional" | "aprovada" | "recusada_pela_coordenacao"
  solicitanteProfissionalId: string
  profissionalSolicitadoId: string
  plantaoSolicitanteId: string
  plantaoProfissionalSolicitadoId: string
  criadaEm: string
  aceite: { profissionalId: string, aceitoEm: string } | null
  decisaoCoordenacao: {
    resultado: "aprovada" | "recusada"
    usuarioId: string
    decididaEm: string
    justificativa?: string
    versoesEscala?: [{ ano: number, mes: number, numero: number }]
  } | null
}
```

Contrato de integração proposto:

| Operação | Contrato | Responsabilidade |
| --- | --- | --- |
| Solicitar (capacidade RF015/RF016, fora deste change) | `POST /trocas` | Registrar profissional solicitante e os dois IDs de plantão somente se pertencerem ao mesmo mês/ano, iniciando em `aguardando_resposta`. |
| Aceitar (capacidade RF015/RF016, fora deste change) | `POST /trocas/:id/aceite` | Autenticar o destinatário; confirmar que ambos os plantões pertencem ao mesmo mês/ano; revalidar a solicitação; persistir autor/data de aceite e transicionar para `aguardando_coordenacao`. Plantões de meses/anos diferentes são rejeitados sem transição. Esse é o único caminho que disponibiliza a solicitação à fila administrativa. |
| Listar para Coordenação (deste change) | `GET /trocas?status=aguardando_coordenacao&ano=YYYY&mes=MM` | Retornar apenas solicitações aceitas e ainda aguardando decisão; também fornecer a contagem real global sem filtro de período para o badge. |

O produtor da solicitação não pode marcar diretamente `aguardando_coordenacao`, nem o consumidor inferir aceite a partir dos IDs dos profissionais. As duas partes devem compartilhar o mesmo registro e identificadores de plantão. A validação do mesmo mês/ano ocorre no fluxo RF015/RF016 antes do aceite e é repetida pela Coordenação na pré-validação e na decisão final.

### Contratos da área da Coordenação

Não há endpoints de troca existentes. Os contratos abaixo são novos contratos para a interface administrativa, sujeitos aos padrões de DTO/erro do NestJS existente:

| Operação | Contrato proposto | Resposta/observações |
| --- | --- | --- |
| Listar e filtrar | `GET /trocas?status=aguardando_coordenacao&ano=2026&mes=6` | Lista paginável, total por status, resumo da solicitação e metadados para cartões; incluir contagem global real para o badge |
| Consultar detalhes | `GET /trocas/:id` | Dois plantões, dois profissionais, aceite prévio, histórico e versão vinculada |
| Pré-validar | `GET /trocas/:id/validacao` | Aptidão, impedimentos/avisos, contagem/limite, versão oficial atual |
| Aprovar | `POST /trocas/:id/aprovar` | Versão esperada/identidade de operação, `excecaoLimite` e justificativa obrigatória quando a exceção for solicitada |
| Recusar | `POST /trocas/:id/recusar` | Motivo obrigatório, versão ou estado esperado e identidade de operação |

Contratos de escrita devem exigir autenticação e permissão de Coordenação. Falta de autenticação → 401; sem permissão → 403; inexistente → 404; transição inválida/concorrência/escala alterada → 409; dados inválidos → 400 ou 422 conforme padrão atual. As respostas devem conter erros estruturados que permitam ao front-end mostrar **qual regra** impediu a efetivação sem vazar dados de terceiros.

Estrutura lógica mínima de uma solicitação: identificador; solicitante e destinatário; dois identificadores de plantão e suas referências de período/versão; aceite dos profissionais; estado da Coordenação; criação; decisão (quem/quando/tipo/motivo); marcação e justificativa de exceção; referência à versão oficial gerada; chave de idempotência. **Não criar campos duplicados sem inspecionar os schemas vigentes.**

Indexação proposta, somente quando necessária e não existente: `(estado, periodo)`, identificadores dos plantões em solicitações pendentes, chave única de decisão/evento, além dos índices atuais das escalas. A contagem deve usar `limiteTrocas` da configuração do mês/ano comum. Cada troca aprovada conta uma vez para cada profissional; recusas não contam. Uma exceção autorizada pela Coordenação pode ultrapassar somente esse limite e exige justificativa auditável.

### Integrar UI React com os componentes e tokens existentes

Ligar a página administrativa ao item Trocas já existente no menu controlado por estado (não há roteador). O item atual apresenta um badge estático `3` e aparece para perfis não administrativos; a página pretendida deve ser autorizada no frontend e a API deve aplicar `@Perfis(Perfil.COORDENACAO)` como os demais endpoints de gestão. Reutilizar o helper autenticado `api`, tokens de cor, padrões responsivos e componentes de feedback. `Drawer` oferece foco/teclado para painéis; `Toast` e os diálogos da Escala são referências de implementação, mas não há componente genérico de confirmação. Não usar `NotificationCenter` como canal de recusa sem estendê-lo, pois seu contrato exige versão de escala. Manter o padrão branco/verde e vermelho dos protótipos. A página terá:

- Abas Pendentes, Aprovadas, Recusadas, com destaque ativo e contadores derivados do servidor. O badge da navegação reflete a contagem real global de solicitações aguardando Coordenação, sem filtro de período; zero é exibido como zero e falha de consulta não deve ser apresentada como contagem válida.
- Filtro de mês/ano implementado com os componentes existentes, apesar de não estar desenhado nos recortes enviados; RF017 exige filtro por período.
- Cartões responsivos com data, profissionais, resumo, texto de aptidão, motivo/decisão quando aplicável.
- Detalhes dos **dois** plantões, com bloqueios e avisos antes de aprovar.
- Modal verde de confirmação de aprovação; modal vermelho de recusa com motivo obrigatório.
- Feedback de carregamento, ausência de registros, conflito, processamento, conclusão e tentativa de recuperação.

Atualizar a interface somente depois da resposta do servidor ou invalidar a consulta e buscar o estado confirmado. Desabilitar botões durante o envio e evitar cliques duplicados, sem considerar isso a única barreira contra repetição. Foco, rótulos e mensagens não devem depender exclusivamente da cor.

## Risks / Trade-offs

- **Fluxo do profissional ausente:** não há modelo nem API para solicitar ou aceitar trocas; não há solicitações reais que possam alimentar a fila. → Implementar RF015/RF016 como capacidade separada, cumprindo o contrato acima; a fila depende dessa entrega para receber pedidos reais.
- **Toggle local de aprovação:** a tela de Configurações guarda esse toggle no navegador, enquanto a decisão adotada aqui torna a aprovação da Coordenação obrigatória. → Tratar a aprovação como regra obrigatória do backend; não usar o toggle local como autoridade nem ampliar esta mudança para persistir a configuração sem requisito.
- **Estados existentes divergem dos nomes propostos:** risco de aprovar solicitação sem acordo prévio. → Criar mapeamento documentado a partir do código e testes de transição.
- **Snapshot oficial e revisão em andamento:** risco de sobrescrever uma revisão ou mostrar escala desatualizada. → Bloquear aprovação enquanto houver revisão da escala em edição ou validada ainda não publicada; manter a solicitação pendente e permitir nova validação após a revisão ser publicada ou descartada/resolvida.
- **Troca entre meses:** esta versão proíbe trocas entre meses/anos. → Validar a mesma competência no aceite e na decisão; rejeitar o pedido fora da competência sem alterar escala.
- **Cobertura após a troca:** a escala pode já conter insuficiências. → Comparar, por setor, função, data e turno, as faltas antes/depois; nenhuma nova falta ou aumento de quantidade é permitido.
- **Escopo do plantão:** um `Plantao` possui vários vínculos de profissionais. → Confirmar se a troca substitui apenas os dois vínculos solicitados e como preservar função, liderança e origem de cobertura.
- **Validação baseada no cartão:** aptidão pode expirar antes do clique. → Revalidar na operação e sinalizar conflito.
- **MongoDB sem transações habilitadas:** possibilidade de atualização parcial. → Confirmar infraestrutura de replica set e testes de rollback antes de ativar decisões sobre dados reais.
- **Recusa sem motivo no protótipo:** divergência com US21. → Adicionar entrada de motivo sem mudar o fluxo visual principal.
- **Exceção mal delimitada:** aprovações incompatíveis com descanso ou disponibilidade. → Restringir a exceção ao limite configurado e manter as demais regras duras.
- **Notificação duplicada ou prematura:** profissionais recebem decisão incorreta. → Persistir evento/identidade de forma idempotente ligada ao commit.
- **Terminologia de status:** “Pendente” pode significar acordo ou decisão. → Distinção explícita no modelo e no filtro.

## Migration Plan

1. **Publicar o contrato backend compartilhado** com RF015/RF016, incluindo a validação de mesmo mês/ano antes do aceite.
2. **Fixar contratos e invariantes** com testes de estado, elegibilidade, limite e versões; a aprovação da Coordenação será sempre obrigatória.
3. **Adicionar o domínio de trocas** e migrações/índices apenas quando necessários para solicitações, decisões, motivo, referência de versão e idempotência; não há solicitações preexistentes no modelo atual para migrar.
4. **Implementar a operação de decisão** com validação e controle de concorrência, preservando a revisão/publicação; coordenar os efeitos dentro de uma fronteira transacional compatível com o banco usado no ambiente-alvo.
5. **Integrar a página de Trocas** ao item existente da navegação React, com listagem, detalhes, filtros, diálogos e feedback.
6. **Validar fluxo ponta a ponta**: solicitação já aceita → revisão de aptidão → aprovação/recusa → versão oficial/notificações/histórico; exercitar limite e exceção, cobertura insuficiente sem agravamento, revisão aberta, duas decisões simultâneas e falhas parciais.
7. **Habilitar gradualmente** a rota e a interface conforme as práticas do projeto. Em rollback, desabilitar novas decisões e preservar versões e histórico já publicados; nunca apagar alterações oficiais válidas para “voltar ao estado anterior”.

## Dependências externas e verificações de implantação

1. **RF015/RF016:** capacidade separada ainda precisa fornecer solicitação e aceite usando o contrato compartilhado; até sua entrega, a fila administrativa não recebe pedidos reais. A ausência dessa capacidade não impede implementar isoladamente a API e a interface da Coordenação, mas impede o fluxo ponta a ponta.
2. **MongoDB de produção:** confirmar replica set e suporte a transações no ambiente-alvo antes de habilitar decisões. O Compose local já usa replica set; isso não comprova a configuração de produção.

Não permanecem decisões de negócio em aberto neste change. Os critérios de mesmo mês/ano, contagem, exceção, revisão aberta e cobertura estão definidos acima e nos requisitos.

## Estado de implementação desta change

O backend administrativo introduz `GET /trocas`, `GET /trocas/:id`, `GET /trocas/:id/validacao`, `POST /trocas/:id/aprovar` e `POST /trocas/:id/recusar`. Todas as rotas ficam sob JWT e `Perfil.COORDENACAO`. A listagem devolve `itens`, paginação, totais das três abas para o período consultado e `contadores.aguardandoCoordenacao` sem filtro para o badge. Não são expostas rotas `POST /trocas` ou `/aceite`; elas continuam pertencendo ao RF015/RF016.

O registro persistente `solicitacoesTroca` contém os dois IDs de `PlantaoProfissional`, participantes, status, aceite, decisão e período `ano`/`mes` confirmado pelo produtor. Os índices de status/período e vínculos permitem a fila e as consultas; a chave idempotente só é gravada na decisão (deve ficar ausente, não `null`, devido ao índice esparso único). A migration `20261101000009-trocas.js` cria também auditoria e notificações próprias, porque `notificacoesEscala` exige versão publicada e não representa recusa.

A aprovação revalida estado, período, revisão oficial, aptidão, descanso/carga e cobertura dentro da mesma transação. Ela altera somente `profissionalId` nos dois vínculos originais, cria uma nova versão imutável da escala, persiste decisão, auditoria e notificações para ambos. A recusa exige justificativa e usa transação para registrar estado, auditoria e eventos, sem alterar plantões. Repetição com a mesma chave retorna a decisão existente. O MongoDB local de teste usa `MongoMemoryReplSet`; o Compose local inicia `rs0`. Em produção, decisões retornam indisponibilidade até `MONGO_TRANSACTIONS_CONFIRMED=true` ser configurado após validação operacional; a configuração produtiva permanece por confirmar.

As telas administrativa e de consulta estão integradas à navegação React. O badge vem da contagem global, zero é um valor explícito e falha de consulta remove o número. Os estados de lista vazia/erro/carregamento e diálogos exibem os dois plantões; a tela não contém solicitações demonstrativas. A capacidade RF015/RF016 continua necessária para criar pedidos reais.

Verificação executada em 01/11/2026: `npm test` passou com 30 testes unitários do backend, 103 e2e com MongoDB replica set e, após ampliar interação/acessibilidade, 106 testes frontend. `npm run build` passou no backend e frontend. Os testes de Trocas incluem 11 casos e2e administrativos (elegibilidade, limite/exceção, revisão, snapshot, auditoria/notificações, rollback injetado, concorrência e retry) e 12 testes focados de frontend/serviço, incluindo axe, teclado/foco, abas/período, rede e confirmações. A transação e rollback foram verificados em replica set local; não foi possível confirmar a topologia/configuração do MongoDB de produção, então `MONGO_TRANSACTIONS_CONFIRMED=true` deve continuar desligado até verificação operacional. A integração que cria/aceita solicitações continua dependente de RF015/RF016. O build do frontend ainda reporta chunk do ExcelJS acima de 500 kB. As tarefas 1.1 e 4.6 continuam abertas por essas dependências.

## References

- `Documento de Especificação de Requisitos - NurseFlow.pdf` (v1.1, 14/09/2026): ON004; RN003–RN006, RN010–RN014; RF007/US10; RF011/US15; RF015–RF019/US19–US23; RF022/US27; RF023/US28; RNF001, RNF002, RNF004 e RNF006.
- `DA23 — Validação de Troca pela Coordenação .pdf`, página 1.
- `docs/diagramas/diagramas_atividade/DIAGRAMAS_ATIVIDADES.md`, DA22–DA25, consultado para distinguir o aceite dos profissionais, a validação da Coordenação, o registro manual e o histórico.
- Protótipos revisados em `design/nurseflow/`: `NurseFlow Web - Trocas.png`, `NurseFlow Web - Trocas (Aprovadas).png`, `NurseFlow Web - Trocas (Recusadas).png`, `Container (Aprovar).png` e `Container  (Recusar).png`.
- Código consultado nesta revisão: `front-end/src/App.tsx`, `front-end/src/components/layout/navItems.ts`, `front-end/src/components/layout/SideMenu.tsx`, `front-end/src/components/ui/Drawer.tsx`, `front-end/src/components/ui/Toast.tsx`, `front-end/src/services/api.ts`, `front-end/src/services/notifications.ts`, `front-end/src/pages/Settings/useSettings.ts`; `back-end/src/app.module.ts`, `back-end/src/common/guards/roles.guard.ts`, `back-end/src/escalas/{escalas.controller.ts,escalas.service.ts,regras-plantao.ts,schemas.ts}`, `back-end/src/configuracoes/configuracoes.service.ts`, `back-end/src/restricoes/restricoes.service.ts` e `db/docker-compose.yml`.
