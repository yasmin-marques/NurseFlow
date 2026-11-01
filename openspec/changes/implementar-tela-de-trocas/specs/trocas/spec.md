# Spec Delta

## Purpose

Permitir à Coordenação de Enfermagem consultar, analisar, aprovar e recusar solicitações de troca de plantão **já acordadas entre os profissionais**, respeitando a elegibilidade dos envolvidos e as regras da escala, mantendo uma versão oficial consistente e registrando decisões, motivos e notificações. Esta capacidade cobre a área web da Coordenação; a criação e a resposta às solicitações pelos profissionais são dependências externas ao presente change.

> **Estado do repositório:** esta capacidade ainda não existe. Não há modelo/API de solicitações ou aceite, nem decisão de troca. RF015/RF016 serão uma capacidade separada e deverão integrar-se pelo contrato backend definido em `../design.md`. Toda solicitação aceita exige decisão da Coordenação; o toggle atual de aprovação em Configurações é local ao navegador e não altera essa regra. Esta versão aceita somente plantões do mesmo mês/ano, bloqueia aprovação enquanto houver revisão aberta e permite manter insuficiências de cobertura somente quando não forem criadas nem agravadas.

## ADDED Requirements

### Requirement: Restringir a gestão de trocas à Coordenação

O sistema MUST exigir autenticação válida e autorização de Coordenação para acessar a área administrativa de trocas, analisar dados restritos e aprovar ou recusar solicitações. A aprovação da Coordenação MUST ser obrigatória para toda solicitação que tenha sido aceita pelos profissionais; a API MUST aplicar ambas as regras independentemente da interface ou do toggle local de Configurações.

#### Scenario: Coordenação acessa a página

- **WHEN** um usuário autenticado com permissão de Coordenação acessa a área de Trocas
- **THEN** o sistema exibe as solicitações e as ações compatíveis com seu perfil

#### Scenario: Usuário sem autorização tenta decidir uma troca

- **WHEN** um profissional sem perfil de Coordenação envia diretamente uma requisição de aprovação ou recusa
- **THEN** o sistema nega a operação e não altera a solicitação, a escala ou seu histórico de decisões

#### Scenario: Requisição não autenticada

- **WHEN** uma requisição administrativa de trocas é enviada sem credenciais válidas
- **THEN** o sistema exige autenticação e não revela informações restritas das solicitações

#### Scenario: Aprovação da Coordenação é obrigatória

- **WHEN** os profissionais aceitam uma solicitação de troca
- **THEN** ela aguarda decisão da Coordenação e não altera a escala oficial até que a Coordenação a aprove

#### Scenario: Profissional sem perfil de Coordenação acessa a área

- **WHEN** um usuário autenticado sem perfil de Coordenação tenta acessar a área administrativa de Trocas
- **THEN** a interface não oferece essa área nem suas ações administrativas, e a API nega qualquer consulta ou decisão protegida

### Requirement: Consultar solicitações por situação e período
O sistema MUST oferecer à Coordenação a consulta de solicitações por situação e período, com abas **Pendentes**, **Aprovadas** e **Recusadas**, preservando a distinção entre solicitações aguardando acordo dos profissionais e solicitações aptas a receber uma decisão da Coordenação.

As trocas desta versão envolvem somente plantões do mesmo mês/ano; o período da solicitação é, portanto, inequívoco.

#### Scenario: Consultar pendências da Coordenação

- **WHEN** a Coordenação seleciona a aba Pendentes
- **THEN** o sistema exibe somente as solicitações que já obtiveram o acordo exigido dos profissionais e aguardam decisão da Coordenação

#### Scenario: Consultar solicitações aprovadas

- **WHEN** a Coordenação seleciona a aba Aprovadas
- **THEN** o sistema exibe as trocas aprovadas no período consultado, sem oferecer uma segunda aprovação

#### Scenario: Consultar solicitações recusadas

- **WHEN** a Coordenação seleciona a aba Recusadas
- **THEN** o sistema exibe as solicitações recusadas no período consultado, sem oferecer ações de decisão sobre elas

#### Scenario: Filtrar por período

- **WHEN** a Coordenação escolhe outro período de referência
- **THEN** o sistema atualiza solicitações e contadores da lista para o período selecionado sem misturar resultados de outros períodos, enquanto o badge global permanece independente desse filtro

#### Scenario: Solicitação referencia plantões de competências diferentes

- **WHEN** a capacidade RF015/RF016 tenta criar ou aceitar uma solicitação cujos plantões pertencem a meses ou anos diferentes
- **THEN** o backend rejeita a operação e mantém a solicitação fora da fila `aguardando_coordenacao`

#### Scenario: Solicitação ainda depende do colega

- **WHEN** uma solicitação foi criada, mas ainda não recebeu a aceitação necessária do profissional solicitado
- **THEN** o sistema não a apresenta como pendente de aprovação da Coordenação e não permite que ela seja aprovada

#### Scenario: Receber solicitação aceita pelo contrato compartilhado

- **WHEN** a capacidade separada RF015/RF016 registra a aceitação do profissional solicitado pelo contrato backend definido em `../design.md`
- **THEN** a solicitação passa a `aguardando_coordenacao` e fica disponível para esta consulta, mantendo os dois IDs de plantão, os participantes e os dados de aceite

> **Limite de escopo:** esta mudança não implementa criação nem aceite pelo profissional; define e consome o contrato para que a capacidade separada possa integrar-se sem confiar em status enviado diretamente pelo cliente.

### Requirement: Restringir a troca ao mesmo mês e ano

O sistema MUST permitir somente trocas cujos dois plantões pertençam à mesma competência mensal (mês e ano). O backend MUST aplicar a regra antes da transição para aguardando decisão da Coordenação e revalidá-la na consulta de aptidão e na aprovação.

#### Scenario: Solicitação de troca no mesmo mês e ano

- **WHEN** os dois plantões pertencem ao mesmo mês e ano
- **THEN** a solicitação pode seguir as demais validações do fluxo

#### Scenario: Aprovação com competências diferentes

- **WHEN** os plantões associados à solicitação pertencem a meses ou anos diferentes
- **THEN** o backend impede a aprovação sem alterar a solicitação ou a escala

### Requirement: Apresentar os dados necessários para avaliar a troca

O sistema MUST mostrar as informações essenciais da solicitação e dos **dois plantões envolvidos**, incluindo profissionais, datas, horários/turnos, setores, situação e, quando existente, os dados da decisão. O sistema MUST evitar mostrar dados pessoais sem necessidade para a análise.

#### Scenario: Visualizar cartão de solicitação

- **WHEN** uma solicitação é apresentada na lista
- **THEN** o sistema identifica o solicitante, o profissional solicitado, o plantão destacado, a situação da troca e as ações aplicáveis

#### Scenario: Consultar os dois plantões antes de decidir

- **WHEN** a Coordenação abre os detalhes de uma solicitação pendente
- **THEN** o sistema apresenta os dois plantões que serão permutados, com suas datas, setores, funções e horários, inclusive quando forem diferentes

#### Scenario: Consultar uma decisão concluída

- **WHEN** a Coordenação consulta uma troca aprovada ou recusada
- **THEN** o sistema mostra o resultado, o instante e o responsável pela decisão e, no caso de recusa, o motivo registrado

### Requirement: Exibir contagem e sinalização de pendências

O sistema MUST exibir a quantidade de solicitações aguardando a Coordenação e sinalizar de modo distinguível as situações pendente, aprovada e recusada.

O badge de navegação MUST usar a contagem real global de solicitações aguardando decisão retornada pelo backend, independentemente do filtro de período da tela. Zero é um resultado válido; falha de consulta MUST NOT ser representada por um número fictício.

#### Scenario: Atualizar contador após decisão

- **WHEN** uma solicitação pendente é aprovada ou recusada com sucesso
- **THEN** a contagem de pendências é atualizada a partir do estado confirmado pelo servidor

#### Scenario: Exibir situação por texto e aparência

- **WHEN** a Coordenação consulta qualquer aba
- **THEN** cada solicitação possui uma identificação textual de sua situação, sem depender exclusivamente de cor ou ícone

### Requirement: Avaliar novamente a elegibilidade e as restrições da troca

O sistema MUST avaliar novamente a permuta completa sobre os dados atuais da escala antes de efetivá-la, verificando profissionais cadastrados e ativos, compatibilidade da formação com a função, restrições, sobreposições, descanso obrigatório, carga aplicável, cobertura por setor/função/data/turno e limite configurado de trocas. O resultado MUST separar impedimentos de avisos e identificar os profissionais e plantões afetados. O sistema MUST apresentar a cobertura resultante da permuta. Insuficiências existentes podem permanecer, mas nenhuma insuficiência pode ser criada nem agravada pela permuta. A política de publicação não substitui esta comparação.

#### Scenario: Troca elegível

- **WHEN** os dois profissionais permanecem aptos a assumir os plantões permutados e não há impedimentos aplicáveis
- **THEN** o sistema indica que a solicitação pode ser aprovada

#### Scenario: Profissional está indisponível ou ausente

- **WHEN** qualquer profissional possui indisponibilidade, férias ou ausência incompatível com o plantão que receberia
- **THEN** o sistema identifica o impedimento e bloqueia a aprovação sem modificar a escala

#### Scenario: Troca provoca sobreposição ou viola descanso

- **WHEN** a permuta cria choque de horários ou descumpre o descanso obrigatório de qualquer envolvido
- **THEN** o sistema identifica o profissional, o plantão e a regra violada e impede a efetivação

#### Scenario: Troca não respeita a formação exigida
- **WHEN** qualquer profissional não possui a formação exigida pela função do vínculo de plantão que receberia
- **THEN** o sistema identifica a incompatibilidade e impede a efetivação

#### Scenario: Troca não cria nem agrava insuficiência de cobertura
- **WHEN** a permuta altera a cobertura de um setor, função, data ou turno
- **THEN** o sistema compara as faltas por setor, função, data e turno antes e depois; permite manter insuficiências existentes somente quando nenhuma falta nova surge e nenhuma quantidade de faltas aumenta, informando a cobertura resultante

#### Scenario: Troca cria ou agrava insuficiência de cobertura
- **WHEN** a projeção da permuta cria falta em um agrupamento ou aumenta a quantidade de faltas já existente
- **THEN** o sistema identifica a insuficiência e impede a aprovação

#### Scenario: Escala foi alterada depois de exibir o cartão

- **WHEN** as atribuições, a versão oficial ou as condições dos profissionais mudaram desde a última consulta
- **THEN** o sistema refaz a validação no momento da decisão e não confia na sinalização antiga da interface

#### Scenario: Limite de trocas é atingido

- **WHEN** a contagem de trocas de algum envolvido excederia o limite vigente para o período
- **THEN** o sistema mostra a regra e o valor aplicável e impede a aprovação comum, oferecendo somente a exceção autorizada quando permitida

#### Scenario: Contabilizar troca efetivada para os dois profissionais

- **WHEN** uma troca é aprovada, inclusive por exceção autorizada
- **THEN** a contagem do mês/ano comum é incrementada uma vez para cada profissional envolvido

#### Scenario: Recusa não consome limite

- **WHEN** a Coordenação recusa uma solicitação
- **THEN** a contagem de trocas efetivadas dos profissionais permanece inalterada

#### Scenario: Cobertura insuficiente após a permuta

- **WHEN** a projeção da troca mostra cobertura insuficiente já existente antes da permuta
- **THEN** o sistema pode permitir a aprovação somente se a permuta não criar insuficiências nem aumentar nenhuma falta existente, mantendo todas as demais validações obrigatórias

### Requirement: Exibir aptidão sem antecipar a decisão

O sistema MUST apresentar no cartão pendente a situação de aptidão verificada, indicando possibilidade de aprovação ou impedimentos, mas MUST tratar esse resultado como informativo até a validação definitiva no servidor.

#### Scenario: Profissionais aptos

- **WHEN** uma consulta de elegibilidade retorna sem impedimentos
- **THEN** a interface identifica a condição como **Profissional apto** ou indicação equivalente e permite iniciar a confirmação de aprovação

#### Scenario: Existem impedimentos

- **WHEN** a validação aponta impedimentos
- **THEN** a interface apresenta os motivos em texto e não comunica que a solicitação está pronta para efetivação

#### Scenario: Não foi possível verificar aptidão

- **WHEN** o serviço de validação está indisponível ou falha
- **THEN** o sistema apresenta a impossibilidade de validar e não autoriza uma aprovação com base em dados desatualizados

### Requirement: Exigir confirmação explícita para aprovar

O sistema MUST solicitar confirmação antes de aprovar uma troca, deixando claro que a ação altera os plantões na escala oficial.

#### Scenario: Coordenação confirma aprovação

- **WHEN** a Coordenação seleciona Aprovar e confirma a ação no diálogo
- **THEN** o sistema envia a decisão para validação e efetivação no servidor e apresenta o resultado confirmado

#### Scenario: Coordenação cancela aprovação

- **WHEN** a Coordenação seleciona Não ou fecha o diálogo sem confirmar
- **THEN** nenhuma decisão é enviada e a solicitação e a escala permanecem inalteradas

#### Scenario: Impedimento identificado na confirmação

- **WHEN** a verificação final encontra um impedimento antes da aprovação
- **THEN** o sistema rejeita a efetivação, exibe o motivo e mantém a solicitação passível de nova análise sem registrar uma aprovação falsa

### Requirement: Efetivar a troca aprovada na escala oficial

O sistema MUST atualizar, de forma consistente, os responsáveis dos dois plantões envolvidos quando uma troca elegível é aprovada. A atualização MUST respeitar o mecanismo existente de revisão e publicação de escalas: a versão oficial mais recente deve refletir a troca, enquanto versões publicadas anteriores permanecem preservadas.

#### Scenario: Aprovar troca entre dois plantões

- **WHEN** uma solicitação acordada e válida é aprovada pela Coordenação
- **THEN** o profissional originalmente associado ao primeiro plantão assume o segundo, o profissional do segundo assume o primeiro, e a escala oficial passa a refletir as duas atribuições

#### Scenario: Efetivar os dois vínculos atomicamente

- **WHEN** a Coordenação aprova uma troca válida
- **THEN** os dois vínculos, a decisão, a nova versão oficial, a auditoria e o incremento de uma unidade no limite de cada profissional são confirmados na mesma operação atômica, sem estado parcial observável

#### Scenario: Preservar publicações anteriores

- **WHEN** uma troca é efetivada sobre uma escala já publicada
- **THEN** o sistema registra a alteração na versão oficial atual sem modificar retroativamente os registros das versões publicadas anteriores

#### Scenario: Falha ao gravar a efetivação

- **WHEN** ocorre falha em qualquer etapa necessária para efetivar a permuta e registrar a decisão
- **THEN** nenhuma inversão parcial é mantida, a solicitação não é apresentada como aprovada e o sistema informa que a operação não foi concluída

#### Scenario: Não existe escala oficial elegível
- **WHEN** os plantões envolvidos não pertencem a uma escala publicada e apta a receber troca
- **THEN** o sistema impede a efetivação e informa o problema sem criar uma publicação implícita

#### Scenario: Existe revisão não publicada para o período
- **WHEN** há revisão da escala em edição ou validada, mas ainda não publicada
- **THEN** o sistema bloqueia a aprovação sem finalizar nem remover a solicitação, sem alterar a revisão ou escala oficial, e informa que a solicitação poderá ser revalidada após a revisão ser publicada ou descartada/resolvida

#### Scenario: Revalidar após resolução da revisão
- **WHEN** a revisão aberta é publicada ou descartada/resolvida e a Coordenação retoma a solicitação
- **THEN** o sistema carrega a versão oficial atual e revalida todas as regras antes de permitir uma decisão

### Requirement: Exigir confirmação e motivo para recusar

O sistema MUST solicitar confirmação antes de recusar uma solicitação acordada e MUST registrar um motivo que possa ser comunicado aos profissionais. A recusa MUST manter as alocações da escala inalteradas.

DA23 prevê rejeição quando há impedimentos; esta mudança também permite rejeição sem impedimento técnico, decisão de produto explícita, desde que a Coordenação informe uma justificativa.

#### Scenario: Coordenação analisa impedimentos

- **WHEN** a validação identifica impedimentos para a troca
- **THEN** o sistema os apresenta à Coordenação, que pode rejeitar a solicitação com um motivo

#### Scenario: Recusar sem impedimentos técnicos

- **WHEN** a troca não apresenta impedimentos técnicos e a Coordenação decide recusá-la
- **THEN** o sistema exige justificativa, registra a recusa e mantém os plantões inalterados

#### Scenario: Recusar informando motivo

- **WHEN** a Coordenação informa um motivo válido e confirma a recusa
- **THEN** a solicitação passa ao estado de recusada pela Coordenação, o motivo é registrado e a escala não é alterada

#### Scenario: Não informar motivo

- **WHEN** a Coordenação tenta confirmar uma recusa sem motivo
- **THEN** o sistema solicita o preenchimento do motivo e não conclui a recusa

#### Scenario: Cancelar recusa

- **WHEN** a Coordenação seleciona Não ou fecha a confirmação
- **THEN** a solicitação permanece aguardando decisão e a escala não é alterada

### Requirement: Controlar estados e decisões finais

O sistema MUST permitir a decisão da Coordenação somente para solicitações com acordo prévio e estado compatível. Aprovação e recusa são decisões terminais desta etapa; não devem ser reaplicadas como novas decisões à mesma solicitação.

#### Scenario: Decidir solicitação ainda não aceita

- **WHEN** uma requisição tenta aprovar ou recusar como acordada uma solicitação que ainda aguarda o profissional destinatário
- **THEN** o sistema recusa a transição e preserva os dados

#### Scenario: Tentar decidir solicitação já concluída

- **WHEN** uma nova decisão conflitante é enviada para uma solicitação já aprovada ou recusada
- **THEN** o sistema retorna conflito e não reverte ou duplica a decisão existente

#### Scenario: Solicitação já não corresponde aos plantões originais

- **WHEN** os plantões originais foram alterados ou a solicitação deixou de ser aplicável
- **THEN** o sistema impede a aprovação e sinaliza que a Coordenação deve reavaliar a situação

### Requirement: Permitir exceção expressa ao limite de trocas

O sistema MUST respeitar o limite configurado de trocas por profissional e mês/ano. Cada troca efetivada conta uma vez para cada profissional no mês/ano comum dos dois plantões, e uma recusa não consome limite. A Coordenação MUST poder autorizar excepcionalmente uma troca acima do limite, com justificativa e registro de auditoria. Essa exceção MUST NOT dispensar qualquer outra regra obrigatória de elegibilidade, disponibilidade, descanso, cobertura, integridade ou concorrência.

#### Scenario: Aprovação excepcional justificada

- **WHEN** o único bloqueio excepcionalmente superável é o limite de trocas e a Coordenação autoriza conscientemente a exceção com justificativa
- **THEN** o sistema registra a exceção, o responsável e a justificativa e efetiva a troca se todas as demais validações forem satisfeitas

#### Scenario: Exceção usada para tentar ignorar restrição impeditiva
- **WHEN** a Coordenação tenta utilizar a exceção de limite apesar de haver um impedimento de aptidão ou descanso
- **THEN** o sistema impede a aprovação e conserva a escala, inclusive quando o impedimento envolver disponibilidade, cobertura, integridade ou concorrência

#### Scenario: Limite mensal vigente
- **WHEN** o sistema valida uma troca para um mês configurado
- **THEN** utiliza o `limiteTrocas` vigente daquele mês, sem codificar o valor inicial 3 como limite imutável

### Requirement: Registrar decisões e alterações em histórico auditável

O sistema MUST registrar cada decisão final de troca com identificação da solicitação, profissionais, plantões originais e resultantes quando aplicável, responsável pela decisão, data/hora, resultado e motivo/justificativa, preservando a rastreabilidade das versões da escala.

#### Scenario: Consultar histórico de aprovação

- **WHEN** a Coordenação consulta o histórico de uma troca aprovada
- **THEN** o sistema mostra quem aprovou, quando, quais plantões foram permutados e a referência da alteração oficial correspondente

#### Scenario: Consultar histórico de recusa

- **WHEN** a Coordenação consulta uma solicitação recusada
- **THEN** o sistema mostra quem recusou, quando e qual motivo foi registrado

#### Scenario: Proteger histórico

- **WHEN** um usuário tenta editar ou excluir um registro de decisão já finalizada
- **THEN** o sistema preserva o registro e nega a alteração não autorizada

### Requirement: Notificar os profissionais envolvidos
O sistema MUST gerar notificações internas direcionadas aos dois profissionais envolvidos sobre o resultado final da Coordenação. Em caso de recusa, MUST incluir o motivo; em aprovação, MUST identificar os plantões alterados de maneira compreensível.

> **Integração:** o mecanismo atual notifica alterações em snapshots publicados e exige escala/versão; não cobre uma recusa. A implementação deve estendê-lo ou introduzir um evento de troca que suporte os dois resultados, sem apresentar o canal atual como genérico.

#### Scenario: Notificar aprovação

- **WHEN** a aprovação e a atualização oficial são concluídas
- **THEN** o sistema registra notificações para os dois profissionais informando a troca aprovada e os plantões resultantes

#### Scenario: Notificar recusa

- **WHEN** a recusa é concluída
- **THEN** o sistema registra notificações para os dois profissionais contendo a decisão e seu motivo

#### Scenario: Operação não foi concluída

- **WHEN** uma tentativa de decisão falha e não altera a solicitação
- **THEN** o sistema não gera uma notificação definitiva afirmando que a troca foi aprovada ou recusada

### Requirement: Proteger decisões contra concorrência e repetição

O sistema MUST evitar que solicitações repetidas, atualizações simultâneas ou decisões baseadas em versões obsoletas gerem trocas duplicadas, estados divergentes ou alterações parciais na escala e na auditoria.

#### Scenario: Duas decisões simultâneas sobre a mesma troca

- **WHEN** duas requisições tentam finalizar a mesma solicitação ao mesmo tempo
- **THEN** no máximo uma decisão é efetivada, e a outra recebe o estado final já registrado ou um erro de conflito

#### Scenario: Duas trocas concorrentes compartilham um plantão

- **WHEN** duas aprovações tentam alterar um mesmo plantão com base na mesma versão oficial
- **THEN** somente uma é confirmada nessa versão, e a outra é impedida até nova validação sobre a situação atual

#### Scenario: Repetir uma requisição já confirmada

- **WHEN** o cliente repete a mesma requisição de decisão com a mesma identidade de operação
- **THEN** o sistema não reaplica a inversão de plantões nem duplica auditorias ou notificações

### Requirement: Comunicar estados de interface e resultados de operação

O sistema MUST apresentar estados de carregamento, lista vazia, erro, decisão em andamento e sucesso/impedimento de maneira clara, seguindo o padrão visual dos protótipos e evitando decisões duplicadas por cliques repetidos.

#### Scenario: Não existem solicitações no filtro

- **WHEN** não há resultados para a situação e o período selecionados
- **THEN** o sistema mostra uma mensagem de ausência de solicitações sem tratar o estado vazio como falha

#### Scenario: Falha ao carregar solicitações

- **WHEN** a consulta de trocas falha
- **THEN** o sistema informa que não foi possível carregar a lista e oferece uma forma de tentar novamente

#### Scenario: Ação em andamento

- **WHEN** a confirmação de aprovação ou recusa está sendo processada
- **THEN** a interface indica processamento e evita múltiplos envios intencionais da mesma ação

#### Scenario: Atualizar listas após decisão

- **WHEN** o servidor confirma uma aprovação ou recusa
- **THEN** a solicitação deixa a lista de pendentes, aparece na aba correspondente, o contador é atualizado e a interface apresenta confirmação compatível com o resultado

### Requirement: Manter a interface acessível e coerente com os protótipos

O sistema MUST preservar a organização geral da tela de Trocas apresentada nos protótipos, inclusive navegação, cartões, abas e diálogos de confirmação, e MUST oferecer rótulos, foco, estados e mensagens acessíveis sem depender apenas de cor.

#### Scenario: Navegar por teclado

- **WHEN** a Coordenação usa teclado para consultar abas e interagir com os diálogos
- **THEN** consegue alcançar os controles, identificar o foco, confirmar ou cancelar e retornar ao contexto anterior após o fechamento

#### Scenario: Abrir modal de aprovação ou recusa

- **WHEN** a Coordenação abre uma confirmação
- **THEN** o foco é direcionado ao diálogo, a decisão e seu efeito são descritos, e as opções de cancelar e confirmar são identificáveis

#### Scenario: Consultar resultado com tecnologias assistivas

- **WHEN** uma decisão é concluída ou ocorre erro
- **THEN** a mensagem relevante é disponibilizada em texto identificável por tecnologias assistivas
