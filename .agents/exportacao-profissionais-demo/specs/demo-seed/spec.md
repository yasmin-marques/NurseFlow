# Spec Delta

## Purpose

Fornece dados fictícios e idempotentes para demonstração e teste local, com volume e variedade suficientes para exercitar listagem, filtros, exportação e restrições.

## ADDED Requirements

### Requirement: Profissionais de demonstração
O seed SHALL criar 1 coordenação e 27 profissionais de saúde, cada um com usuário vinculado e COREN fictício único no formato `CE-10001` a `CE-10027`.

#### Scenario: Distribuição dos profissionais
- **WHEN** o seed é executado em um banco vazio
- **THEN** existem 13 enfermeiros e 14 técnicos
- **AND** 10 concursados, 10 CLT e 7 RPA
- **AND** 19 ativos, 3 em férias, 3 afastados e 2 desativados

#### Scenario: Data de desativação
- **WHEN** um profissional é criado com situação `desativado`
- **THEN** `desativadoEm` recebe a data de criação
- **AND** para as demais situações `desativadoEm` é nulo

#### Scenario: Identificadores válidos e únicos
- **WHEN** o seed conclui
- **THEN** existem 28 usuários com CPF de dígitos verificadores válidos, CPFs e e-mails únicos e e-mails terminados em `.test`
- **AND** os 27 COREN são únicos
- **AND** cada profissional referencia um usuário do tipo `profissionalDaSaude`
- **AND** a coordenação possui exatamente um registro em `administradores`

### Requirement: Restrições de demonstração de outubro de 2026
O seed SHALL criar 16 restrições para profissionais existentes e não desativados, incluindo as 7 novas para Mariana, Valter, Nicolas, Olívia, João, Tiago e Yara, documentadas no README.

#### Scenario: Restrições coerentes
- **WHEN** o seed conclui
- **THEN** existem 16 restrições, todas referenciando profissionais existentes
- **AND** nenhuma pertence a profissional com situação `desativado`

#### Scenario: Restrições alinhadas à situação
- **WHEN** um profissional novo está em `ferias` ou `afastado` (Mariana, Valter, Nicolas, Olívia)
- **THEN** existe uma restrição de férias ou ausência cobrindo o período indicado no README

### Requirement: Execução idempotente
O seed MUST poder ser executado repetidamente sem duplicar nem alterar registros existentes.

#### Scenario: Reexecução
- **WHEN** o seed é executado novamente sobre o mesmo banco
- **THEN** as contagens de usuários, profissionais, restrições, setores e configurações permanecem iguais
- **AND** os profissionais existentes permanecem inalterados

### Requirement: Proteções de ambiente e senhas
O seed MUST recusar gravar quando desabilitado, quando executado em produção sem autorização explícita ou quando a senha dos profissionais for inválida.

#### Scenario: Seed desabilitado
- **WHEN** `DEMO_SEED_ENABLED` não é `true`
- **THEN** nada é gravado

#### Scenario: Produção sem autorização
- **WHEN** `NODE_ENV=production` e `ALLOW_DEMO_IN_PRODUCTION` não é `true`
- **THEN** o seed falha com erro mencionando `NODE_ENV=production` e nada é gravado

#### Scenario: Senha de profissional curta
- **WHEN** `DEMO_PRO_PASSWORD` é curta demais
- **THEN** o seed falha com erro mencionando `DEMO_PRO_PASSWORD` e nada é gravado

### Requirement: Script testável
O script do seed SHALL exportar `PEOPLE`, `cpf` e `seed` e só executar automaticamente quando invocado diretamente.

#### Scenario: Importar no teste
- **WHEN** um teste importa `scripts/seed-demo.js`
- **THEN** o seed não é executado até que `seed()` seja chamado

### Requirement: Documentação dos dados de demonstração
O README SHALL listar os logins dos profissionais com perfil, formação, vínculo e situação, as restrições de outubro de 2026 e a ação de exportação.

#### Scenario: README alinhado ao seed
- **WHEN** a documentação é consultada
- **THEN** a tabela de logins, a tabela de restrições e a seção "Exportação de profissionais (Excel)" refletem os dados e o comportamento implementados
