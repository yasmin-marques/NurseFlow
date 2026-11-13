# Design

## Context

- `front-end/src/components/layout/navItems.ts` já define o item administrativo `historico`, mas `front-end/src/App.tsx` ainda cai no placeholder genérico para essa seleção.
- O layout da Coordenação já fornece menu lateral, título superior, notificações e identificação do usuário; a nova tela deve ser renderizada dentro de `AppLayout`, sem criar outro shell.
- `GET /escalas` consulta uma escala por mês/ano; `GET /escalas/:id/versao-oficial` retorna o snapshot imutável mais recente; `GET /escalas/:id/pdf` exporta essa versão.
- `VersaoEscala` contém mês, ano, número, data de publicação, autoria e snapshot; os snapshots conservam os plantões da publicação correspondente.
- `GET /trocas` já oferece filtros de status e período, com paginação. A lista retorna solicitante e profissional solicitado. O detalhe e as auditorias fornecem resultado, data da decisão e responsável.

## Referências visuais revisadas

| Seção | Arquivo em `design/nurseflow/` | Elementos principais |
| --- | --- | --- |
| Escalas publicadas | `NurseFlow Web - Histórico (Escalas).png` | Seletor de ano; abas; cartões mensais com data de publicação, quantidade de plantões, percentual e ação PDF |
| Histórico de trocas | `NurseFlow Web - Histórico (Trocas).png` | Mesmo cabeçalho, seletor e abas; linhas com data, par de profissionais, resultado e autor da decisão |

Reutilizar os tokens, componentes e espaçamentos do layout administrativo atual. Os designs devem orientar hierarquia e composição, sem inserir nomes ou registros fictícios.

## Goals / Non-Goals

**Goals:** permitir à Coordenação localizar, por ano, a publicação oficial de cada mês e decisões de trocas concluídas; oferecer o PDF correspondente à escala apresentada; comunicar carregamento, vazio e falhas.

**Non-Goals:** oferecer pesquisa avançada ou filtros por profissional; exibir solicitações pendentes; abrir trilhas completas de auditoria; comparar versões, restaurar escala, alterar decisão ou criar solicitação; mudar o layout dos profissionais.

## Decisions

### Consulta administrativa por ano

Disponibilizar consultas de leitura filtradas por ano para as duas seções. Manter a autorização `Perfil.COORDENACAO`, validar o ano e retornar somente os campos necessários à apresentação. Reaproveitar serviços e modelos existentes; não relaxar a autorização dos endpoints administrativos.

Formato proposto:

```text
GET /escalas/historico?ano=2025
200 { ano, itens: [{
        escalaId, ano, mes, numeroVersao, publicadoEm,
        totalPlantoes, percentualCobertura
      }] }

GET /trocas/historico?ano=2025&pagina=1&limite=20
200 { ano, itens: [{
        id, decididaEm, solicitante:{nome}, profissionalSolicitado:{nome},
        resultado:"aprovada"|"recusada", responsavel:{nome}
      }], pagina, limite, total, totalPaginas }

401 · 403 para perfil não autorizado · 400 para parâmetros inválidos
```

`percentualCobertura` deve vir de métrica persistida/calculável a partir dos dados da escala; se os dados não permitirem a métrica, a interface não deve inventar um valor. O contrato final deve ser confirmado contra os tipos disponíveis antes da implementação.

### Escalas publicadas e PDF

- Listar somente meses que possuam versão publicada no ano escolhido; ordenar por mês crescente.
- Apresentar um cartão por mês com mês/ano, `publicadoEm`, total de plantões e percentual derivado dos dados oficiais.
- A ação PDF deve exportar o snapshot oficial correspondente ao cartão. Como a tela mostra a versão mais recente do mês e o endpoint existente exporta a versão oficial atual da escala, reutilizá-lo quando a escala e versão retornadas corresponderem; caso contrário, adaptar a consulta/exportação para manter a correspondência com o snapshot sem alterar o histórico.
- Mês sem publicação não gera cartão. Se nenhum mês tiver publicação no ano, mostrar estado vazio específico.

### Histórico de trocas

- Exibir apenas estados finais: aprovada ou recusada (incluindo recusas pela Coordenação e pelo profissional); excluir solicitações pendentes/aguardando aceite.
- Usar a data da decisão final para a linha do histórico e ordenar da mais recente para a mais antiga.
- A linha contém data, solicitante → profissional solicitado, resultado textual e nome do responsável registrado na decisão/auditoria. Não inferir o responsável a partir do usuário atual.
- Usar paginação para manter consultas e renderização limitadas.

### Front-end

- Criar `HistoryPage` e serviço de histórico tipado, reaproveitando `AppLayout` e componentes compartilhados.
- O cabeçalho apresenta "Histórico", subtítulo, seletor de ano e abas com estado ativo acessível. Trocar de seção ou ano atualiza somente o conteúdo necessário e descarta respostas obsoletas.
- Downloads reutilizam o mecanismo já existente de `apiDownload`, preservando nome de arquivo e tratamento de erros.
- Estados de carregamento, vazio e erro são distintos e textuais. Erros oferecem nova tentativa. Controles de abas, ano e PDF operam por teclado e têm rótulos acessíveis.

## Risks / Trade-offs

- **Alterações subsequentes da escala:** usar o snapshot/versionamento por mês evita exibir um resumo que não corresponde ao PDF baixado.
- **Métrica de cobertura:** snapshots antigos podem não conter o mesmo formato de resumo; derivar apenas quando possível, sem sucesso falso ou percentual fixo.
- **Trocas recusadas por mais de um ator:** mapear ambos os estados para "Recusada", mas obter responsável da decisão/auditoria correta.
- **Volume histórico:** limitar a consulta de trocas por paginação; a lista mensal de escalas é limitada a 12 registros por ano.
- **Privacidade:** respostas contêm apenas nomes e metadados administrativos necessários; nenhum dado de contato ou identificador pessoal é enviado à tela.

## Migration Plan

Sem migração de dados. A entrega é aditiva. Rollback: remover as consultas e a página, mantendo o item de menu e restaurando o placeholder anterior.
