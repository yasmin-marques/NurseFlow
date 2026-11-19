# NurseFlow - Diagramas de Atividade

## DA01 - Autenticação e controle de acesso

Para entrar, o usuário seleciona o perfil de Coordenação, Enfermeiro ou Técnico, informa o e-mail profissional e a senha e clica em **Entrar**.

- Se as credenciais e o perfil forem válidos, o sistema identifica o perfil, libera as funcionalidades correspondentes e redireciona o usuário.
- Se a validação falhar, o sistema registra a tentativa. Após falhas sucessivas, pode bloquear temporariamente novas tentativas de acesso.

O usuário também pode solicitar a recuperação da senha.

---

## DA02 - Cadastro de profissional

A Coordenação cadastra um enfermeiro ou técnico com nome completo, CPF, COREN, formação, tipo de vínculo e status.

O sistema valida os campos e verifica se o CPF ou o COREN já está em uso. Se houver duplicidade, exibe um aviso e não conclui o cadastro. Caso contrário, salva os dados, confirma a operação e disponibiliza o profissional para escalas ainda não publicadas.

---

## DA03 - Consulta e edição de profissional

A Coordenação pesquisa um profissional por nome, CPF ou COREN. Pode filtrar por formação, status e vínculo, além de ordenar os resultados.

Se a busca não retornar registros, o sistema informa que nenhum profissional foi encontrado. Se encontrar o profissional, exibe seus dados e permite que a Coordenação os edite.

Quando há edição, o sistema valida as informações, salva os novos dados, registra a alteração no histórico e a aplica às escalas ainda não publicadas.

---

## DA04 - Desativação de profissional

A Coordenação seleciona um profissional, muda seu status para **Desativado** e solicita o salvamento. Antes de confirmar, o sistema verifica se ele está alocado a algum plantão futuro já publicado.

- **Com plantões futuros publicados.** O sistema bloqueia a desativação e mostra quais plantões precisam de cobertura.
- **Sem plantões futuros publicados.** O sistema desativa o profissional e deixa de incluí-lo em novas escalas. O histórico e os registros nas escalas já publicadas são preservados.

---

## DA05 - Disponibilidade e restrições

A Coordenação seleciona um profissional e informa o tipo de restrição, a validade e, quando for o caso, o turno permitido. Se escolher a regra **Não escalar nos dias marcados**, também indica os dias da semana em que o profissional está indisponível.

O sistema valida e salva a restrição, que passa a ser considerada nos próximos rascunhos de escala.

---

## DA06 - Férias e ausências

A Coordenação registra a ausência do profissional com data de início, data de retorno e motivo, como férias, licença médica, atestado médico ou outro.

Depois de validar e salvar o período, o sistema bloqueia a alocação do profissional enquanto ele estiver ausente. Também consulta os plantões afetados, calcula a cobertura por setor e sinaliza aqueles que ficarem com equipe insuficiente. Na escala, o período aparece como ausência.

---

## DA07 - Cadastro de setores hospitalares

A Coordenação informa o nome e a descrição do setor, assim como o quantitativo inicial de enfermeiros e técnicos para cada turno, diurno e noturno.

O sistema valida os dados e verifica se já existe outro setor com o mesmo nome. Se houver duplicidade, apresenta um aviso. Se o nome estiver disponível e os dados forem válidos, salva o setor e confirma o cadastro.

---

## DA08 - Quantitativo mínimo por setor

A Coordenação escolhe o setor e o turno (diurno ou noturno) e define o mínimo de enfermeiros e o mínimo de técnicos. O chefe do plantão entra na contagem de enfermeiros.

O sistema valida os valores, salva a configuração e confirma a operação. Esses mínimos são usados para verificar se a escala oferece cobertura suficiente no setor.

---

## DA09 - Carga de plantões por vínculo

A Coordenação escolhe o tipo de vínculo (Concursado, CLT ou RPA) e configura a carga de plantões de 24 e de 12 horas, além do máximo mensal de plantões extras por profissional. O vínculo RPA não tem carga fixa.

O sistema valida os dados, salva a configuração e confirma a operação.

---

## DA10 - Limite de trocas

A Coordenação define o número máximo de trocas de plantão permitido para cada profissional em um determinado período. O sistema valida o limite, salva a configuração e confirma a operação.

A regra restringe novas solicitações de troca. A aprovação final continua sendo responsabilidade da Coordenação.

---

## DA11 - Geração automática de escala

O Administrador seleciona o mês, os setores e os turnos e solicita a geração da escala. Se algum parâmetro for inválido, o sistema indica o campo que precisa de correção.

Com os parâmetros válidos, o sistema consulta os profissionais disponíveis, suas restrições e seus vínculos. Ao montar a escala, considera as restrições de cada profissional e as regras do vínculo correspondente. O resultado é salvo no banco de dados como **rascunho** e fica disponível para o Administrador visualizar após a confirmação do salvamento.

---

## DA12 - Criação manual de escala

O Administrador seleciona o profissional, define o setor, o turno e a função no plantão e confirma a inclusão. Se os dados não forem válidos, o sistema indica o campo incorreto.

Com os dados válidos, o sistema consulta a disponibilidade e os plantões do profissional para verificar se a alocação é possível.

- **Se houver conflito**, o sistema bloqueia a inclusão e mostra ao Administrador o motivo do alerta.
- **Se não houver conflito**, o plantão é incluído no rascunho da escala e salvo no banco de dados. O sistema então confirma a inclusão ao Administrador.

---

## DA13 - Validação de conflitos da escala

O Administrador seleciona a escala e solicita a validação. O sistema consulta os plantões, as disponibilidades e as folgas para verificar choques de horários, indisponibilidades cadastradas, concessão de folgas e cumprimento do quantitativo mínimo.

Se encontrar conflitos, o sistema os sinaliza na escala e mostra os problemas ao Administrador. Se não encontrar conflitos, atualiza o status da escala para **validada** no banco de dados e confirma a validação.

---

## DA14 - Edição de escala

O Administrador seleciona os plantões que deseja editar, faz as mudanças e envia os dados. Se algum campo estiver incorreto, o sistema informa qual é o problema. Se os dados forem válidos, salva os plantões alterados, registra a edição no histórico e confirma a operação.

Se a escala já estiver publicada, a edição ocorre em uma **revisão**. Uma nova versão oficial só é gerada quando essa revisão é publicada.

---

## DA15 - Visualização da escala geral

Ao abrir a escala geral, o Administrador vê a escala completa que o sistema carrega do banco de dados.

Se quiser restringir a visualização, pode aplicar um filtro por setor, por profissional ou pelos dois. O sistema busca os plantões que correspondem aos filtros e exibe a escala filtrada. Sem filtros, o fluxo termina na visualização completa.

---

## DA16 - Visualização da escala individual

O Profissional abre a escala individual. O sistema identifica o profissional autenticado e consulta os plantões dele no período.

Se houver plantões, eles são exibidos. Se não houver, o sistema informa que não existem plantões escalados para o período.

---

## DA17 - Visualização dos detalhes do plantão

O usuário abre a escala e seleciona um plantão. O sistema busca o registro no banco de dados e, se o encontrar, exibe data, horário, setor, função e observações. Se não encontrar o plantão, informa isso ao usuário.

---

## DA18 - Publicação de escala

O Administrador seleciona a escala e solicita a publicação. Antes de oficializá-la, o sistema consulta os plantões e confere se existem pendências.

- **Com pendências.** O sistema mostra um resumo e exige confirmação explícita da Coordenação para permitir a publicação.
- **Sem pendências.** O sistema oficializa a escala, salva o status **publicada** no banco de dados e confirma a publicação ao Administrador.

---

## DA19 - Notificação de publicação e alteração

O NurseFlow detecta automaticamente a publicação ou a alteração de uma escala e consulta quais profissionais foram afetados.

- **Nova publicação.** Os profissionais afetados recebem um aviso de que a escala foi publicada.
- **Alteração na escala.** Os profissionais afetados recebem um aviso com as mudanças em seus plantões.

---

## DA20 - Exportação de escala em PDF

O Administrador seleciona uma escala e solicita a exportação. O sistema consulta os dados e verifica o status da publicação.

- **Escala ainda não publicada.** O sistema bloqueia a exportação e avisa o Administrador.
- **Escala publicada.** O sistema gera o PDF oficial para impressão e envio ao RH e à diretoria. O Administrador pode visualizar e baixar o arquivo.

---

## DA21 - Solicitação de troca de plantão

O Profissional seleciona um de seus próprios plantões e pede para consultar quem pode realizar a troca. O sistema verifica os dados do plantão, os profissionais cadastrados e aptos, suas disponibilidades e restrições e o limite de trocas no período.

Se a troca não atender a alguma regra, o sistema informa o motivo do impedimento. Se for permitida, o sistema mostra os profissionais aptos. O solicitante escolhe um deles e confirma o envio. A solicitação é registrada como **Pendente de resposta**, e o sistema confirma sua criação.

---

## DA22 - Aceitação ou recusa de troca

O Profissional abre uma solicitação de troca recebida, confere os detalhes e decide se aceita ou recusa.

- **Se recusar**, o sistema muda o status para **Recusada** e confirma a operação.
- **Se aceitar**, o sistema revalida a troca considerando a situação atual da escala, a disponibilidade e as restrições dos envolvidos. Se encontrar um impedimento, informa o motivo. Se a troca continuar válida, atualiza o status da solicitação para **Aceita / Aguardando Coordenação**, deixando-a disponível para a validação final.

---

## DA23 - Validação da troca pela Coordenação

A Coordenação analisa as solicitações que já foram aceitas pelos profissionais e estão aguardando validação. O sistema consulta os dados da solicitação, os plantões, os profissionais envolvidos, suas disponibilidades e restrições e a situação atual da escala.

Se houver impedimentos, o sistema os apresenta à Coordenação, que pode rejeitar a solicitação. Se não houver impedimentos, a Coordenação pode aprová-la. Após a aprovação, o sistema efetiva a troca, atualiza a escala, registra a mudança no histórico e altera o status da solicitação para **Aprovada**.

---

## DA24 - Registro manual de troca de plantão

A Coordenação pode registrar uma troca que ocorreu fora do fluxo de solicitações. Para isso, seleciona os profissionais e plantões envolvidos e preenche os dados necessários.

O sistema consulta os dados dos profissionais e dos plantões, verifica as disponibilidades e restrições e considera o limite de trocas aplicável. Se a operação for inválida, apresenta os impedimentos e não altera a escala. Se for válida, registra a troca manual, atualiza a escala oficial e guarda a alteração no histórico.

---

## DA25 - Consulta ao histórico de escalas e trocas

A Coordenação consulta as versões das escalas, as alterações e as trocas de plantão. Pode filtrar os registros por critérios como período, profissional ou tipo de registro.

Se a busca não retornar registros, o sistema informa que não encontrou resultados. Caso contrário, exibe os registros e permite abrir cada um para consultar seus detalhes e acompanhar ou auditar as mudanças.

---

## DA26 - Gerenciamento de plantões extras

O sistema mostra à Coordenação os plantões extras já cadastrados e os plantões que precisam de cobertura, inclusive os afetados por férias ou ausências. A Coordenação pode escolher um plantão descoberto ou programar um novo extra com data, horário e setor.

O sistema consulta os profissionais aptos e disponíveis, considerando as restrições e as regras de alocação. Depois que a Coordenação seleciona um profissional, o sistema valida a atribuição.

- **Com conflito ou restrição.** O sistema impede a atribuição e mostra o motivo.
- **Com atribuição válida.** O sistema registra o plantão como **Extra**, associa o profissional, inclui o plantão na escala e registra a operação no histórico.

---

## DA27 - Sincronização com calendário externo

O Profissional solicita o envio dos seus plantões para o calendário pessoal. O NurseFlow identifica o profissional autenticado, consulta seus plantões e prepara os dados para enviar ao serviço externo.

- Se não houver um evento para o plantão, é criado um novo evento.
- Se já houver um evento correspondente, suas informações são atualizadas.

Ao receber o resultado do serviço externo, o sistema confirma a sincronização ou informa o erro ao Profissional.