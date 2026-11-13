# Proposal

## Why

O menu administrativo já contém a seção "Histórico", mas a navegação ainda termina em um placeholder. A Coordenação não tem uma tela única para consultar escalas publicadas de anos anteriores e decisões de trocas. Os protótipos em `design/nurseflow/` definem essa experiência em duas seções: **Escalas publicadas** e **Histórico de trocas**.

## What Changes

- Implementar a página administrativa **Histórico**, acessível pelo item já existente no menu da Coordenação, com seletor de ano e as abas **Escalas publicadas** e **Histórico de trocas**.
- Em **Escalas publicadas**, exibir um cartão por mês com escala publicada no ano selecionado. Cada cartão mostra mês/ano, data de publicação, quantidade de plantões, percentual de cobertura/publicação disponível no snapshot e ação para baixar o PDF da versão oficial daquele mês.
- Em **Histórico de trocas**, listar solicitações finalizadas como aprovadas ou recusadas, com data da decisão, profissionais envolvidos, resultado e responsável pela decisão.
- Criar consultas somente leitura restritas à Coordenação, com filtro por ano e paginação quando necessária. Rascunhos, revisões e solicitações pendentes não aparecem no histórico.
- Usar os snapshots imutáveis de `VersaoEscala` para apresentar e exportar a escala oficial mais recente de cada mês, e os registros/auditorias existentes para resumir as decisões de troca.
- Conectar `activeItem === 'historico'` à nova página, sem alterar as telas e fluxos administrativos existentes.

## Capabilities

### New Capabilities

- `historico-escalas`: consulta anual de escalas publicadas e download do PDF da versão oficial de cada mês.
- `historico-trocas`: consulta anual de decisões finalizadas de troca.

### Modified Capabilities

- `scale-workflow-interface`: a área "Histórico" deixa de exibir o placeholder e passa a renderizar a página administrativa descrita nesta change.

## Scope Boundaries

**Incluído:** página e navegação do Histórico para Coordenação; seletor de ano; resumos de publicações; download do PDF; lista de decisões de troca; estados de carregamento, vazio e erro; consultas protegidas; testes de API e interface.

**Fora do escopo:** exibir rascunhos ou revisões não publicadas; visualizar ou reverter versões antigas individuais além da versão oficial mais recente do mês; editar escalas ou decisões; criar solicitações de troca; exportar relatórios diferentes do PDF da escala; alterar o layout de Enfermeiros/Técnicos; migrações de banco.

## Impact

- **API NestJS:** consultas por ano para escalas publicadas e trocas finalizadas, aproveitando `VersaoEscala`, `SolicitacaoTroca` e `AuditoriaTroca`. A autorização deve permanecer exclusiva para Coordenação.
- **Front-end React:** nova página em `pages/History/`, serviço tipado para os dados do histórico e integração com o item `historico` existente em `App.tsx`.
- **Testes:** cobertura para filtros anuais, estados finais das trocas, isolamento de dados não publicados, download de PDF e navegação/estados acessíveis.

## References and Dependencies

**Designs fornecidos:**

- `design/nurseflow/NurseFlow Web - Histórico (Escalas).png` — aba **Escalas publicadas**.
- `design/nurseflow/NurseFlow Web - Histórico (Trocas).png` — aba **Histórico de trocas**.

**Referências do checkout:** `NAV_ITEMS` já inclui "Histórico"; `App.tsx` ainda renderiza placeholder para esse item. `EscalasController` já restringe as rotas administrativas à Coordenação e oferece exportação do PDF oficial. `VersaoEscala` mantém snapshots e data de publicação. `TrocasService.listar` distingue aprovadas e recusadas, e `TrocasService.detalhe` expõe o histórico de decisões e responsável.

**Decisões para implementação:** a tela mostra somente a versão publicada mais recente por mês, conforme a composição mensal do design; a data da linha de troca é a data da decisão final; decisões recusadas pelo profissional ou pela Coordenação são apresentadas como "Recusada", mantendo o responsável real. O percentual de publicação/cobertura deve ser derivado dos dados existentes da escala, sem inventar métricas nem mostrar uma porcentagem fixa.
