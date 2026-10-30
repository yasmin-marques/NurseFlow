import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais/profissionais.enums';
import { TipoRestricao } from '../restricoes/restricao.schema';
import {
  bloqueiosDoProfissional,
  type ConfiguracaoVigente,
  diasAfetados,
  diasDoMes,
  livreAPartirDe,
  montarProblema,
  type ProfissionalEntrada,
  type RestricaoEntrada,
  validarEntrada,
} from './montar-problema';

const configuracao = (sobrescrever: Partial<ConfiguracaoVigente> = {}): ConfiguracaoVigente => ({
  periodo: '2026-10',
  limiteTrocas: 3,
  maxExtras: 2,
  limitePlantoes: 12,
  maxExtrasConcursado: 0,
  maxExtrasClt: 0,
  cargas: {
    concursado_31: { plantoes24h: 6, plantoes12h: 1 },
    clt_31: { plantoes24h: 8, plantoes12h: 0 },
  },
  ...sobrescrever,
});

const prof = (id: string, tipoVinculo: TipoVinculo, extra: Partial<ProfissionalEntrada> = {}): ProfissionalEntrada => ({
  id,
  nome: `Prof ${id}`,
  formacao: Formacao.ENFERMEIRO,
  tipoVinculo,
  status: StatusProfissional.ATIVO,
  ...extra,
});

const setor = {
  id: 's1',
  nome: 'UTI',
  turnos: { diurno: { enfermeiros: 2, tecnicos: 1 }, noturno: { enfermeiros: 2, tecnicos: 1 } },
};

const dia = (d: number, h = 0, m = 0) => new Date(Date.UTC(2026, 9, d, h, m));
const restricao = (r: Partial<RestricaoEntrada>): RestricaoEntrada => ({
  profissionalId: 'p1',
  tipo: TipoRestricao.INDISPONIVEL,
  inicio: dia(1),
  fim: dia(31, 23, 59),
  ...r,
});

const entrada = (profissionais: ProfissionalEntrada[], extras: object = {}) => ({
  ano: 2026,
  mes: 10,
  profissionais,
  setores: [setor],
  restricoes: [],
  configuracao: configuracao(),
  plantoesAnteriores: [],
  tempoLimiteSegundos: 10,
  ...extras,
});

describe('configurações vigentes → problema de otimização', () => {
  it('calcula meses em anos de um e quatro dígitos sem limites anuais artificiais', () => {
    expect(diasDoMes(4, 2)).toBe(29)
    expect(diasDoMes(9999, 12)).toBe(31)
  });

  it('usa cargas e limites da configuração (não valores fixos) e o tamanho do mês', () => {
    const { problema } = montarProblema(
      entrada([prof('c', TipoVinculo.CONCURSADO), prof('l', TipoVinculo.CLT), prof('r', TipoVinculo.RPA)]),
    );
    expect(problema.dias_mes).toBe(31);
    const [c, l, r] = problema.profissionais;
    expect([c.carga_24h, c.carga_12h]).toEqual([6, 1]);
    expect([l.carga_24h, l.carga_12h]).toEqual([8, 0]);
    expect([r.carga_24h, r.carga_12h]).toEqual([0, 0]); // RPA: sem carga fixa
    expect([c.max_extras, l.max_extras, r.max_extras]).toEqual([2, 2, 2]);
    expect(c.max_plantoes).toBe(12);
  });

  it('configuração alterada gera outro problema; extras por vínculo têm precedência sobre o geral', () => {
    const cfg = configuracao({
      maxExtras: 1,
      maxExtrasConcursado: 4,
      maxExtrasClt: 0,
      limitePlantoes: 0,
      cargas: { concursado_31: { plantoes24h: 5, plantoes12h: 2 }, clt_31: { plantoes24h: 7, plantoes12h: 1 } },
    });
    const { problema } = montarProblema(entrada([prof('c', TipoVinculo.CONCURSADO), prof('l', TipoVinculo.CLT)], { configuracao: cfg }));
    const [c, l] = problema.profissionais;
    expect([c.carga_24h, c.carga_12h, c.max_extras]).toEqual([5, 2, 4]);
    expect([l.carga_24h, l.carga_12h, l.max_extras]).toEqual([7, 1, 1]);
    expect(c.max_plantoes).toBe(0);
  });

  it('usa a carga do mês de 30 dias quando o período tem 30 dias', () => {
    const cfg = configuracao({ cargas: { concursado_30: { plantoes24h: 6, plantoes12h: 0 }, clt_30: { plantoes24h: 7, plantoes12h: 0 } } });
    const { problema } = montarProblema(entrada([prof('c', TipoVinculo.CONCURSADO)], { ano: 2026, mes: 11, configuracao: cfg }));
    expect(problema.dias_mes).toBe(30);
    expect(problema.profissionais[0].carga_24h).toBe(6);
  });
});

describe('RN003/RN005 — disponibilidade, férias e ausências', () => {
  it.each([TipoRestricao.INDISPONIVEL, TipoRestricao.FERIAS, TipoRestricao.AUSENCIA, TipoRestricao.VINCULO_EXTERNO])(
    'bloqueia os dias de %s',
    (tipo) => {
      const b = bloqueiosDoProfissional([restricao({ tipo, inicio: dia(10), fim: dia(12, 23, 59) })], 2026, 10);
      expect([...b.keys()]).toEqual([10, 11, 12]);
    },
  );

  it('recorrência semanal bloqueia somente o dia da semana (terças: 2026-10-06, 13, 20, 27)', () => {
    const dias = diasAfetados(restricao({ tipo: TipoRestricao.VINCULO_EXTERNO, diaSemana: 2 }), 2026, 10);
    expect(dias).toEqual([6, 13, 20, 27]);
  });

  it('"disponível" sem dia da semana é informativa e não bloqueia nada', () => {
    const b = bloqueiosDoProfissional([restricao({ tipo: TipoRestricao.DISPONIVEL, inicio: dia(16), fim: dia(16, 23, 59) })], 2026, 10);
    expect(b.size).toBe(0);
  });

  it('"disponível" com dia da semana restringe o período aos dias fixos (sextas)', () => {
    const b = bloqueiosDoProfissional([restricao({ tipo: TipoRestricao.DISPONIVEL, diaSemana: 5 })], 2026, 10);
    const livres = Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => !b.has(d));
    expect(livres).toEqual([2, 9, 16, 23, 30]);
  });

  it('descreve os conflitos e envia os dias bloqueados ao otimizador', () => {
    const { problema, conflitos } = montarProblema(
      entrada([prof('p1', TipoVinculo.CLT)], { restricoes: [restricao({ tipo: TipoRestricao.FERIAS, inicio: dia(5), fim: dia(7, 23, 59) })] }),
    );
    expect(problema.profissionais[0].dias_bloqueados).toEqual([5, 6, 7]);
    expect(conflitos).toContainEqual(expect.objectContaining({ tipo: 'INDISPONIBILIDADE', motivo: 'ferias', dias: [5, 6, 7] }));
  });

  it('só profissionais ativos participam; afastados/férias viram conflito informativo e desativados são ignorados', () => {
    const { problema, conflitos } = montarProblema(
      entrada([
        prof('a', TipoVinculo.CLT),
        prof('f', TipoVinculo.CLT, { status: StatusProfissional.FERIAS }),
        prof('d', TipoVinculo.CLT, { status: StatusProfissional.DESATIVADO }),
      ]),
    );
    expect(problema.profissionais.map((p) => p.id)).toEqual(['a']);
    expect(conflitos.map((c) => c.profissionalId)).toEqual(['f']);
  });
});

describe('RN004 — descanso herdado do mês anterior (24x72)', () => {
  it('plantão de 24h iniciado 29/09 às 07:00 termina 30/09 07:00 e libera em 03/10 07:00 (hora 79)', () => {
    const livre = livreAPartirDe(
      [{ profissionalId: 'p1', data: new Date(Date.UTC(2026, 8, 30)), horarioInicio: '07:00', duracaoHoras: 24 }],
      2026,
      10,
    );
    // fim = 01/10 07:00 -> hora 7; + 72h = hora 79
    expect(livre).toBe(79);
  });

  it('sem plantões anteriores o profissional está livre', () => {
    expect(livreAPartirDe([], 2026, 10)).toBe(0);
  });
});

describe('validação prévia', () => {
  it('rejeita quando falta a carga de concursado/CLT para o tamanho do mês', () => {
    const erros = validarEntrada({ ...entrada([prof('c', TipoVinculo.CONCURSADO)]), configuracao: configuracao({ cargas: {} }) });
    expect(erros.join(' ')).toMatch(/concursado/);
  });

  it('não exige carga para RPA', () => {
    expect(validarEntrada({ ...entrada([prof('r', TipoVinculo.RPA)]), configuracao: configuracao({ cargas: {} }) })).toEqual([]);
  });

  it('rejeita sem setores ativos, sem quantitativo ou sem profissionais ativos', () => {
    const base = entrada([prof('c', TipoVinculo.CLT)]);
    expect(validarEntrada({ ...base, setores: [] })).toHaveLength(1);
    const zerado = { ...setor, turnos: { diurno: { enfermeiros: 0, tecnicos: 0 }, noturno: { enfermeiros: 0, tecnicos: 0 } } };
    expect(validarEntrada({ ...base, setores: [zerado] }).join(' ')).toMatch(/quantitativo/);
    expect(validarEntrada({ ...base, profissionais: [prof('x', TipoVinculo.CLT, { status: StatusProfissional.AFASTADO })] }).join(' ')).toMatch(/ativos/);
  });

  it('avisa quando o efetivo cadastrado é menor que o quantitativo mínimo (RN006)', () => {
    const { avisos } = montarProblema(entrada([prof('c', TipoVinculo.CLT)]));
    expect(avisos.some((a) => a.tipo === 'EFETIVO_INSUFICIENTE')).toBe(true);
  });
});
