# Tasks

## 1. API do histórico

- [x] 1.1 Criar consultas administrativas para listar escalas publicadas por ano e decisões de troca finalizadas por ano, com validação dos filtros e acesso restrito à Coordenação. **Verificar:** 401 sem autenticação, 403 para perfil não administrativo, 400 para ano/paginação inválidos; nenhum dado não publicado ou pendente é retornado.
- [x] 1.2 Implementar o resumo anual das escalas usando a última versão publicada de cada mês e os dados do snapshot. **Verificar:** ordenação por mês, metadados coerentes com a versão e mês sem publicação omitido.
- [x] 1.3 Implementar o histórico paginado de trocas aprovadas/recusadas com data da decisão, participantes e responsável real pela decisão. **Verificar:** inclui recusa do profissional e da Coordenação como "recusada", exclui pendentes e ordena mais recentes primeiro.
- [x] 1.4 Definir e calcular a métrica de cobertura/publicação com dados existentes, sem valor fixo ou inventado; limitar respostas aos campos consumidos pela tela. **Verificar:** snapshots antigos ou sem métrica não produzem percentual incorreto nem falham a consulta.
- [x] 1.5 Garantir que o PDF baixado corresponde à versão oficial resumida no cartão, reaproveitando o endpoint e o serviço de PDF existentes quando aplicável. **Verificar:** nome, mês e versão baixada correspondem ao registro selecionado; erro de exportação é informado.

## 2. Front-end: serviços e integração

- [x] 2.1 Criar `services/history.ts` com contratos e funções tipadas para carregar escalas por ano, trocas paginadas e baixar PDF. **Verificar:** URL, query string, serialização, nome do arquivo e propagação de erros.
- [x] 2.2 Criar `HistoryPage` com seletor de ano, abas "Escalas publicadas" e "Histórico de trocas", aplicando os designs fornecidos. **Verificar:** aba ativa legível e acessível; conteúdo e seletor operam por teclado.
- [x] 2.3 Integrar `activeItem === 'historico'` no `App.tsx` para a Coordenação, preservando o `AppLayout` existente e sem alterar rotas/telas de outros perfis. **Verificar:** o item do menu abre a tela, e o layout administrativo permanece inalterado.

## 3. Seção Escalas publicadas

- [x] 3.1 Renderizar cartões mensais com publicação, quantidade de plantões, métrica de cobertura disponível e ação PDF, ordenados cronologicamente. **Verificar:** cartão corresponde à versão oficial mais recente do mês e não mostra mês sem publicação.
- [x] 3.2 Implementar seleção de ano, carregamento, vazio, erro e nova tentativa. **Verificar:** troca rápida de ano não permite que resposta obsoleta substitua a atual; estados são textuais e distintos.
- [x] 3.3 Integrar a ação de download PDF com indicador/feedback de falha. **Verificar:** nenhum cartão dispara download de outro mês/versão; controles acessíveis por teclado.

## 4. Seção Histórico de trocas

- [x] 4.1 Renderizar linhas com data de decisão, nomes dos participantes, resultado e responsável pela decisão conforme o design. **Verificar:** aprovada/recusada são identificadas por texto, sem depender somente da cor.
- [x] 4.2 Implementar paginação, seleção de ano, carregamento, vazio, erro e nova tentativa. **Verificar:** mudança de ano reinicia a paginação; nenhuma solicitação pendente aparece.

## 5. Testes e validação

- [x] 5.1 Adicionar testes e2e para autorização, filtro anual, versão publicada, cálculo/ausência de métrica, decisões finais, paginação e dados pessoais não necessários. **Verificar:** suite de API pertinente passa com MongoDB replica set.
- [x] 5.2 Adicionar testes de componente/integrados para abas, seletor de ano, cartões, linhas, download, estados vazios/erro e navegação no `App`. **Verificar:** sem regressão no layout administrativo e sem violações de acessibilidade relevantes.
- [x] 5.3 Executar testes e builds de back-end e front-end; revisar a composição das seções com os protótipos fornecidos. **Verificar:** não há dados de exemplo e PDFs/metadados refletem dados publicados.
- [x] 5.4 Atualizar README/Swagger para documentar as consultas administrativas do Histórico, caso sejam criados novos endpoints. **Verificar:** parâmetros, autorização e formato das respostas correspondem à implementação.
