# Design

## Contexto

O sistema possui geração e ciclo de vida de escalas, exportação PDF e cadastro de setores/subsetores. A geração precisa usar a estrutura integrada mais recente. O objetivo é atender os mínimos com plantões de 24 horas, sem definir metas de carga individual nem penalizar quem não alcança uma carga horária esperada.

## Decisões

- **Mínimos por hierarquia:** enfermeiros são contabilizados no nível do setor. Quando há subsetores, técnicos são contabilizados separadamente em cada subsetor. Sem subsetores, enfermeiros e técnicos são contabilizados no próprio setor.
- **Plantões de 24 horas:** gerar alocações com duração de 24 horas e interpretar os quantitativos conforme o contrato vigente de setores. Não converter a geração para turnos de 12 horas.
- **Objetivo mínimo:** buscar apenas o quantitativo mínimo aplicável; não otimizar equidade, carga horária individual ou cobertura acima do mínimo. Não penalizar por carga inferior à esperada. Regras obrigatórias de disponibilidade, descanso, situação, vínculo e formação continuam válidas. Impossibilidades devem ser informadas como cobertura faltante.
- **Geração seletiva:** substituir somente as alocações do setor solicitado. Persistir atomicamente para que falhas preservem o estado anterior desse setor e os demais setores.
- **Chefia geral:** resolver para cada data/período o enfermeiro escalado no Internamento e disponibilizar essa referência para todos os setores e para o PDF, inclusive Emergência.
- **Escalas publicadas:** permitir edição em revisão controlada, mantendo a versão oficial até publicar a revisão. Exclusão requer confirmação e auditoria, e remove a escala da consulta operacional e exportação.
- **PDF:** validar publicação no servidor e na interface. Mostrar a ação de exportar somente para escalas publicadas e gerar o documento a partir da versão publicada vigente.
- **Interface:** remover somente o botão de geração automática do topo; preservar o botão abaixo dos ciclos. Verificar navegação mensal e ordem mês/ano reportadas como concluídas; corrigir padding direito do seletor se necessário.
- **Modal de edição:** apresentar o subsetor associado a cada técnico para tornar a alocação visível.
- **Dependência de Yasmin:** usar o modelo, IDs, mínimos e vínculos existentes após conferir as alterações integradas; não criar estrutura paralela.

## Áreas prováveis

- Back-end: `back-end/src/escalas/`, `back-end/src/setores/` e migrations necessárias.
- Otimizador: `optimizer/` e seus contratos de entrada e saída.
- Front-end: `front-end/src/pages/Scale/`, `front-end/src/pages/GeneralSchedule/` e serviços de escala.
- PDF: serviço de exportação de escalas e tipos associados.

## Riscos

- Substituição seletiva pode apagar alocações de outros setores se o filtro não for aplicado na persistência; validar atomicidade e isolamento.
- Distribuição de mínimos entre setor e subsetores pode divergir dos vínculos atuais; confirmar o contrato entregue por Yasmin.
- Chefia depende da data/período da escala; derivar do plantão correspondente de Internamento.
- Edição ou exclusão pode divergir dos snapshots; reutilizar ciclo de vida e auditoria existentes.
- Esconder o botão de PDF somente no front-end não protege o endpoint; validar publicação também no servidor.
