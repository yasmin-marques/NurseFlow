# Proposal: Gerenciamento de Extras Programados — NurseFlow

## Visão Geral
Esta change introduz uma página própria de **Extras programados** para a Coordenação organizar coberturas previstas de ausências/férias e reforços de equipe. O registro de extra será persistido, consultável e auditável, sem depender de uma alocação antecipada em escala inexistente. Quando houver escala aplicável, a programação será reconciliada com seus plantões de maneira consistente.

## Justificativa de Negócio
- **Planejamento proativo:** permitir agendar cobertura antes da geração mensal da escala.
- **Visibilidade:** consultar e filtrar extras por período, motivo, situação e setor, com indicadores de horas e cobertura.
- **Conformidade:** evitar duplicidade de alocações e observar limites de extras, disponibilidade, descanso e requisitos profissionais já aplicáveis.
- **Rastreabilidade:** preservar alterações, cancelamentos e vínculos com as escalas.

## Escopo
- Página de Extras programados, seguindo as quatro screenshots em `design/`: listagem, indicadores, filtros, registro, edição e cancelamento.
- Registro de extra com profissional substituto, setor, função, data, turno/duração, motivo e, quando cabível, profissional coberto.
- Persistência independente do perfil profissional e associação à escala/plantão quando existir; sincronização sem duplicar cobertura ao gerar ou regenerar escalas.
- Controle de cancelamento e histórico, com confirmação e justificativa.
- Validação no servidor de elegibilidade, conflitos, descanso e limites de extras **segundo as regras vigentes**, sem reescrever o cálculo geral da disponibilidade por turno nesta change.
- Reutilização do cadastro existente de profissionais para incluir RPA; não haverá um segundo cadastro de profissionais.
- Respeito ao estado de revisão/publicação e às permissões de Coordenação.
- Testes de API, regras, integração, interface e consistência com escalas.

## Capabilities

### New Capabilities
- **gerenciamento-extras-programados**: consulta, programação, edição, cancelamento, indicadores, vinculação com escala e fluxo de seleção/cadastro RPA para coberturas extras.

### Modified Capabilities
- **gestao-escalas**: a geração, a regeneração e a revisão de escalas levam em conta extras previamente programados, sem dupla alocação ou contagem e preservando o estado oficial de escalas publicadas.

## Fora de Escopo
- Reformulação das regras gerais de disponibilidade por turno e correção das pendências de QA documentadas na Change 02 (férias que atravessam meia-noite, contagem de dois turnos contíguos e demais casos pendentes).
- Criação ou revisão de limites operacionais em Configurações (Change 03); usar as configurações existentes, se aplicáveis.
- Mudanças no mecanismo de autenticação, na tela geral de perfil ou nos demais módulos sem necessidade direta de integração.
- Gestão de pagamento, folha, valores de plantões e comprovação de execução do extra.

## Considerações de Planejamento
- O campo `extrasProgramados` embutido em `Professional`, sugerido no primeiro rascunho da proposta, **não será adotado como contrato obrigatório**: o extra envolve profissional, setor, cobertura, turno, situação e possível vínculo com uma escala. A representação persistente definida em `design.md` garante identidade própria e integridade.
- A tela principal será **Extras programados**; o perfil do profissional poderá futuramente exibir seus extras, mas isso não substitui esta página e não é condição de aceite nesta change.
- Imagens em `design/` são referências visuais; comportamentos não comprovados por API devem ser especificados e implementados, não simulados.

## Critérios de Aceite
- Coordenação consegue consultar, filtrar, registrar, editar e cancelar extras reais, com feedback e histórico.
- Profissional RPA ativo e elegível pode ser selecionado sem duplicar seu cadastro.
- Operações inválidas não geram registros parciais ou coberturas duplicadas; erros da API são inteligíveis.
- Extras programados antes da escala persistem e são conciliados quando uma escala editável é gerada.
- Escala publicada não é alterada diretamente sem fluxo de revisão/versionamento.
- Testes automatizados cobrem casos positivos, negativos e limites; build e lint permanecem sem falhas introduzidas.
