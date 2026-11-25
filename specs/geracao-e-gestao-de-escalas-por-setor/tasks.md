# Tasks

## 1. Integração e regras de domínio

- [x] 1.1 Identificar e revisar as alterações de setores/subsetores realizadas por Yasmin.
- [x] 1.2 Confirmar IDs, vínculos, mínimos configurados e representação de setores sem subsetores; alinhar contratos da API e do otimizador.
- [x] 1.3 Mapear estados, snapshots, auditoria e rotas existentes de edição, exclusão, publicação e PDF.

## 2. Geração de escala

- [x] 2.1 Ajustar a geração para cobrir mínimos diurnos e noturnos com plantões de 24h ou plantões de 12h em cada turno.
- [x] 2.2 Aplicar mínimo de enfermeiros no setor e mínimo de técnicos por subsetor quando houver subsetores.
- [x] 2.3 Em setores sem subsetores, aplicar os mínimos de enfermeiros e técnicos no próprio setor.
- [x] 2.4 Priorizar a cobertura mínima, perseguir a carga regular como meta flexível e informar déficits sem tornar a geração inviável.
- [x] 2.5 Implementar geração individual por setor, preservando plantões dos demais setores e o estado anterior em caso de falha.
- [x] 2.6 Resolver o enfermeiro do Internamento como chefe geral e disponibilizar essa informação à escala e ao PDF.
- [x] 2.7 Expor os déficits de carga regular no resultado da escala sem bloquear publicação quando a carga não puder ser cumprida.

## 3. Escalas publicadas e PDF

- [x] 3.1 Permitir edição por revisão controlada, com validação, autoria e data, preservando a versão publicada até publicar a revisão.
- [x] 3.2 Permitir exclusão explícita e confirmada de escala publicada, com auditoria e remoção da disponibilidade operacional.
- [x] 3.3 Exibir ação de exclusão no fluxo de gestão de escala.
- [x] 3.4 Restringir no servidor a geração de PDF a escalas com publicação vigente.
- [x] 3.5 Exibir o botão de exportação somente para escalas publicadas.
- [x] 3.6 Identificar no PDF o chefe do Internamento, inclusive em exportações de outros setores, e ampliar os espaços de assinatura da Coordenação e da Diretoria.

## 4. Interface da escala

- [x] 4.1 Remover o botão de geração automática próximo ao botão de exportação no topo.
- [x] 4.2 Manter o fluxo de escala no topo da tela, antes do calendário.
- [x] 4.3 Verificar navegação entre meses e posição do seletor de ano após os meses; ajustar apenas se necessário.
- [x] 4.4 Corrigir o padding direito do dropdown de seleção do ano.
- [x] 4.5 Ao adicionar profissionais em setor com subsetores, listar profissionais elegíveis em dropdowns por local e exibir a distribuição de técnicos por subsetor na edição.

## 5. Verificação

- [ ] 5.1 Verificar mínimos em setores com e sem subsetores para enfermeiros e técnicos, combinando plantões de 24h e 12h.
- [ ] 5.2 Verificar geração individual sem alteração dos demais setores e rollback em caso de falha.
- [ ] 5.3 Verificar ausência de penalidade por carga abaixo da esperada e aplicação das regras obrigatórias.
- [ ] 5.4 Verificar chefe do Internamento na escala geral e em PDF de outros setores.
- [ ] 5.5 Verificar edição, exclusão, auditoria e PDF nos estados publicado, não publicado e excluído.
- [ ] 5.6 Verificar dropdown de profissionais por subsetor, botão de geração no rodapé, exportação condicionada à publicação e controles mês/ano.
- [ ] 5.7 Verificar integração ponta a ponta com o modelo atualizado de setores/subsetores de Yasmin.
- [ ] 5.8 Verificar cobertura parcial por turno, carga regular atingida/pendente e limites de extras e plantões.
