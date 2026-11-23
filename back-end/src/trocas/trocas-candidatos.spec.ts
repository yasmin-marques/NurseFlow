import { Types } from 'mongoose';
import { TrocasService } from './trocas.service';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais/profissionais.enums';
import { StatusEscala, TipoPlantao } from '../escalas/schemas';
import { TipoRestricao } from '../restricoes/restricao.schema';

type Item = Record<string, any>;

class QueryFake {
  private getResult: () => any;
  constructor(getResult: () => any) { this.getResult = getResult; }
  lean() { return this; }
  select() { return this; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  session() { return this; }
  exec() { return Promise.resolve(this.getResult()); }
}

function corresponde(item: Item, filtro: Item = {}) {
  for (const [campo, valor] of Object.entries(filtro)) {
    if (campo === '$or') {
      if (!(valor as Item[]).some((parte) => corresponde(item, parte))) return false;
      continue;
    }
    if (valor && typeof valor === 'object' && '$in' in valor) {
      if (!(valor as any).$in.some((v: any) => String(v) === String(item[campo]))) return false;
      continue;
    }
    if (campo === 'inicio' || campo === 'fim') continue;
    if (String(item[campo]) !== String(valor)) return false;
  }
  return true;
}

function collection(items: Item[]) {
  return {
    find: (filtro: Item = {}) => new QueryFake(() => items.filter((item) => corresponde(item, filtro))),
    findById: (id: any) => new QueryFake(() => items.find((item) => String(item._id) === String(id)) ?? null),
    findOne: (filtro: Item = {}) => new QueryFake(() => items.find((item) => corresponde(item, filtro)) ?? null),
    countDocuments: (filtro: Item = {}) => new QueryFake(() => items.filter((item) => {
      if (filtro.status && String(item.status) !== String(filtro.status)) return false;
      if (filtro.$or) return filtro.$or.some((parte: Item) => corresponde(item, parte));
      return corresponde(item, filtro);
    }).length),
  };
}

function regraNormalizada(codigo: string, mensagem: string) {
  if (codigo === 'COMPETENCIAS_DIFERENTES' || codigo === 'ESCALAS_DIFERENTES') return 'TROCA_ENTRE_MESES';
  if (codigo === 'COBERTURA_INSUFICIENTE') return 'COBERTURA_MINIMA';
  if (codigo === 'PROFISSIONAL_INATIVO') return 'PROFISSIONAL_INATIVO';
  if (mensagem.includes('formação') || mensagem.includes('categoria') || codigo === 'CATEGORIA_DIFERENTE') return 'CATEGORIA_DIFERENTE';
  if (mensagem.includes('já está escalado')) return 'JA_ESCALADO_NO_DIA';
  if (mensagem.includes('descanso') || mensagem.includes('sobreposto') || mensagem.includes('intervalo insuficiente')) return 'DESCANSO';
  if (mensagem.includes('turno') || mensagem.includes('indisponível') || mensagem.includes('não pode fazer')) return 'RESTRICAO_TURNO_DATA';
  if (mensagem.includes('carga regular') || mensagem.includes('horas')) return 'CARGA_HORARIA';
  if (mensagem.includes('extras')) return 'LIMITE_EXTRAS';
  if (mensagem.includes('limite total') || mensagem.includes('RPA')) return 'CARGA_MENSAL';
  if (mensagem.includes('cobertura') || codigo === 'COBERTURA_INSUFICIENTE') return 'COBERTURA_MINIMA';
  return `${codigo}:${mensagem}`;
}

describe('equivalência completa candidatos antigos x in-memory', () => {
  it('percorre todos os pares do seed e falha listando cada divergência', async () => {
    const escalaA = new Types.ObjectId();
    const escalaAnterior = new Types.ObjectId();
    const setor1 = new Types.ObjectId();
    const setor2 = new Types.ObjectId();
    const profA = new Types.ObjectId();
    const profB = new Types.ObjectId();
    const profC = new Types.ObjectId();
    const profD = new Types.ObjectId();
    const profE = new Types.ObjectId();
    const profF = new Types.ObjectId();
    const usuarioA = new Types.ObjectId();
    const usuarios = [profA, profB, profC, profD, profE, profF].map((id, indice) => ({
      _id: new Types.ObjectId(), usuarioId: id, coren: `${indice}`, formacao: indice === 2 ? Formacao.TECNICO : Formacao.ENFERMEIRO,
      tipoVinculo: TipoVinculo.CLT, status: StatusProfissional.ATIVO,
    }));
    usuarios[0]._id = profA;
    usuarios[1]._id = profB;
    usuarios[2]._id = profC;
    usuarios[3]._id = profD;
    usuarios[4]._id = profE;
    usuarios[5]._id = profF;
    const usuarioDocs = usuarios.map((prof) => ({ _id: prof._id === profA ? usuarioA : new Types.ObjectId(), nome: `Prof ${String(prof._id).slice(-4)}`, profissionalId: prof._id }));
    const profDocs = usuarios.map((prof) => ({ ...prof, usuarioId: usuarioDocs.find((u) => u.profissionalId === prof._id)!._id }));

    const dataBase = new Date('2026-10-20T00:00:00.000Z');
    const plantaoA = { _id: new Types.ObjectId(), escalaId: escalaA, setorId: setor1, data: dataBase, horarioInicio: '19:00', horarioFim: '07:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
    const dataB = new Date('2026-10-14T00:00:00.000Z');
    const plantaoB = { _id: new Types.ObjectId(), escalaId: escalaA, setorId: setor1, data: dataB, horarioInicio: '07:00', horarioFim: '07:00', duracaoHoras: 24, tipo: TipoPlantao.REGULAR };
    const plantaoC = { _id: new Types.ObjectId(), escalaId: escalaA, setorId: setor1, data: new Date('2026-10-23T00:00:00.000Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
    const plantaoD = { _id: new Types.ObjectId(), escalaId: escalaA, setorId: setor2, data: new Date('2026-10-17T00:00:00.000Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
    const plantaoE = { _id: new Types.ObjectId(), escalaId: escalaA, setorId: setor1, data: new Date('2026-10-24T00:00:00.000Z'), horarioInicio: '19:00', horarioFim: '07:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
    const plantaoF = { _id: new Types.ObjectId(), escalaId: escalaA, setorId: setor1, data: new Date('2026-10-20T00:00:00.000Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
    const plantoesBordas = [-4, -3, 3, 4].map((delta) => ({
      _id: new Types.ObjectId(), escalaId: escalaA, setorId: setor1,
      data: new Date(Date.UTC(2026, 9, 20 + delta)),
      horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR,
    }));
    const plantaoAnteriorMes = { _id: new Types.ObjectId(), escalaId: escalaAnterior, setorId: setor1, data: new Date('2026-09-30T00:00:00.000Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
    const plantoes = [plantaoA, plantaoB, plantaoC, plantaoD, plantaoE, plantaoF, ...plantoesBordas, plantaoAnteriorMes];

    const vinculo = (plantao: Item, profissionalId: Types.ObjectId, funcao: Formacao) =>
      ({ _id: new Types.ObjectId(), plantaoId: plantao._id, profissionalId, funcao, lideranca: false, origemCobertura: 'regular' });
    const vinculoA = vinculo(plantaoA, profA, Formacao.ENFERMEIRO);
    const vinculoB = vinculo(plantaoB, profB, Formacao.ENFERMEIRO);
    const vinculoC = vinculo(plantaoC, profC, Formacao.TECNICO);
    const vinculoD = vinculo(plantaoD, profD, Formacao.ENFERMEIRO);
    const vinculoE = vinculo(plantaoE, profE, Formacao.ENFERMEIRO);
    const vinculoF = vinculo(plantaoF, profF, Formacao.ENFERMEIRO);
    const vinculosBordas = plantoesBordas.map((plantao, i) => vinculo(plantao, [profB, profD, profE, profF][i], i === 0 ? Formacao.ENFERMEIRO : i === 1 ? Formacao.ENFERMEIRO : i === 2 ? Formacao.ENFERMEIRO : Formacao.ENFERMEIRO));
    const vinculoAnterior = vinculo(plantaoAnteriorMes, profB, Formacao.ENFERMEIRO);
    const vinculos = [vinculoA, vinculoB, vinculoC, vinculoD, vinculoE, vinculoF, ...vinculosBordas, vinculoAnterior];

    const escalas = [
      { _id: escalaA, mes: 10, ano: 2026, status: StatusEscala.PUBLICADA, revisao: 1, versaoPublicada: 1, administradorId: new Types.ObjectId() },
      { _id: escalaAnterior, mes: 9, ano: 2026, status: StatusEscala.PUBLICADA, revisao: 1, versaoPublicada: 1, administradorId: new Types.ObjectId() },
    ];
    const setores = [
      { _id: setor1, nome: 'Setor 1', turnos: { diurno: { enfermeiros: 1, tecnicos: 0 }, noturno: { enfermeiros: 1, tecnicos: 0 } } },
      { _id: setor2, nome: 'Setor 2', turnos: { diurno: { enfermeiros: 1, tecnicos: 0 }, noturno: { enfermeiros: 1, tecnicos: 0 } } },
    ];
    const restricoes = [
      { _id: new Types.ObjectId(), profissionalId: profE, tipo: TipoRestricao.INDISPONIVEL, inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-31T23:59:59Z'), turno: 'noturno' },
    ];
    const configuracoes = [{
      chave: '2026-10', limiteTrocas: 3, maxExtras: 4, limitePlantoes: 8,
      maxExtrasConcursado: 4, maxExtrasClt: 4,
      cargas: { clt_31: { plantoes24h: 2, plantoes12h: 6 } },
    }];

    const modeloVinculos = collection(vinculos);
    const modeloPlantoes = collection(plantoes);
    const modeloEscalas = collection(escalas);
    const modeloProfissionais = collection(profDocs);
    const modeloUsuarios = collection(usuarioDocs);
    const modeloSetores = collection(setores);
    const modeloRestricoes = collection(restricoes);
    const modeloConfiguracoes = collection(configuracoes);
    const modeloTrocas = collection([]);

    const service = new TrocasService(
      {} as never,
      modeloTrocas as never, {} as never, {} as never, {} as never, {} as never,
      modeloVinculos as never, modeloPlantoes as never, modeloEscalas as never,
      modeloProfissionais as never, modeloUsuarios as never, modeloSetores as never,
      modeloRestricoes as never, {} as never, modeloConfiguracoes as never,
    );
    const contexto = await service.prepararContextoValidacaoCandidatos(String(escalaA));

    const pares = [
      [vinculoA, vinculoB],
      [vinculoA, vinculoC],
      [vinculoA, vinculoD],
      [vinculoA, vinculoE],
      [vinculoA, vinculoF],
      ...vinculosBordas.map((v) => [vinculoA, v]),
      [vinculoA, vinculoAnterior],
    ] as [Item, Item][];
    const divergencias: string[] = [];

    for (const [va, vb] of pares) {
      const solicitanteId = String(va.profissionalId);
      const solicitadoId = String(vb.profissionalId);
      const temporaria = {
        _id: new Types.ObjectId(), status: 'aguardando_resposta', mes: 10, ano: 2026,
        solicitanteProfissionalId: new Types.ObjectId(solicitanteId),
        profissionalSolicitadoId: new Types.ObjectId(solicitadoId),
        vinculoSolicitanteId: va._id, vinculoSolicitadoId: vb._id,
        criadaEm: new Date(), aceite: null,
      } as any;
      const antigo = await service.validarNoBanco(temporaria._id, undefined, false, temporaria, false);
      const novo = await service.validarParEmMemoria(String(va._id), String(vb._id), contexto);
      // Compara também os filtros baratos que a busca antiga aplicava fora de validarNoBanco.
      const plantaoA = contexto.plantaoPorId.get(String(va.plantaoId));
      const plantaoB = contexto.plantaoPorId.get(String(vb.plantaoId));
      const profASeed = contexto.profissionaisPorId.get(String(va.profissionalId));
      const profBSeed = contexto.profissionaisPorId.get(String(vb.profissionalId));
      if (plantaoA && plantaoB) {
        if (profASeed?.formacao !== vb.funcao) {
          antigo.impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: 'A formação do profissional é incompatível com a função do posto.' });
        }
        if (profBSeed?.formacao !== va.funcao) {
          antigo.impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: 'A formação do profissional é incompatível com a função do posto.' });
        }
        const ocupadoA = (contexto.plantoesPorProfissional.get(String(va.profissionalId)) ?? [])
          .some((item) => String(item.vinculo._id) !== String(va._id)
            && String(item.vinculo._id) !== String(vb._id)
            && new Date(item.plantao.data).toISOString().slice(0, 10) === new Date(plantaoB.data).toISOString().slice(0, 10));
        const ocupadoB = (contexto.plantoesPorProfissional.get(String(vb.profissionalId)) ?? [])
          .some((item) => String(item.vinculo._id) !== String(va._id)
            && String(item.vinculo._id) !== String(vb._id)
            && new Date(item.plantao.data).toISOString().slice(0, 10) === new Date(plantaoA.data).toISOString().slice(0, 10));
        if (ocupadoA || ocupadoB) {
          antigo.impedimentos.push({ codigo: 'REGRA_ESCALA', mensagem: 'O profissional já está escalado na data selecionada.' });
        }
      }
      const regrasAntigas = new Set(antigo.impedimentos.map((item) => regraNormalizada(item.codigo, item.mensagem)));
      const regrasNovas = new Set(novo.impedimentos.map((item) => regraNormalizada(item.codigo, item.mensagem)));

      for (const regra of new Set([...regrasAntigas, ...regrasNovas])) {
        if (regrasAntigas.has(regra) !== regrasNovas.has(regra)) {
          const msgAntigo = antigo.impedimentos.find((item) => regraNormalizada(item.codigo, item.mensagem) === regra)?.mensagem ?? '(nenhum)';
          const msgNovo = novo.impedimentos.find((item) => regraNormalizada(item.codigo, item.mensagem) === regra)?.mensagem ?? '(nenhum)';
          divergencias.push(`par ${String(va._id)} ↔ ${String(vb._id)} | ${regra} | antigo: ${msgAntigo} | novo: ${msgNovo}`);
        }
      }
    }

    expect(divergencias).toEqual([]);
  });

  it('aprova Ana Beatriz Lima ↔ Igor Vasconcelos Assis em Emergência nos dias 18 e 19/12/2026', async () => {
    const escalaId = new Types.ObjectId();
    const setorId = new Types.ObjectId();
    const anaId = new Types.ObjectId();
    const igorId = new Types.ObjectId();
    const vaId = new Types.ObjectId();
    const vbId = new Types.ObjectId();
    const paId = new Types.ObjectId();
    const pbId = new Types.ObjectId();

    const ana = { _id: anaId, usuarioId: new Types.ObjectId(), coren: 'CE-10001', formacao: Formacao.ENFERMEIRO, tipoVinculo: TipoVinculo.CONCURSADO, status: StatusProfissional.ATIVO };
    const igor = { _id: igorId, usuarioId: new Types.ObjectId(), coren: 'CE-EXTRA-IGOR', formacao: Formacao.ENFERMEIRO, tipoVinculo: TipoVinculo.CLT, status: StatusProfissional.ATIVO };
    const plantaoAna = { _id: paId, escalaId, setorId, data: new Date('2026-12-18T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
    const plantaoIgor = { _id: pbId, escalaId, setorId, data: new Date('2026-12-19T00:00:00Z'), horarioInicio: '19:00', horarioFim: '07:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
    const vinculoAna = { _id: vaId, plantaoId: paId, profissionalId: anaId, funcao: Formacao.ENFERMEIRO, lideranca: false, origemCobertura: 'regular' };
    const vinculoIgor = { _id: vbId, plantaoId: pbId, profissionalId: igorId, funcao: Formacao.ENFERMEIRO, lideranca: false, origemCobertura: 'regular' };
    const setor = { _id: setorId, nome: 'Emergência', ativo: true, turnos: { diurno: { enfermeiros: 1, tecnicos: 0 }, noturno: { enfermeiros: 1, tecnicos: 0 } } };

    const contexto = {
      escala: { _id: escalaId, mes: 12, ano: 2026, status: StatusEscala.PUBLICADA, revisao: 1, versaoPublicada: 1, administradorId: new Types.ObjectId() },
      configuracao: {
        periodo: '2026-12', limiteTrocas: 3, maxExtras: 4, limitePlantoes: 12,
        maxExtrasConcursado: 4, maxExtrasClt: 4,
        cargas: { concursado_31: { plantoes24h: 6, plantoes12h: 1 }, clt_31: { plantoes24h: 5, plantoes12h: 2 } },
      },
      profissionaisPorId: new Map([[String(anaId), ana], [String(igorId), igor]]),
      profissionaisPorCategoria: new Map([[Formacao.ENFERMEIRO, [ana, igor]]]),
      setoresPorId: new Map([[String(setorId), setor]]),
      restricoesPorProfissional: new Map(),
      plantoesPorProfissional: new Map([
        [String(anaId), [{ vinculo: vinculoAna, plantao: plantaoAna }]],
        [String(igorId), [{ vinculo: vinculoIgor, plantao: plantaoIgor }]],
      ]),
      plantoesPorDataTurno: new Map(),
      vinculosPorId: new Map([[String(vaId), vinculoAna], [String(vbId), vinculoIgor]]),
      plantaoPorId: new Map([[String(paId), plantaoAna], [String(pbId), plantaoIgor]]),
      cargaMensalPorProfissional: new Map([
        [String(anaId), { horas: 12, regulares24h: 0, regulares12h: 1, extras: 0, total: 1 }],
        [String(igorId), { horas: 12, regulares24h: 0, regulares12h: 1, extras: 0, total: 1 }],
      ]),
      coberturaPorSetorDataTurnoFuncao: new Map([
        [`${setorId}|2026-12-18|diurno|enfermeiro`, 1],
        [`${setorId}|2026-12-19|noturno|enfermeiro`, 1],
      ]),
    } as never;

    const hoje = new Date(Date.UTC(2026, 10, 21));
    const inicioJanela = hoje.getTime();
    const fimJanela = hoje.getTime() + 60 * 24 * 60 * 60 * 1000;
    const divergencias: string[] = [];

    if (igor.formacao !== ana.formacao) divergencias.push('Igor removido por: categoria');
    const inicioIgor = plantaoIgor.data.getTime();
    if (inicioIgor < inicioJanela || inicioIgor > fimJanela) divergencias.push('Igor removido por: janela de datas');
    if ((contexto.restricoesPorProfissional as Map<string, Item[]>).get(String(igorId))?.length) divergencias.push('Igor removido por: turno');
    const ocupadoAnaDiaIgor = (contexto.plantoesPorProfissional as Map<string, any[]>).get(String(anaId))
      ?.some((item) => item.plantao.data.toISOString().slice(0, 10) === plantaoIgor.data.toISOString().slice(0, 10));
    const ocupadoIgorDiaAna = (contexto.plantoesPorProfissional as Map<string, any[]>).get(String(igorId))
      ?.some((item) => item.plantao.data.toISOString().slice(0, 10) === plantaoAna.data.toISOString().slice(0, 10));
    if (ocupadoAnaDiaIgor || ocupadoIgorDiaAna) divergencias.push('Igor removido por: não escalado no dia');

    const novoServico = new TrocasService(
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
    );
    const validacao = await novoServico.validarParEmMemoria(String(vaId), String(vbId), contexto);
    if (validacao.impedimentos.length) divergencias.push(`Igor removido por: validação in-memory (${validacao.impedimentos.map((item) => item.mensagem).join('; ')})`);

    console.log('[troca-filtro] Ana Beatriz Lima | plantão 18/12/2026 | Emergência', {
      categoria: divergencias.some((item) => item.includes('categoria')) ? 0 : 1,
      setor: divergencias.some((item) => item.includes('setor')) ? 0 : 1,
      janela: divergencias.some((item) => item.includes('janela')) ? 0 : 1,
      turno: divergencias.some((item) => item.includes('turno')) ? 0 : 1,
      naoEscaladoNoDia: divergencias.some((item) => item.includes('não escalado')) ? 0 : 1,
      validacaoInMemory: validacao.impedimentos.length === 0 ? 1 : 0,
      inicioJanelaUTC: inicioJanela,
      fimJanelaUTC: fimJanela,
    });

    expect(divergencias).toEqual([]);
  });

  it('bloqueia combinações incompatíveis e preserva descanso/restrição em troca entre setores', async () => {
    const escalaId = new Types.ObjectId();
    const setorA = new Types.ObjectId();
    const setorB = new Types.ObjectId();

    const criarContexto = (
      formacaoA: Formacao,
      formacaoB: Formacao,
      liderancaB = false,
      restricoesA: Item[] = [],
      horarioA = '07:00',
      horarioB = '07:00',
    ) => {
      const profAId = new Types.ObjectId();
      const profBId = new Types.ObjectId();
      const vinculoAId = new Types.ObjectId();
      const vinculoBId = new Types.ObjectId();
      const plantaoAId = new Types.ObjectId();
      const plantaoBId = new Types.ObjectId();
      const profA = { _id: profAId, usuarioId: new Types.ObjectId(), coren: 'CE-A', formacao: formacaoA, tipoVinculo: TipoVinculo.CLT, status: StatusProfissional.ATIVO };
      const profB = { _id: profBId, usuarioId: new Types.ObjectId(), coren: 'CE-B', formacao: formacaoB, tipoVinculo: TipoVinculo.CLT, status: StatusProfissional.ATIVO };
      const vinculoA = { _id: vinculoAId, plantaoId: plantaoAId, profissionalId: profAId, funcao: formacaoA, lideranca: false, origemCobertura: 'regular' };
      const vinculoB = { _id: vinculoBId, plantaoId: plantaoBId, profissionalId: profBId, funcao: formacaoB, lideranca: liderancaB, origemCobertura: 'regular' };
      const plantaoA = { _id: plantaoAId, escalaId, setorId: setorA, data: new Date('2026-12-18T00:00:00Z'), horarioInicio: horarioA, horarioFim: horarioA === '19:00' ? '07:00' : '19:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
      const plantaoB = { _id: plantaoBId, escalaId, setorId: setorB, data: new Date('2026-12-19T00:00:00Z'), horarioInicio: horarioB, horarioFim: horarioB === '19:00' ? '07:00' : '19:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
      return {
        profAId, profBId, vinculoAId, vinculoBId, plantaoA, plantaoB,
        contexto: {
          escala: { _id: escalaId, mes: 12, ano: 2026, status: StatusEscala.PUBLICADA, revisao: 1, versaoPublicada: 1, administradorId: new Types.ObjectId() },
          configuracao: { periodo: '2026-12', limiteTrocas: 3, maxExtras: 4, limitePlantoes: 12, maxExtrasConcursado: 4, maxExtrasClt: 4, cargas: { clt_31: { plantoes24h: 5, plantoes12h: 2 } } },
          profissionaisPorId: new Map([[String(profAId), profA], [String(profBId), profB]]),
          profissionaisPorCategoria: new Map([[formacaoA, [profA]], [formacaoB, [profB]]]),
          setoresPorId: new Map([
            [String(setorA), { _id: setorA, nome: 'A', turnos: { diurno: { enfermeiros: 0, tecnicos: 0 }, noturno: { enfermeiros: 0, tecnicos: 0 } } }],
            [String(setorB), { _id: setorB, nome: 'B', turnos: { diurno: { enfermeiros: 0, tecnicos: 0 }, noturno: { enfermeiros: 0, tecnicos: 0 } } }],
          ]),
          restricoesPorProfissional: new Map([[String(profAId), restricoesA]]),
          plantoesPorProfissional: new Map([
            [String(profAId), [{ vinculo: vinculoA, plantao: plantaoA }]],
            [String(profBId), [{ vinculo: vinculoB, plantao: plantaoB }]],
          ]),
          plantoesPorDataTurno: new Map(),
          vinculosPorId: new Map([[String(vinculoAId), vinculoA], [String(vinculoBId), vinculoB]]),
          plantaoPorId: new Map([[String(plantaoAId), plantaoA], [String(plantaoBId), plantaoB]]),
          cargaMensalPorProfissional: new Map([
            [String(profAId), { horas: 12, regulares24h: 0, regulares12h: 1, extras: 0, total: 1 }],
            [String(profBId), { horas: 12, regulares24h: 0, regulares12h: 1, extras: 0, total: 1 }],
          ]),
          coberturaPorSetorDataTurnoFuncao: new Map(),
          nomePorProfissionalId: new Map([[String(profAId), 'Profissional A'], [String(profBId), 'Profissional B']]),
        } as never,
      };
    };

    const service = new TrocasService(
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
    );

    const misto = criarContexto(Formacao.ENFERMEIRO, Formacao.TECNICO);
    expect((await service.validarParEmMemoria(String(misto.vinculoAId), String(misto.vinculoBId), misto.contexto)).impedimentos.length).toBeGreaterThan(0);

    const lideranca = criarContexto(Formacao.TECNICO, Formacao.TECNICO, true);
    expect((await service.validarParEmMemoria(String(lideranca.vinculoAId), String(lideranca.vinculoBId), lideranca.contexto)).impedimentos.map((item) => item.mensagem).join(' ')).toMatch(/liderança|Enfermeiro-chefe/);

    const descanso = criarContexto(Formacao.ENFERMEIRO, Formacao.ENFERMEIRO, false, [], '19:00', '07:00');
    const extraPlantaoId = new Types.ObjectId();
    const extraVinculoId = new Types.ObjectId();
    const extraPlantao = { _id: extraPlantaoId, escalaId: escalaId, setorId: setorA, data: new Date('2026-12-20T00:00:00Z'), horarioInicio: '07:00', horarioFim: '19:00', duracaoHoras: 12, tipo: TipoPlantao.REGULAR };
    const extraVinculo = { _id: extraVinculoId, plantaoId: extraPlantaoId, profissionalId: descanso.profAId, funcao: Formacao.ENFERMEIRO, lideranca: false, origemCobertura: 'regular' };
    (descanso.contexto.plantoesPorProfissional as Map<string, Item[]>).get(String(descanso.profAId))!.push({ vinculo: extraVinculo, plantao: extraPlantao });
    (descanso.contexto.vinculosPorId as Map<string, Item>).set(String(extraVinculoId), extraVinculo);
    (descanso.contexto.plantaoPorId as Map<string, Item>).set(String(extraPlantaoId), extraPlantao);
    expect((await service.validarParEmMemoria(String(descanso.vinculoAId), String(descanso.vinculoBId), descanso.contexto)).impedimentos.map((item) => item.mensagem).join(' ')).toMatch(/intervalo insuficiente|descanso/i);

    const restricao = criarContexto(Formacao.ENFERMEIRO, Formacao.ENFERMEIRO, false, [{
      profissionalId: new Types.ObjectId(),
      tipo: TipoRestricao.INDISPONIVEL,
      inicio: new Date('2026-12-19T00:00:00Z'),
      fim: new Date('2026-12-19T23:59:59Z'),
      turno: 'noturno',
    }], '07:00', '19:00');
    (restricao.contexto.restricoesPorProfissional as Map<string, Item[]>).get(String(restricao.profAId))![0].profissionalId = restricao.profAId;
    expect((await service.validarParEmMemoria(String(restricao.vinculoAId), String(restricao.vinculoBId), restricao.contexto)).impedimentos.map((item) => item.mensagem).join(' ')).toMatch(/turno|indisponível/i);
  });
});
