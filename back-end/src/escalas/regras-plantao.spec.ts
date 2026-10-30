import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais/profissionais.enums';
import { type ConfiguracaoVigente, type ProfissionalEntrada } from './montar-problema';
import { calcularPendenciasCobertura, resumirCobertura, validarAlocacoesPlantao } from './regras-plantao';
import { TipoPlantao } from './schemas';

const profissional: ProfissionalEntrada = {
  id: 'profissional-1',
  nome: 'Ana',
  formacao: Formacao.ENFERMEIRO,
  tipoVinculo: TipoVinculo.CLT,
  status: StatusProfissional.ATIVO,
};

const configuracao: ConfiguracaoVigente = {
  periodo: '2026-10',
  limiteTrocas: 0,
  maxExtras: 0,
  limitePlantoes: 5,
  maxExtrasConcursado: 0,
  maxExtrasClt: 0,
  cargas: { clt_31: { plantoes24h: 0, plantoes12h: 2 } },
};

const alocacao = (horarioInicio: string, duracaoHoras: number) => ({
  profissional,
  funcao: Formacao.ENFERMEIRO,
  data: new Date('2026-10-12T00:00:00.000Z'),
  horarioInicio,
  duracaoHoras,
  tipo: TipoPlantao.REGULAR,
});

describe('regras de plantões manuais', () => {
  it('permite plantões diurno e noturno de 12h no mesmo dia', () => {
    expect(
      validarAlocacoesPlantao({
        ano: 2026,
        mes: 10,
        configuracao,
        restricoes: [],
        anteriores: [],
        existentes: [],
        candidatas: [alocacao('07:00', 12), alocacao('19:00', 12)],
      }),
    ).toEqual([]);
  });

  it('detecta conflito de descanso entre plantões de 24h', () => {
    const erros = validarAlocacoesPlantao({
      ano: 2026,
      mes: 10,
      configuracao: { ...configuracao, cargas: { clt_31: { plantoes24h: 2, plantoes12h: 0 } } },
      restricoes: [],
      anteriores: [],
      existentes: [],
      candidatas: [alocacao('07:00', 24), { ...alocacao('07:00', 24), data: new Date('2026-10-13T00:00:00.000Z') }],
    });
    expect(erros.join(' ')).toMatch(/descanso obrigatório/);
  });

  it('calcula vagas descobertas por setor, dia, turno e função', () => {
    const pendencias = calcularPendenciasCobertura({
      ano: 2026,
      mes: 10,
      setores: [
        {
          id: 'setor-1',
          nome: 'UTI',
          turnos: {
            diurno: { enfermeiros: 1, tecnicos: 1 },
            noturno: { enfermeiros: 1, tecnicos: 1 },
          },
        },
      ],
      alocacoes: [{ ...alocacao('07:00', 24), setorId: 'setor-1' }],
    });
    expect(pendencias).toContainEqual(
      expect.objectContaining({ data: '2026-10-12', turno: 'diurno', funcao: 'tecnicos', necessario: 1, alocado: 0, faltam: 1 }),
    );
    expect(pendencias).not.toContainEqual(
      expect.objectContaining({ data: '2026-10-12', turno: 'noturno', funcao: 'enfermeiros' }),
    );
  });

  it('calcula percentual de cobertura arredondando para baixo e deixa vazio sem posições exigidas', () => {
    const setores = [{ turnos: { diurno: { enfermeiros: 1, tecnicos: 0 }, noturno: { enfermeiros: 0, tecnicos: 0 } } }];
    const parcial = resumirCobertura({
      ano: 2026,
      mes: 10,
      setores,
      turnos: ['diurno'],
      pendencias: [{ setorId: 'setor-1', setor: 'UTI', data: '2026-10-01', turno: 'diurno', funcao: 'enfermeiros', necessario: 2, alocado: 0, faltam: 2, motivo: 'teste' }],
    });
    expect(parcial).toEqual({ posicoesExigidas: 31, posicoesPreenchidas: 29, percentual: 93 });
    expect(resumirCobertura({ ano: 2026, mes: 10, setores: [], pendencias: [] })).toEqual({
      posicoesExigidas: 0,
      posicoesPreenchidas: 0,
      percentual: null,
    });
  });
});
