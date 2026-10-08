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

---

## DA21 - Solicitação de Troca de Plantão

O Enfermeiro acessa a funcionalidade de troca de plantão, seleciona um de seus próprios plantões e solicita a consulta de profissionais disponíveis para realizar a troca.

O sistema consulta no banco de dados as informações do plantão, os profissionais cadastrados e aptos, suas disponibilidades e restrições, além do limite de trocas configurado para o período.

Caso a troca não atenda às regras definidas, o sistema informa o motivo do impedimento ao Enfermeiro.

Quando a troca é permitida, o sistema apresenta os profissionais aptos. O Enfermeiro seleciona o profissional desejado e confirma a solicitação.

A solicitação é então registrada no banco de dados com status de **Pendente de resposta**, e o sistema confirma sua criação ao Enfermeiro.

---

## DA22 - Aceitação ou Recusa da Troca

O Enfermeiro acessa as solicitações de troca recebidas. O sistema consulta no banco de dados as solicitações pendentes destinadas ao profissional e as apresenta para análise.

O Enfermeiro seleciona uma solicitação, visualiza seus detalhes e decide entre aceitar ou recusar a troca.

- Se a solicitação for recusada, o sistema atualiza seu status para **Recusada** e confirma a operação.
- Se a solicitação for aceita, o sistema verifica se a troca continua válida conforme as condições atuais da escala, disponibilidade e restrições dos profissionais.

Caso a troca não seja mais válida, o sistema informa o impedimento ao Enfermeiro.

Quando a solicitação permanece válida, seu status é atualizado para **Aceita / Aguardando Coordenação**, ficando disponível para a validação final da Coordenação.

---

## DA23 - Validação da Troca pela Coordenação

A Coordenação acessa as solicitações de troca que foram aceitas pelos profissionais e aguardam validação.

O sistema consulta no banco de dados as informações da solicitação, os plantões envolvidos, os profissionais, suas disponibilidades e restrições e os dados atuais da escala.

Após a consulta, o sistema verifica se existem impedimentos para a realização da troca.

- Se houver impedimentos, eles são apresentados à Coordenação, que pode rejeitar a solicitação. Nesse caso, o status é atualizado para **Rejeitada pela Coordenação**.
- Se não houver impedimentos, a Coordenação pode aprovar a troca.

Quando aprovada, o sistema efetiva a alteração dos plantões, atualiza a escala, registra a modificação no histórico e altera o status da solicitação para **Aprovada**.

---

## DA24 - Registro Manual de Troca de Plantão

A Coordenação acessa a funcionalidade de registro manual de troca para cadastrar uma troca realizada fora do fluxo normal de solicitações do sistema.

São selecionados os profissionais e os plantões envolvidos, e os dados da troca são informados para validação.

O sistema consulta no banco de dados os profissionais, os plantões, as disponibilidades, as restrições e o limite de trocas aplicável.

Caso a troca não seja válida, o sistema apresenta os impedimentos encontrados e não realiza a alteração.

Se a troca for válida, o sistema registra a operação como uma **troca realizada manualmente**, atualiza a escala oficial e registra a modificação no histórico.

---

## DA25 - Consulta do Histórico de Escalas e Trocas

A Coordenação acessa o histórico de escalas e trocas e pode informar filtros para localizar os registros desejados, como período, profissional ou tipo de registro.

O sistema consulta no banco de dados o histórico de versões das escalas, alterações realizadas e trocas de plantão.

Caso nenhum registro seja encontrado, uma mensagem informativa é apresentada.

Quando existem resultados, o sistema exibe os registros encontrados. A Coordenação pode selecionar um item específico para visualizar seus detalhes, permitindo o acompanhamento das alterações e a auditoria do histórico do sistema.

---

## DA26 - Gerenciamento de Plantões Extras

A Coordenação acessa o gerenciamento de plantões extras. O sistema consulta no banco de dados os extras já cadastrados e os plantões que apresentam necessidade de cobertura, como aqueles afetados por férias ou ausências.

A Coordenação pode selecionar um plantão descoberto ou criar um novo plantão extra programado, informando data, horário e setor.

O sistema consulta os profissionais aptos e disponíveis, considerando suas restrições e as regras de alocação.

Após a seleção de um profissional, o sistema valida a atribuição:

- Se existir conflito ou restrição, a operação é impedida e o motivo é apresentado.
- Se a atribuição for válida, o plantão é registrado como **Extra**, associado ao profissional e incluído na escala.

A alteração também é registrada no histórico, e o sistema confirma o plantão extra para a Coordenação.

---

## DA27 - Sincronização com Calendário Externo

O Enfermeiro acessa a funcionalidade de sincronização com calendário externo e solicita o envio de seus plantões para o calendário pessoal.

O sistema identifica o Enfermeiro autenticado e consulta no banco de dados os seus plantões.

Em seguida, prepara as informações e envia os dados para o serviço de calendário externo.

Para cada plantão:

- Se ainda não existir um evento correspondente, um novo evento é criado.
- Se o evento já existir, suas informações são atualizadas.

Ao final, o serviço externo retorna o resultado da sincronização.

Caso ocorra alguma falha, o sistema informa o erro ao Enfermeiro. Se a sincronização for concluída com sucesso, o sistema apresenta a confirmação da operação.

