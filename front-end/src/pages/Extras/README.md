# Fluxo de Extras programados

1. Em **Extras**, selecione o mês e use **Registrar extra**. Escolha data civil, jornada (`12d`, `12n` ou `24h`), setor, função, motivo e substituto. Motivos de cobertura exigem também o profissional coberto; reforço não exige esse campo.
2. O formulário envia os dados à API NestJS. A tela só fecha e recarrega depois de uma resposta bem-sucedida. Erros de validação (`422`), concorrência (`409`), permissão ou indisponibilidade permanecem visíveis no drawer e preservam os campos preenchidos.
3. Extras programados aparecem com o estado `sem_escala`, `pendente_conciliacao` ou `vinculado`. Em escala editável, a geração/regeneração faz a conciliação; escalas oficiais não podem ser alteradas diretamente.
4. Use **Editar** para salvar uma nova revisão. Se outra operação tiver alterado o registro, a API rejeita a revisão obsoleta sem sobrescrever os dados persistidos.
5. Use **Cancelar** para informar uma justificativa. O registro permanece no histórico, mas deixa de aparecer nos indicadores ativos e não pode ser cancelado novamente.
6. **Cadastrar RPA** reutiliza `POST /profissionais` com `tipoVinculo = rpa`. CPF/COREN/e-mail duplicados são tratados pela API; um cadastro aceito fica disponível como substituto após a atualização da lista.
