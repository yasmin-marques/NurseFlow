# NurseFlow - Diagramas de Atividade

## DA01 - Autenticação e Controle de Acesso

Descreve o processo de login. O usuário seleciona o perfil entre Coordenação, Enfermeiro ou Técnico, informa o e-mail profissional e a senha e clica em Entrar.

O sistema consulta os dados do usuário e verifica se as credenciais e o perfil são válidos. Se forem inválidos, registra a tentativa de acesso e, após tentativas sucessivas, pode bloquear temporariamente novos acessos.

O usuário também pode solicitar a recuperação de senha. Quando os dados são válidos, o sistema identifica o perfil, libera as funcionalidades correspondentes e redireciona o usuário.

---

## DA02 - Cadastro de Profissional

A Coordenação cadastra um enfermeiro ou técnico informando:

- Nome completo
- CPF
- COREN
- Formação
- Tipo de vínculo
- Status

O sistema valida os campos e verifica se o CPF ou o COREN já estão cadastrados.

Caso o profissional já exista, exibe uma mensagem informando a duplicidade. Caso contrário, salva o cadastro, confirma a operação e disponibiliza o profissional para as escalas ainda não publicadas.

---

## DA03 - Consulta e Edição de Profissional

A Coordenação busca um profissional por:

- Nome
- CPF
- COREN

Também podem ser aplicados filtros por:

- Formação
- Status
- Vínculo
- Ordenação

Se nenhum profissional for encontrado, o sistema informa o resultado.

Quando encontrado, seus dados são exibidos e a Coordenação pode optar por editá-los.

Após a edição, o sistema valida as informações, salva as alterações, registra a modificação no histórico e aplica a mudança às escalas ainda não publicadas.

---

## DA04 - Desativação de Profissional

A Coordenação seleciona um profissional, altera seu status para **Desativado** e salva.

Antes de concluir a operação, o sistema verifica se existem plantões futuros já publicados.

Se existirem, a desativação é impedida e são apresentados os plantões que precisam de cobertura.

Caso não existam, o profissional é desativado, seu histórico é preservado, ele deixa de participar das novas escalas e permanece registrado nas escalas já publicadas.

---

## DA05 - Disponibilidade e Restrições

A Coordenação cria uma restrição para um profissional, informando:

- Tipo de regra
- Validade
- Turno permitido, quando aplicável

Caso a regra seja **"Não escalar nos dias marcados"**, também são informados os dias da semana em que o profissional está indisponível.

O sistema valida e salva a restrição.

Após o registro, a regra passa a ser considerada nos próximos rascunhos de escala.

---

## DA06 - Férias e Ausências

A Coordenação registra um período de ausência para um profissional, informando:

- Motivo
- Data de início
- Data de retorno

Os motivos podem incluir:

- Férias
- Licença médica
- Atestado médico
- Outro

O sistema valida e salva o período, impede a alocação do profissional durante a ausência e consulta os plantões afetados.

Em seguida, calcula possíveis plantões descobertos por setor.

Quando houver cobertura insuficiente, esses plantões são indicados.

O período também é exibido na escala como ausência.

---

## DA07 - Cadastro de Setores Hospitalares

A Coordenação cadastra um setor informando:

- Nome
- Descrição
- Quantitativo inicial de enfermeiros
- Quantitativo inicial de técnicos
- Quantitativo por turno diurno e noturno

O sistema valida os dados e verifica se já existe outro setor com o mesmo nome.

Caso exista, exibe uma mensagem informando a duplicidade.

Caso contrário, salva o setor e confirma o cadastro.

---

## DA08 - Quantitativo Mínimo por Setor

A Coordenação seleciona um setor e o turno:

- Diurno
- Noturno

Em seguida, informa a quantidade mínima necessária de:

- Enfermeiros
- Técnicos

O chefe do plantão é contabilizado entre os enfermeiros.

O sistema valida as informações, salva o quantitativo mínimo e confirma a configuração.

Esse valor é utilizado posteriormente para verificar se a escala possui cobertura suficiente no setor.

---

## DA09 - Carga de Plantões por Vínculo

A Coordenação seleciona o tipo de vínculo:

- Concursado
- CLT
- RPA

Em seguida, informa:

- Carga de plantões de 24 horas
- Carga de plantões de 12 horas
- Quantidade máxima de extras por profissional no mês

O vínculo **RPA não possui carga fixa**.

O sistema valida as informações, salva a configuração da carga de plantões e confirma a operação.

---

## DA10 - Limite de Trocas

A Coordenação informa a quantidade máxima de trocas de plantão permitidas por profissional em determinado período.

O sistema valida o valor, salva a configuração e confirma a operação.

Essa configuração limita novas solicitações de troca, enquanto a aprovação final das trocas continua sob responsabilidade da Coordenação.

---

## DA11 - Geração Automática da Escala

O Administrador acessa a funcionalidade de geração automática, informa o setor e o período desejados e solicita a geração da escala.

O sistema recebe os parâmetros e valida as informações inseridas. Caso os dados sejam inválidos, exibe uma mensagem de erro indicando o campo incorreto para correção pelo usuário.

Quando os dados são válidos, o sistema consulta no banco de dados os profissionais disponíveis, suas restrições e vínculos. Em seguida, o sistema processa e considera as restrições dos profissionais, aplica as regras específicas de cada vínculo e gera a escala em rascunho.

A escala em rascunho é salva no banco de dados, o salvamento é confirmado e o sistema permite que o Administrador visualize a escala gerada.

---

## DA12 - Criação Manual da Escala

O Administrador acessa a criação manual da escala, seleciona o profissional e define o setor, o turno e a função no plantão, confirmando e enviando os dados.

O sistema recebe as informações e verifica se os dados inseridos são válidos. Se houver inconsistência nos campos, exibe uma mensagem de erro indicando o campo inválido.

Estando os dados válidos, o sistema consulta a disponibilidade e os plantões do profissional no banco de dados para verificar se existe conflito de alocação.

Se for identificado um conflito, a alocação é impedida, um alerta é emitido e o Administrador visualiza o conflito. Caso não haja conflito, o plantão é incluído na escala em rascunho e salvo no banco de dados. O sistema confirma a inclusão e exibe a confirmação do plantão para o Administrador.

---

## DA13 - Validação de Conflitos da Escala

O Administrador acessa a validação de conflitos, seleciona a escala desejada e solicita a verificação.

O sistema recebe a solicitação e consulta no banco de dados as informações de plantões, disponibilidades e folgas.

Com os dados retornados, o sistema executa uma sequência de verificações: choque de horários, indisponibilidades cadastrais, concessão de folgas e o cumprimento do quantitativo mínimo.

Caso sejam encontrados conflitos, o sistema os indica na escala e exibe os problemas para o Administrador. Caso não existam conflitos, a escala é marcada como validada, seu status é atualizado no banco de dados e a confirmação da validação é apresentada ao Administrador.

---

## DA14 - Edição da Escala

O Administrador acessa a edição da escala, seleciona os plantões que deseja alterar, realiza as modificações necessárias e confirma o envio.

O sistema recebe as alterações e valida as informações fornecidas. Se algum campo estiver incorreto, exibe uma mensagem de erro indicando o problema.

Se os dados forem válidos, os plantões alterados são salvos no banco de dados. Em seguida, o sistema cria e salva uma nova versão da escala, registra a alteração no histórico e confirma a edição para o Administrador.

---

## DA15 - Visualização da Escala Geral

O Administrador acessa a escala geral. O sistema recebe a solicitação, busca a escala completa no banco de dados, monta a visualização e exibe a escala geral.

O Administrador pode optar por aplicar filtros. Caso opte por não filtrar, o fluxo é encerrado na visualização completa.

Caso deseje filtrar, o Administrador informa o setor e/ou o profissional e solicita a aplicação dos filtros. O sistema recebe os parâmetros, consulta os plantões correspondentes no banco de dados, monta a escala filtrada e a exibe ao Administrador.

---

## DA16 - Visualização da Escala Individual

O Enfermeiro acessa a escala individual. O sistema recebe a consulta, identifica o enfermeiro autenticado e busca no banco de dados os seus plantões.

O sistema verifica se existem plantões escalados para o profissional no período.

Se houver plantões, o sistema os exibe para o Enfermeiro. Caso contrário, apresenta uma mensagem informativa comunicando a ausência de plantões escalados.

---

## DA17 - Visualização dos Detalhes do Plantão

O Usuário acessa a escala e seleciona um plantão específico. O sistema recebe o pedido e consulta as informações detalhadas no banco de dados.

O sistema verifica se o plantão foi encontrado.

Se o plantão for localizado, exibe os detalhes contendo data, horário, setor, função e observações. Se o plantão não for encontrado, exibe uma mensagem informativa notificando o Usuário.

---

## DA18 - Publicação da Escala

O Administrador acessa a publicação, seleciona a escala desejada e solicita a operação.

O sistema recebe o pedido, consulta os plantões e pendências da escala no banco de dados e realiza a conferência geral.

Se existirem pendências, a publicação é impedida e os alertas de pendência são exibidos ao Administrador.

Se não houver pendências, a escala é tornada oficial, seu status é atualizado no banco de dados como publicada, o salvamento é confirmado e o Administrador visualiza a mensagem de confirmação da publicação.

---

## DA19 - Notificação de Publicações e Alterações

O Sistema NurseFlow detecta automaticamente quando uma escala é publicada ou alterada.

O sistema consulta no banco de dados os enfermeiros afetados pelas mudanças.

Em seguida, o sistema verifica o tipo do evento:
- Se for uma nova **publicação de escala**, o sistema envia um aviso de publicação e o Enfermeiro recebe a notificação.
- Se for uma **alteração na escala**, o sistema envia um aviso informando as mudanças nos plantões e o Enfermeiro recebe a notificação de alteração.

---

## DA20 - Exportação da Escala em PDF

O Administrador acessa a funcionalidade de exportação, seleciona a escala pretendida e solicita a exportação em PDF.

O sistema recebe a solicitação e consulta os dados da escala no banco de dados.

Em seguida, verifica se a escala está pendente de publicação:
- Se a escala ainda não tiver sido publicada, a exportação é impedida e um alerta é emitido para o Administrador.
- Se a escala já estiver publicada, o sistema gera o documento oficial em PDF, prepara a versão para impressão e envio ao RH e à diretoria, e disponibiliza o arquivo para download, permitindo que o Administrador visualize e baixe o PDF.