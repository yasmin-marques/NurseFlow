# Proposal

## Why

A tela Escala e seus painéis no front-end atual não correspondem ao fluxo visual e operacional apresentado nas referências do NurseFlow Web. O alinhamento é necessário para que a Coordenação consiga acompanhar geração, revisão, validação e publicação com os mesmos estados e informações organizadas por mês, semana e plantão.

## What Changes

- Alinhar a navegação lateral, barra superior, cabeçalho, tema e componentes compartilhados às referências visuais.
- Apresentar o fluxo da escala com etapas e estados observáveis de geração, revisão, alterações salvas, validação e publicação.
- Organizar escalas em calendário mensal e cartões semanais com equipes, setores, turnos e alertas de cobertura.
- Substituir os diálogos e popovers atuais pelos painéis laterais ilustrados para geração, edição de plantão, novo técnico, notificações, exportação PDF e publicação.
- Especificar mensagens, validações, estados de carregamento/erro/vazio e bloqueios ou avisos de publicação, preservando as ações suportadas pelo sistema.
- Na tela mensal, manter somente o fluxo, a navegação do calendário, a grade e a faixa informativa mostrados na referência; remover revisão por data/turno, painéis de pendências/conflitos e quadro de cargas.
- Limitar as ações do cabeçalho da página a "Exportar PDF" e "Gerar Escala Automaticamente"; cada ação abre o painel correspondente da referência.
- Exibir a geração em andamento no espaço principal do calendário, com spinner, mensagem e indicadores iguais à captura "NurseFlow Web - Geração de Escala".
- Usar as capturas em `design/nurseflow/` como referência visual; nomes e valores mostrados nelas são exemplos, não dados fixos de produção.

## Capabilities

### New Capabilities

- `scale-workflow-interface`: comportamento observável da interface de gestão de escalas, incluindo fluxo, calendário, revisão semanal e painéis.

### Modified Capabilities

Nenhuma. `openspec list --specs` não encontrou capacidades vigentes; `openspec/specs/README.md` é uma linha de base descritiva, não uma spec de capacidade.

## Impact

- Front-end React/TypeScript: tela Escala, navegação, componentes compartilhados e fluxos laterais.
- Serviços de escala, profissionais e notificações já consumidos pelo front-end; a disponibilidade de dados para alguns rótulos e agrupamentos das imagens será verificada antes de definir qualquer alteração de contrato.
- Mudanças de API/back-end podem ser incluídas se a análise confirmar que os dados necessários não existem; limitar a extensão aos campos indispensáveis e não alterar a change existente `gerenciar-ciclo-de-vida-de-escalas`.
