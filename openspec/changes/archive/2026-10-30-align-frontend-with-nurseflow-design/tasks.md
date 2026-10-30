# Tasks

## 1. Dados e contratos da escala

- [x] 1.1 Mapear os dados atuais para liderança, responsabilidades, motivo de cobertura e turnos complementares; adicionar somente os campos ausentes e verificar testes do contrato/API e compatibilidade com escalas existentes.
- [x] 1.2 Implementar validação sem persistência e gravação atômica em lote de plantões, com controle de revisão e testes que comprovem ausência de gravações parciais.

## 2. Tokens e tema

- [x] 2.1 Centralizar as cores amostradas em `design.md` e os tokens compartilhados de tipografia, borda, raio e sombra; verificar valores computados e ausência de cores duplicadas na tela Escala.
- [x] 2.2 Ajustar tipografia, superfícies, bordas, cantos e sombras por comparação com as capturas; verificar ao menos a tela mensal e um drawer em screenshot.

## 3. Layout base: sidebar e topbar

- [x] 3.1 Alinhar sidebar, ordem dos itens, estado ativo de Escala, badge Trocas, configurações e card do usuário; verificar rótulos e perfil dinâmico em teste de interface.
- [x] 3.2 Alinhar topbar, título, busca, indicador de notificações e avatar; verificar indicador com e sem notificações não lidas.
- [x] 3.3 Alinhar cabeçalho da página, subtítulo e ações "Exportar PDF" e "Gerar Escala Automaticamente"; verificar navegação para cada fluxo.
- [x] 3.4 Remover do cabeçalho status, edição manual, publicação e downloads secundários; verificar que permaneçam somente as duas ações da referência e que abram seus drawers.

## 4. Componentes compartilhados

- [x] 4.1 Implementar stepper e badges para geração, revisão, alterações salvas, validação e publicação; só avançar após transição persistida com sucesso e manter etapa/contexto após falha.
- [x] 4.2 Implementar drawer reutilizável com overlay desfocado, cabeçalho, rodapé fixo e conteúdo rolável; verificar abertura, fechamento, cancelamento e foco nos painéis.
- [x] 4.3 Implementar chips, seleções, alertas, cartões de pessoa e estados de cobertura reutilizáveis; verificar seleção e apresentação de estado regular, aviso e conflito.

## 5. Calendário mensal

- [x] 5.1 Implementar navegação mensal, alternador "Mês | Semana", legenda e grade Dom–Sáb; verificar troca de mês, alinhamento de datas e rótulos pt-BR.
- [x] 5.2 Exibir chefe, quantitativos de enfermeiros/técnicos, cores e alertas de cobertura por dia; verificar os dados com fixture de cobertura regular, restrição e conflito.
- [x] 5.3 Exibir a faixa informativa de jornadas de 12 horas; verificar o texto integral da spec e sua visibilidade no calendário.
- [x] 5.4 Separar o cartão de navegação mensal do cartão de calendário e remover "Hoje"; verificar a hierarquia e controles contra `NurseFlow Web - Escala (Mês).png`.
- [x] 5.5 Remover revisão por data/turno, painéis independentes de pendências/conflitos/alertas e quadro de cargas abaixo do mês; manter somente a faixa informativa após o calendário.

## 6. Visão semanal

- [x] 6.1 Implementar navegação de semana e cartões diários com cobertura e ação "Editar"; verificar limites entre meses e estado de revisão.
- [x] 6.2 Agrupar liderança, enfermeiros e técnicos com setor, função, avatar e turno; verificar responsabilidades e semântica de "Baixa" e "Retorna" com dados reais.
- [x] 6.3 Ajustar o cabeçalho e os cartões da semana à captura "NurseFlow Web - Escala (Editar)"; verificar navegação, badge de cobertura, alerta e ação "Editar".

## 7. Drawer de geração automática

- [x] 7.1 Implementar data inicial/final, setores, chips "24 horas", "Diurno" e "Noturno", aviso de rascunho e checklist de cinco validações; validar mês completo compatível com a API, seleção inicial e escopo vazio.
- [x] 7.2 Conectar "Gerar Escala" ao serviço e apresentar a escala gerada como revisão, sem publicação automática; verificar sucesso e falha preservando as seleções.

## 8. Estados de carregamento, erro e vazio

- [x] 8.1 Substituir a área do calendário pelo carregamento da referência, com spinner, textos e indicadores "Disponibilidade", "Restrições" e "Cobertura por setor"; preservar o formulário e validar sucesso, erro e prevenção de submissão duplicada.
- [x] 8.2 Implementar erro recuperável para geração, validação, publicação e PDF; verificar mensagem, preservação do contexto e prevenção de submissão duplicada.
- [x] 8.3 Implementar estados vazios para escala, equipe e notificações; verificar que não apresentam nomes, datas ou contagens de exemplo como dados reais.

## 9. Drawer de edição de plantão

- [x] 9.1 Implementar campos de enfermeiro chefe e setor, equipe técnica removível, contador e checklist de validação; verificar aplicação somente após validação válida.
- [x] 9.2 Conectar "Validar conflitos" ao preview sem persistência, "Aplicar alteração" ao conjunto staged e "Salvar alterações" ao lote atômico; verificar revisão única, ausência de gravação parcial e preservação dos dados staged em falha.

## 10. Formulário inline de novo técnico

- [x] 10.1 Implementar busca de profissional e opções de turno dentro do drawer de plantão; verificar adição à equipe e atualização do contador.
- [x] 10.2 Exibir "Digite o nome do técnico." quando o nome estiver vazio; verificar que nenhuma pessoa é adicionada e que o formulário continua editável.

## 11. Drawer de notificações

- [x] 11.1 Substituir o popover por painel lateral com itens lidos/não lidos e estado vazio; verificar dados e indicadores de leitura.
- [x] 11.2 Implementar "Marcar como lidas" e atualizar o indicador da topbar; verificar persistência e tratamento de falha.

## 12. Drawer de exportação PDF

- [x] 12.1 Abrir o drawer de exportação pelo botão superior e implementar escala geral/por setor, aviso dos campos de assinatura e ações do rodapé; verificar seleção e conteúdo por escopo.
- [x] 12.2 Conectar "Gerar PDF" à exportação existente; verificar download do arquivo, falha recuperável e manutenção da opção escolhida.

## 13. Drawer de publicação

- [x] 13.1 Implementar resumo recalculado de cobertura, quantitativo e conflitos; verificar os estados de 94% com cobertura abaixo do mínimo e 100% pronto.
- [x] 13.2 Permitir "Publicar com pendências" somente quando a única pendência for cobertura abaixo do mínimo e bloquear outros conflitos; verificar as respostas da API e o estado persistido.
- [x] 13.3 Implementar "Confirmar publicação", aviso de notificação aos enfermeiros e estado "PUBLICADA"; verificar que a etapa só conclui após confirmação bem-sucedida.

## 14. Comparação visual final

- [x] 14.1 Comparar screenshots da tela, semana e todos os drawers com as 16 imagens de `design/nurseflow/`; verificar textos, estados, cores, dimensões, overlay e responsividade, corrigindo diferenças antes de concluir.
