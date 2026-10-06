# Explicação do Diagrama de Classes — Sistema de Escalas de Plantão

Este documento descreve o diagrama de classes derivado do DER do sistema de escalas de plantão para profissionais da saúde (enfermeiros e técnicos).

## 1. Visão geral

O sistema permite que um **administrador** monte **escalas** mensais compostas por **plantões**, aloque **profissionais da saúde** nesses plantões por **setor** e controle regras como restrições de horário, férias e limites de plantões. Os profissionais podem **solicitar trocas de plantão**, que passam por aceite do colega e aprovação do administrador, e recebem **notificações** sobre o que acontece.

## 2. Hierarquia de usuários

### `Usuario` (abstrata)
Classe base com os dados comuns de acesso e identificação.

| Atributo | Descrição |
|---|---|
| `idUsuario` | Identificador interno |
| `cpf` | CPF (único) |
| `nome`, `email`, `telefone` | Dados de contato |
| `senha` | Credencial de acesso |

Métodos: `autenticar()`, `alterarSenha()`.

### `Administrador`
Especialização de `Usuario`. Gerencia o sistema: cria, publica e finaliza escalas, cadastra restrições, define configurações e aprova trocas.

### `ProfissionalSaude`
Especialização de `Usuario`. Representa quem cumpre os plantões.

| Atributo | Descrição |
|---|---|
| `coren` | Registro profissional (identificador) |
| `formacao` | `ENFERMEIRO` ou `TECNICO` |
| `tipoVinculo` | `CLT`, `RPA` ou `CONCURSADO` |
| `status` | `ATIVO`, `DESATIVADO`, `AFASTADO` ou `FERIAS` |
| `sincronizaAgenda` | Indica se os plantões são sincronizados com a agenda pessoal |

Métodos: `solicitarTroca()`, `aceitarTroca()`, `recusarTroca()`, `consultarPlantoes()`, `sincronizarAgenda()`.

> No DER, a generalização é disjunta (o "d"): um usuário é administrador **ou** profissional da saúde, nunca os dois.

## 3. Classes de escala e plantão

### `Escala`
Representa a escala de um mês/ano.
- Atributos: `idEscala`, `mes`, `ano`, `dataCriacao`, `status`.
- `status` (`StatusEscala`): `RASCUNHO` → `PUBLICADA` → `FINALIZADA`.
- Métodos: `adicionarPlantao()`, `publicar()`, `finalizar()`.

### `Plantao`
Um turno de trabalho dentro de uma escala.
- Atributos: `idPlantao`, `data`, `horarioInicio`, `horarioFim`, `tipo`.
- `tipo` (`TipoPlantao`): `REGULAR` ou `EXTRA`.
- Método: `alocarProfissional()`.

### `Setor`
Local/unidade onde o plantão ocorre.
- Atributos: `idSetor`, `nome`, `descricao`.
- `quantMinEnf` e `quantMinTec`: quantidade mínima de enfermeiros e técnicos exigida no setor, usada para validar se a escala cobre as necessidades.

## 4. Trocas de plantão

### `TrocaPlantao`
Registra o pedido de troca entre dois profissionais.
- Atributos: `idTroca`, `dataSolicitacao`, `status`.
- Associações:
  - `solicitante` (`idOrigem`): profissional que pede a troca.
  - `destinatario` (`idDestino`): profissional que recebe o pedido.
  - `Plantao` envolvido na troca.
- `status` (`StatusTroca`): `PENDENTE` → `ACEITA_ENF` (aceita pelo colega) → `APROVADA_ADMIN`, ou `RECUSADA`.
- Métodos: `aceitar()`, `recusar()`, `aprovar()`.

**Fluxo:**
1. O profissional solicitante cria a troca (`PENDENTE`).
2. O destinatário aceita (`ACEITA_ENF`) ou recusa (`RECUSADA`).
3. O administrador aprova (`APROVADA_ADMIN`) e a alocação do plantão é atualizada.

## 5. Regras e controle de disponibilidade

### `Configuracao`
Parâmetros definidos pelo administrador:
- `quantMaxExtra`: máximo de plantões extras.
- `quantMaxTroca`: máximo de trocas permitidas.
- `quantLimitePlantao`: limite geral de plantões.

### `Restricao`
Impedimento de horário de um profissional, cadastrado pelo administrador.
- Atributos: `idRestricao`, `tipoRestricao`, `diaSemana`, `horarioInicio`, `horarioFim`.

### `Ferias`
Período de férias (`inicio`, `fim`) de um profissional. Existe somente enquanto o profissional existe (composição).

## 6. Notificações

### `Notificacao`
Mensagem enviada a um profissional.
- Atributos: `idNotificacao`, `mensagem`, `dataEnvio`, `lida`.
- Método: `marcarComoLida()`.

## 7. Relacionamentos

| Relação | Cardinalidade | Observação |
|---|---|---|
| `Usuario` ← `Administrador` / `ProfissionalSaude` | Herança | Generalização disjunta |
| `Administrador` → `Configuracao` | 1 para 0..* | "adiciona" |
| `Administrador` → `Escala` | 1 para 0..* | "faz" |
| `Administrador` → `Restricao` | 1 para 0..* | "cadastra" |
| `ProfissionalSaude` → `Restricao` | 1 para 0..* | "tem" |
| `ProfissionalSaude` ◆ `Ferias` | 1 para 0..* | Composição |
| `ProfissionalSaude` → `Notificacao` | 1 para 0..* | "recebe" |
| `Escala` ◆ `Plantao` | 1 para 1..* | Composição, "contém" |
| `Plantao` → `ProfissionalSaude` | 0..* para 0..1 | "aloca" |
| `Plantao` → `Setor` | 0..* para 1 | "ocorre em" |
| `TrocaPlantao` → `ProfissionalSaude` | 0..* para 1 (duas vezes) | Solicitante e destinatário |
| `TrocaPlantao` → `Plantao` | 0..* para 1 | "envolve" |

## 8. Enumerações

| Enum | Valores |
|---|---|
| `Formacao` | `ENFERMEIRO`, `TECNICO` |
| `TipoVinculo` | `CLT`, `RPA`, `CONCURSADO` |
| `StatusProfissional` | `ATIVO`, `DESATIVADO`, `AFASTADO`, `FERIAS` |
| `StatusEscala` | `RASCUNHO`, `PUBLICADA`, `FINALIZADA` |
| `TipoPlantao` | `REGULAR`, `EXTRA` |
| `StatusTroca` | `PENDENTE`, `ACEITA_ENF`, `APROVADA_ADMIN`, `RECUSADA` |

## 9. Decisões de modelagem e pontos em aberto

- **Atributos de domínio fechado** do DER (formação, vínculo, status, tipo) viraram enums.
- **`id_origem` e `id_destino`** da troca viraram associações com `ProfissionalSaude`, em vez de inteiros soltos.
- **Métodos** são sugestões baseadas nos relacionamentos; o DER não os define.
- **Aprovação da troca:** o status `APROVADA_ADMIN` indica participação do administrador, mas o DER só liga a troca ao profissional. Pode-se adicionar uma associação `TrocaPlantao → Administrador` para registrar quem aprovou.
- **Cardinalidade de "aloca":** a notação do DER é ambígua; foi interpretada como um plantão com no máximo um profissional.
- **Identificadores:** os `id_*` foram mantidos como atributos. Em uma implementação orientada a objetos, alguns podem ficar apenas no mapeamento para o banco.