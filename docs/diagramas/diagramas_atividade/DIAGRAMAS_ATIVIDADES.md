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