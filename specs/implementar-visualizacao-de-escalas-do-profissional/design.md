# Design

## Context

Levantamento do checkout:

- `front-end/src/App.tsx` escolhe a página por estado (`activeItem`), sem roteador. `escala` só renderiza `ScalePage` para `coordenacao`; os demais perfis caem no placeholder.
- O único layout é `AppLayout` (com `SideMenu` lateral e `TopBar`). Os protótipos do profissional usam **navegação no topo** (Início / Meus plantões / Escala geral / Trocas), então é necessário um layout novo.
- `SessionUser` (`/auth/me`) devolve `id, nome, email, perfil`. No back-end `UsuarioAutenticado.profissionalId` existe para Enfermeiro/Técnico.
- `EscalasController` tem `@Perfis(Perfil.COORDENACAO)` na classe, então nenhum de seus endpoints serve ao profissional. `NotificacoesEscalaController` (sem restrição de perfil) é o precedente.
- A escala oficial vive em `VersaoEscala.snapshot` (imutável) com `plantoes` e `profissionaisRelacionados`; `EscalasService` já resolve nomes de profissionais e setores a partir do snapshot (`montarResposta`, `snapshotComVisualizacao`). `PlantaoProfissional` tem `funcao`, `lideranca` e `origemCobertura` (regular / restrição / complementar); `Plantao` tem `tipo` (regular/extra), `duracaoHoras`, horários e `data` (00:00 UTC do dia de início).

## Referências visuais revisadas

| Estado | Arquivo em `design/nurseflow/` |
| --- | --- |
| Meus plantões — Próximos | `NurseFlow Web - Escada Própria (Próxima).png` |
| Meus plantões — Anteriores | `NurseFlow Web - Escada Própria (Anterior).png` |
| Escala geral (semana) | `NurseFlow Web - Escala Geral.png` |
| Escala geral — detalhes do dia | `NurseFlow Web - Escala Geral (Detalhes).png` |
| Marcador de rolagem | `Frame 4.png` ("SCROLL HERE": a lista do modal rola internamente) |

Usar como referência de UI/UX (hierarquia, tokens verde/branco, cartões arredondados, selos), reutilizando tokens e componentes existentes (`Drawer`/diálogos, `NotificationCenter`, helpers de calendário). Lacunas: nenhum estado de carregamento/erro/vazio; "Google Agenda" e "Trocas 1" são mostrados sem comportamento definido.

## Goals / Non-Goals

**Goals:** consulta confiável e somente leitura dos próprios plantões e da escala da equipe, sobre a versão publicada, sem dados pessoais.

**Non-Goals:** Google Agenda, Trocas do profissional (RF015/RF016), edição, exportação, notificações novas, migrações.

## Decisions

### Controller de leitura separado, sem `@Perfis`

`EscalaProfissionalController` (`@Controller('escala-profissional')`, sem `@Perfis`; só JWT global). Um helper verifica `usuario.profissionalId` e lança `ForbiddenException` quando ausente. Caminho próprio evita colisão com `GET /escalas/:id`. Alternativa descartada: afrouxar `@Perfis` em `versao-oficial`, que exporia dados pessoais e a escala inteira completa.

### Contratos

```text
GET /escala-profissional/meus-plantoes?situacao=proximos|anteriores&pagina=&limite=
// Próximos: crescente (janela de 12 meses à frente). Anteriores: do mais recente ao mais antigo (janela de 24 meses).
200 { itens: [{
        plantaoId, data, horarioInicio, horarioFim, duracaoHoras,
        tipo: "regular"|"extra", setor: {id,nome},
        funcao, lideranca, status: "trabalhando"|"trabalhado",
        chefe: { nome } | null,
        enfermeiros: [{ nome, lideranca }], tecnicos: [{ nome }]   // demais integrantes
      }], pagina, limite, total, totalPaginas }

GET /escala-profissional/geral?ano=2026&mes=11
200 { ano, mes, publicada, versao:{numero,publicadoEm}|null,
      dias: [{ data, turnos:[{ turno:"diurno"|"noturno"|"24h", horarioInicio, horarioFim }],
               chefe:{nome}|null, setores:[nome] }] }

GET /escala-profissional/geral/dia?data=2026-11-10
200 { data, publicada, chefe:{nome, setores:[nome], regime}|null,
      enfermeiros:[{nome, cargo, setores:[nome], regime}],
      tecnicos:[{nome, cargo, setores:[nome], regime}], contagens:{enfermeiros, tecnicos} }
401 · 403 sem profissionalId · 400 parâmetros inválidos
```

`regime` = rótulo derivado: "24 horas · 07h—07h", "Diurno · 07h—19h · restrição" (origem restrição), "Noturno · 19h—07h · cobertura" (origem complementar). Nomes e contratos acima são propostos; confirmar contra o DTO final ao implementar. Em nenhum contrato existe parâmetro de profissional.

### Fonte de dados

Para os meses necessários, ler a `VersaoEscala` de maior `numero` por escala `(ano, mes)` e filtrar/juntar `plantoes` e `profissionaisRelacionados` do snapshot (não depender de `visualizacao`, que snapshots antigos podem não ter). "Meus plantões" percorre meses a partir do mês corrente para frente (Próximos) ou para trás (Anteriores) com cursor, limitando a janela. O selo/aba é calculado no servidor por `data + horarioFim` (considerando virada de dia) vs. agora. Reutilizar/extrair o resolvedor de nomes e setores do serviço; serializar apenas nome, função, liderança, setor e rótulos de regime. Sem índices novos (conferir ao implementar).

### Privacidade

Sem CPF, COREN, e-mail, telefone ou restrições (apenas o rótulo "restrição"/"cobertura" por origem). Testes e2e verificam a ausência dessas chaves.

### Front-end

- `ProfessionalLayout` com barra superior (marca, abas, sino via `NotificationCenter`, nome/perfil), responsivo (abas roláveis/menu em telas estreitas). `App.tsx` usa-o para Enfermeiro/Técnico; `Início` mantém `OverviewPage`; `Trocas` exibe estado "em preparação" sem contador (o "1" do protótipo é ilustrativo).
- `pages/MyShifts/MyShiftsPage.tsx`: abas Próximos/Anteriores (`role="tablist"`), cartões conforme protótipo, "carregar mais" nas Anteriores.
- `pages/GeneralSchedule/GeneralSchedulePage.tsx`: seletor de mês, navegação semanal, grade de cartões (2 colunas, o sétimo ocupa a linha), modal com cabeçalho fixo e corpo com `overflow-y-auto`, foco preso e retorno ao cartão.
- Botão **Google Agenda**: renderizado conforme o protótipo, porém `disabled` (com `aria-disabled` e dica textual "Em breve"), sem chamada de rede. A sincronização é follow-up junto de `sincronizaAgenda`.
- Datas formatadas em UTC para evitar deslocar o dia.

## Risks / Trade-offs

- **Visão geral de toda a equipe** → decisão de produto confirmada; limitada a nome/cargo/setor/regime, sem dados pessoais.
- **Chefe do dia** → decisão confirmada: derivado de `lideranca = true`; se houver mais de um ou nenhum, mostrar o primeiro por ordem estável ou ocultar o campo.
- **Snapshots antigos** → montar a partir de `plantoes`/`profissionaisRelacionados` crus.
- **Fuso e virada de dia** → regra de "encerrado" no servidor com testes de borda.
- **Troca aprovada gera nova versão** → refletida automaticamente por ler a última versão.
- **Layout adicional** → mais um shell a manter; manter pequeno e reutilizar tokens.

## Migration Plan

Sem migração de dados. Entrega aditiva (API + telas juntas). Rollback: remover rotas e restaurar o placeholder para perfis não administrativos.
