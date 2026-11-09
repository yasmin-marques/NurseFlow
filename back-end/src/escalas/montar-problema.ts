import { chaveCarga } from '../configuracoes/configuracao.schema';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais/profissionais.enums';
import { TipoRestricao } from '../restricoes/restricao.schema';
import { utcDate } from '../common/utils/date';
import type { TurnoEscala } from './dto/gerar-escala.dto';
import { CAPACIDADE_ALOCACOES_FIXAS, VERSAO_CONTRATO_OTIMIZADOR, type ProblemaOtimizacao, type ProfissionalOtimizacao } from './otimizador/otimizador';

/** Horários fixos do regime (iguais aos do modelo em optimizer/app/solver.py). */
export const INICIO_DIURNO = 7;
export const DESCANSO_APOS_24H = 72;
export const DESCANSO_APOS_12H = 36;
const MS_HORA = 3_600_000;

export interface ConfiguracaoVigente {
  periodo: string;
  limiteTrocas: number;
  maxExtras: number;
  limitePlantoes: number;
  maxExtrasConcursado: number;
  maxExtrasClt: number;
  cargas: Record<string, { plantoes24h: number; plantoes12h: number }>;
}

export interface ProfissionalEntrada {
  id: string;
  nome: string;
  formacao: Formacao;
  tipoVinculo: TipoVinculo;
  status: StatusProfissional;
}

export interface SetorEntrada {
  id: string;
  nome: string;
  turnos: ProblemaOtimizacao['setores'][number]['turnos'];
}

export interface RestricaoEntrada {
  profissionalId: string;
  tipo: TipoRestricao;
  inicio: Date;
  fim: Date;
  diasSemana?: number[] | null;
  diaSemana?: number | null;
  turno?: 'diurno' | 'noturno' | 'flexivel' | null;
  motivo?: string | null;
  observacao?: string | null;
  instituicao?: string | null;
  tipoVinculo?: string | null;
}

/** Último plantão do mês anterior (para herdar o descanso obrigatório). */
export interface PlantaoAnterior {
  profissionalId: string;
  data: Date;
  horarioInicio: string;
  duracaoHoras: number;
}

export interface Mensagem {
  tipo: string;
  profissionalId?: string;
  profissional?: string;
  setorId?: string;
  setor?: string;
  motivo: string;
  dias?: number[];
}

export interface EntradaGeracao {
  ano: number;
  mes: number;
  profissionais: ProfissionalEntrada[];
  setores: SetorEntrada[];
  restricoes: RestricaoEntrada[];
  configuracao: ConfiguracaoVigente;
  plantoesAnteriores: PlantaoAnterior[];
  tempoLimiteSegundos: number;
  turnosSelecionados?: TurnoEscala[];
}

export interface ProblemaMontado {
  problema: ProblemaOtimizacao;
  conflitos: Mensagem[];
  avisos: Mensagem[];
}

export const diasDoMes = (ano: number, mes: number) => utcDate(ano, mes, 0).getUTCDate();

const BLOQUEANTES = new Set<TipoRestricao>([
  TipoRestricao.INDISPONIVEL,
  TipoRestricao.FERIAS,
  TipoRestricao.AUSENCIA,
  TipoRestricao.VINCULO_EXTERNO,
]);

/** Validação prévia (retorna erros que impedem a geração). */
export function validarEntrada(
  e: Pick<EntradaGeracao, 'ano' | 'mes' | 'profissionais' | 'setores' | 'configuracao'> & {
    turnosSelecionados?: TurnoEscala[];
  },
): string[] {
  const erros: string[] = [];
  const dias = diasDoMes(e.ano, e.mes);
  const setoresComEscopo = e.setores.map((setor) => ({
    ...setor,
    turnos: {
      diurno: e.turnosSelecionados?.includes('diurno') === false ? { enfermeiros: 0, tecnicos: 0 } : setor.turnos.diurno,
      noturno: e.turnosSelecionados?.includes('noturno') === false ? { enfermeiros: 0, tecnicos: 0 } : setor.turnos.noturno,
    },
  }));
  if (setoresComEscopo.length === 0) erros.push('Não há setores ativos cadastrados.');
  else if (setoresComEscopo.every((s) => quantitativoTotal(s) === 0)) {
    erros.push('Nenhum setor ativo possui quantitativo mínimo definido (enfermeiros/técnicos por turno).');
  }
  const ativos = e.profissionais.filter((p) => p.status === StatusProfissional.ATIVO);
  if (ativos.length === 0) erros.push('Não há profissionais ativos para compor a escala.');
  for (const vinculo of [TipoVinculo.CONCURSADO, TipoVinculo.CLT]) {
    const carga = e.configuracao.cargas[chaveCarga(vinculo, dias)];
    const quantos = ativos.filter((p) => p.tipoVinculo === vinculo).length;
    if (quantos > 0 && (!carga || carga.plantoes24h + carga.plantoes12h === 0)) {
      erros.push(
        `A carga de plantões do vínculo ${vinculo} para meses de ${dias} dias não está configurada (${e.configuracao.periodo}).`,
      );
    }
  }
  return erros;
}

const quantitativoTotal = (s: SetorEntrada) =>
  s.turnos.diurno.enfermeiros + s.turnos.diurno.tecnicos + s.turnos.noturno.enfermeiros + s.turnos.noturno.tecnicos;

export type TurnoEscalaTipo = 'diurno' | 'noturno';

export interface TurnoBloqueadoDetalhe {
  dia: number;
  turno: TurnoEscalaTipo;
  motivo: string;
}

export interface BloqueiosProfissionalCalculados {
  diasBloqueados: number[];
  turnosBloqueados: TurnoBloqueadoDetalhe[];
  motivosPorDia: Map<number, Set<string>>;
  motivosPorTurno: Map<string, Set<string>>;
}

export function diasDaRecorrencia(r: RestricaoEntrada): number[] {
  if (Array.isArray(r.diasSemana) && r.diasSemana.length > 0) {
    return r.diasSemana;
  }
  if (r.diaSemana !== null && r.diaSemana !== undefined) {
    return [r.diaSemana];
  }
  return [];
}

/** Dias (1-based) do mês cobertos pela restrição, respeitando a recorrência semanal. Datas em UTC. */
export function diasAfetados(r: RestricaoEntrada, ano: number, mes: number): number[] {
  const dias: number[] = [];
  const recorrencia = diasDaRecorrencia(r);
  for (let d = 1; d <= diasDoMes(ano, mes); d++) {
    const inicioDia = utcDate(ano, mes - 1, d).getTime();
    const fimDia = inicioDia + 24 * MS_HORA;
    if (!(r.inicio.getTime() < fimDia && r.fim.getTime() >= inicioDia)) continue;
    if (recorrencia.length === 0 || recorrencia.includes(new Date(inicioDia).getUTCDay())) {
      dias.push(d);
    }
  }
  return dias;
}

/**
 * RN003/RN005: calcula a disponibilidade por dia e por turno.
 * - Indisponibilidade, férias, ausência e vínculos externos bloqueiam os dias ou turnos informados.
 * - Restrições "disponível" com dia da semana ou turno definem dias/turnos fixos de trabalho.
 * - Registros legados (diaSemana único, sem turno) continuam suportados.
 */
export function calcularBloqueiosDoProfissional(
  rs: RestricaoEntrada[],
  ano: number,
  mes: number,
): BloqueiosProfissionalCalculados {
  const totalDias = diasDoMes(ano, mes);
  const diasBloqueadosSet = new Set<number>();
  const turnosBloqueadosList: TurnoBloqueadoDetalhe[] = [];
  const motivosPorDia = new Map<number, Set<string>>();
  const motivosPorTurno = new Map<string, Set<string>>();

  const registrarMotivoDia = (dia: number, motivo: string) => {
    if (!motivosPorDia.has(dia)) motivosPorDia.set(dia, new Set());
    motivosPorDia.get(dia)!.add(motivo);
  };

  const registrarMotivoTurno = (dia: number, turno: TurnoEscalaTipo, motivo: string) => {
    const chave = `${dia}_${turno}`;
    if (!motivosPorTurno.has(chave)) motivosPorTurno.set(chave, new Set());
    motivosPorTurno.get(chave)!.add(motivo);
  };

  const disponivelRs = rs.filter((r) => r.tipo === TipoRestricao.DISPONIVEL);
  const temRegraDisponibilidade = disponivelRs.some(
    (r) => diasDaRecorrencia(r).length > 0 || r.turno === 'diurno' || r.turno === 'noturno',
  );

  for (let d = 1; d <= totalDias; d++) {
    const dataDia = utcDate(ano, mes - 1, d);
    const diaSemana = dataDia.getUTCDay();
    const inicioDia = dataDia.getTime();
    const fimDia = inicioDia + 24 * MS_HORA;

    const turnosPermitidos = new Set<TurnoEscalaTipo>(['diurno', 'noturno']);

    if (temRegraDisponibilidade) {
      const cobrindoDia = disponivelRs.filter(
        (r) => r.inicio.getTime() < fimDia && r.fim.getTime() >= inicioDia,
      );

      if (cobrindoDia.length > 0) {
        const comDias = cobrindoDia.filter((r) => diasDaRecorrencia(r).length > 0);
        if (comDias.length > 0) {
          const noDia = comDias.filter((r) => diasDaRecorrencia(r).includes(diaSemana));
          if (noDia.length === 0) {
            turnosPermitidos.clear();
            registrarMotivoDia(d, 'fora_dos_dias_fixos');
          } else {
            turnosPermitidos.clear();
            for (const r of noDia) {
              if (r.turno === 'diurno') turnosPermitidos.add('diurno');
              else if (r.turno === 'noturno') turnosPermitidos.add('noturno');
              else {
                turnosPermitidos.add('diurno');
                turnosPermitidos.add('noturno');
              }
            }
            if (!turnosPermitidos.has('diurno')) registrarMotivoTurno(d, 'diurno', 'disponibilidade');
            if (!turnosPermitidos.has('noturno')) registrarMotivoTurno(d, 'noturno', 'disponibilidade');
          }
        } else {
          turnosPermitidos.clear();
          for (const r of cobrindoDia) {
            if (r.turno === 'diurno') turnosPermitidos.add('diurno');
            else if (r.turno === 'noturno') turnosPermitidos.add('noturno');
            else {
              turnosPermitidos.add('diurno');
              turnosPermitidos.add('noturno');
            }
          }
          if (!turnosPermitidos.has('diurno')) registrarMotivoTurno(d, 'diurno', 'disponibilidade');
          if (!turnosPermitidos.has('noturno')) registrarMotivoTurno(d, 'noturno', 'disponibilidade');
        }
      }
    }

    for (const r of rs.filter((x) => BLOQUEANTES.has(x.tipo))) {
      if (diasAfetados(r, ano, mes).includes(d)) {
        const rotuloMotivo =
          r.motivo && r.motivo.toLowerCase() !== r.tipo.toLowerCase()
            ? `${r.tipo}: ${r.motivo}`
            : r.tipo;
        if (r.turno === 'diurno') {
          turnosPermitidos.delete('diurno');
          registrarMotivoTurno(d, 'diurno', rotuloMotivo);
        } else if (r.turno === 'noturno') {
          turnosPermitidos.delete('noturno');
          registrarMotivoTurno(d, 'noturno', rotuloMotivo);
        } else {
          turnosPermitidos.delete('diurno');
          turnosPermitidos.delete('noturno');
          registrarMotivoDia(d, rotuloMotivo);
        }
      }
    }

    if (!turnosPermitidos.has('diurno') && !turnosPermitidos.has('noturno')) {
      diasBloqueadosSet.add(d);
      if (!motivosPorDia.has(d)) {
        registrarMotivoDia(d, 'indisponivel');
      }
    } else {
      if (!turnosPermitidos.has('diurno')) {
        const motivos = motivosPorTurno.get(`${d}_diurno`);
        const motivo = motivos ? [...motivos].join(', ') : 'turno_diurno_bloqueado';
        turnosBloqueadosList.push({ dia: d, turno: 'diurno', motivo });
      }
      if (!turnosPermitidos.has('noturno')) {
        const motivos = motivosPorTurno.get(`${d}_noturno`);
        const motivo = motivos ? [...motivos].join(', ') : 'turno_noturno_bloqueado';
        turnosBloqueadosList.push({ dia: d, turno: 'noturno', motivo });
      }
    }
  }

  return {
    diasBloqueados: [...diasBloqueadosSet].sort((a, b) => a - b),
    turnosBloqueados: turnosBloqueadosList,
    motivosPorDia,
    motivosPorTurno,
  };
}

export function bloqueiosDoProfissional(rs: RestricaoEntrada[], ano: number, mes: number) {
  const calc = calcularBloqueiosDoProfissional(rs, ano, mes);
  const mapa = new Map<number, Set<TipoRestricao | 'fora_dos_dias_fixos'>>();
  for (const d of calc.diasBloqueados) {
    const motivos = calc.motivosPorDia.get(d) ?? new Set(['indisponivel' as TipoRestricao]);
    mapa.set(d, motivos as Set<TipoRestricao | 'fora_dos_dias_fixos'>);
  }
  return mapa;
}

/** Hora (relativa ao dia 1 às 00:00 UTC) a partir da qual o profissional volta a poder iniciar plantão. */
export function livreAPartirDe(anteriores: PlantaoAnterior[], ano: number, mes: number): number {
  const inicioMes = utcDate(ano, mes - 1, 1).getTime();
  let livre = 0;
  for (const p of anteriores) {
    const [h, m] = p.horarioInicio.split(':').map(Number);
    const inicio = p.data.getTime() + (h + (m || 0) / 60) * MS_HORA;
    const fim = inicio + p.duracaoHoras * MS_HORA;
    const descanso = p.duracaoHoras >= 24 ? DESCANSO_APOS_24H : DESCANSO_APOS_12H;
    livre = Math.max(livre, Math.ceil((fim - inicioMes) / MS_HORA) + descanso);
  }
  return livre;
}

export function montarProblema(e: EntradaGeracao): ProblemaMontado {
  const dias = diasDoMes(e.ano, e.mes);
  const { configuracao: cfg } = e;
  const conflitos: Mensagem[] = [];
  const avisos: Mensagem[] = [];

  const ativos: ProfissionalEntrada[] = [];
  for (const p of e.profissionais) {
    if (p.status === StatusProfissional.ATIVO) ativos.push(p);
    else if (p.status !== StatusProfissional.DESATIVADO) {
      conflitos.push({
        tipo: 'PROFISSIONAL_INDISPONIVEL',
        profissionalId: p.id,
        profissional: p.nome,
        motivo: `Status "${p.status}": não participa desta geração.`,
      });
    }
  }

  const porProfissional = new Map<string, RestricaoEntrada[]>();
  for (const r of e.restricoes) porProfissional.set(r.profissionalId, [...(porProfissional.get(r.profissionalId) ?? []), r]);
  const anterioresPor = new Map<string, PlantaoAnterior[]>();
  for (const a of e.plantoesAnteriores) anterioresPor.set(a.profissionalId, [...(anterioresPor.get(a.profissionalId) ?? []), a]);

  const profissionais: ProfissionalOtimizacao[] = ativos.map((p) => {
    const calc = calcularBloqueiosDoProfissional(porProfissional.get(p.id) ?? [], e.ano, e.mes);
    const porMotivo = new Map<string, number[]>();
    for (const [dia, motivos] of calc.motivosPorDia) {
      for (const m of motivos) porMotivo.set(m, [...(porMotivo.get(m) ?? []), dia]);
    }
    for (const [motivo, diasBloqueados] of porMotivo) {
      conflitos.push({
        tipo: 'INDISPONIBILIDADE',
        profissionalId: p.id,
        profissional: p.nome,
        motivo,
        dias: diasBloqueados.sort((a, b) => a - b),
      });
    }

    const porMotivoTurno = new Map<string, number[]>();
    for (const tb of calc.turnosBloqueados) {
      const chave = `${tb.motivo} (${tb.turno})`;
      porMotivoTurno.set(chave, [...(porMotivoTurno.get(chave) ?? []), tb.dia]);
    }
    for (const [motivo, diasBloqueados] of porMotivoTurno) {
      conflitos.push({
        tipo: 'INDISPONIBILIDADE_TURNO',
        profissionalId: p.id,
        profissional: p.nome,
        motivo,
        dias: diasBloqueados.sort((a, b) => a - b),
      });
    }

    const livre = livreAPartirDe(anterioresPor.get(p.id) ?? [], e.ano, e.mes);
    if (livre > 0) {
      conflitos.push({
        tipo: 'DESCANSO_MES_ANTERIOR',
        profissionalId: p.id,
        profissional: p.nome,
        motivo: 'Descanso obrigatório de plantões do mês anterior.',
        dias: Array.from({ length: Math.min(dias, Math.ceil(livre / 24)) }, (_, i) => i + 1),
      });
    }

    const carga = cfg.cargas[chaveCarga(p.tipoVinculo, dias)];
    // RPA sem carga configurada não tem carga fixa: só atua como extra (RN009).
    const maxExtras =
      p.tipoVinculo === TipoVinculo.CONCURSADO && cfg.maxExtrasConcursado > 0
        ? cfg.maxExtrasConcursado
        : p.tipoVinculo === TipoVinculo.CLT && cfg.maxExtrasClt > 0
          ? cfg.maxExtrasClt
          : cfg.maxExtras;

    return {
      id: p.id,
      formacao: p.formacao,
      vinculo: p.tipoVinculo,
      carga_24h: carga?.plantoes24h ?? 0,
      carga_12h: carga?.plantoes12h ?? 0,
      max_extras: maxExtras,
      max_plantoes: cfg.limitePlantoes,
      dias_bloqueados: calc.diasBloqueados,
      turnos_bloqueados: calc.turnosBloqueados.map((tb) => ({ dia: tb.dia, turno: tb.turno })),
      livre_a_partir_horas: livre,
    };
  });

  for (const s of e.setores) {
    for (const [turno, quant] of Object.entries(s.turnos) as [string, { enfermeiros: number; tecnicos: number }][]) {
      for (const [funcao, formacao] of [['enfermeiros', Formacao.ENFERMEIRO], ['tecnicos', Formacao.TECNICO]] as const) {
        const disponiveis = ativos.filter((p) => p.formacao === formacao).length;
        if (quant[funcao] > disponiveis) {
          avisos.push({
            tipo: 'EFETIVO_INSUFICIENTE',
            setorId: s.id,
            setor: s.nome,
            motivo: `Turno ${turno} exige ${quant[funcao]} ${funcao}, mas há ${disponiveis} ativo(s) cadastrado(s).`,
          });
        }
      }
    }
  }

  return {
    problema: {
      versao_contrato: VERSAO_CONTRATO_OTIMIZADOR,
      capacidades: [CAPACIDADE_ALOCACOES_FIXAS],
      ano: e.ano,
      mes: e.mes,
      dias_mes: dias,
      profissionais,
      setores: e.setores.map((s) => ({ id: s.id, nome: s.nome, turnos: s.turnos })),
      turnos_selecionados: e.turnosSelecionados ?? ['diurno', 'noturno'],
      parametros: { tempo_limite_segundos: e.tempoLimiteSegundos },
      alocacoes_fixas: [],
    },
    conflitos,
    avisos,
  };
}
