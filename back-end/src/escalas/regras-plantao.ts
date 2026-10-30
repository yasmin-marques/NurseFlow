import { chaveCarga } from '../configuracoes/configuracao.schema';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais/profissionais.enums';
import { type ConfiguracaoVigente, type PlantaoAnterior, type ProfissionalEntrada, type RestricaoEntrada, bloqueiosDoProfissional, diasDoMes } from './montar-problema';
import type { TurnoEscala } from './dto/gerar-escala.dto';
import { TipoPlantao } from './schemas';
import { utcDate } from '../common/utils/date';

export interface AlocacaoPlantaoValidacao {
  profissional: ProfissionalEntrada;
  funcao: Formacao;
  data: Date;
  horarioInicio: string;
  duracaoHoras: number;
  tipo: TipoPlantao;
}

export interface PendenciaCobertura {
  setorId: string;
  setor: string;
  data: string;
  turno: 'diurno' | 'noturno';
  funcao: 'enfermeiros' | 'tecnicos';
  necessario: number;
  alocado: number;
  faltam: number;
  motivo: string;
}

export interface ResumoCobertura {
  posicoesExigidas: number;
  posicoesPreenchidas: number;
  percentual: number | null;
}

export function validarAlocacoesPlantao(input: {
  ano: number;
  mes: number;
  configuracao: ConfiguracaoVigente;
  restricoes: RestricaoEntrada[];
  anteriores: PlantaoAnterior[];
  existentes: AlocacaoPlantaoValidacao[];
  candidatas: AlocacaoPlantaoValidacao[];
}): string[] {
  const erros: string[] = [];
  const candidatasPorProfissional = new Map<string, AlocacaoPlantaoValidacao[]>();
  for (const alocacao of input.candidatas) {
    const profissional = alocacao.profissional;
    if (profissional.status !== StatusProfissional.ATIVO) {
      erros.push(`${profissional.nome} não está ativo.`);
    }
    if (alocacao.funcao !== profissional.formacao) {
      erros.push(`${profissional.nome} não possui a formação exigida (${alocacao.funcao}).`);
    }
    const restricoes = input.restricoes.filter((item) => item.profissionalId === profissional.id);
    if (bloqueiosDoProfissional(restricoes, input.ano, input.mes).has(alocacao.data.getUTCDate())) {
      erros.push(`${profissional.nome} está indisponível na data selecionada.`);
    }
    candidatasPorProfissional.set(profissional.id, [...(candidatasPorProfissional.get(profissional.id) ?? []), alocacao]);
  }

  for (const [profissionalId, candidatas] of candidatasPorProfissional) {
    const profissional = candidatas[0].profissional;
    const agenda = [
      ...input.anteriores
        .filter((item) => item.profissionalId === profissionalId)
        .map((item) => ({
          data: item.data,
          horarioInicio: item.horarioInicio,
          duracaoHoras: item.duracaoHoras,
          tipo: TipoPlantao.REGULAR,
        })),
      ...input.existentes
        .filter((item) => item.profissional.id === profissionalId)
        .map((item) => item),
      ...candidatas,
    ].sort((a, b) => inicioEmMs(a.data, a.horarioInicio) - inicioEmMs(b.data, b.horarioInicio));

    for (let index = 0; index < agenda.length - 1; index++) {
      const anterior = agenda[index];
      const seguinte = agenda[index + 1];
      if (parDiurnoNoturnoPermitido(anterior, seguinte)) continue;
      const inicioProximo = inicioEmMs(seguinte.data, seguinte.horarioInicio);
      const fimAnterior = inicioEmMs(anterior.data, anterior.horarioInicio) + anterior.duracaoHoras * MS_HORA;
      const descansoObrigatorio = anterior.duracaoHoras >= 24 ? 72 : 36;
      if (inicioProximo < fimAnterior + descansoObrigatorio * MS_HORA) {
        erros.push(`${profissional.nome} não respeita o descanso obrigatório ou possui plantões sobrepostos.`);
        break;
      }
    }

    const mesAtual = [
      ...input.existentes.filter((item) => item.profissional.id === profissionalId),
      ...candidatas,
    ];
    const regulares24h = mesAtual.filter((item) => item.tipo === TipoPlantao.REGULAR && item.duracaoHoras === 24).length;
    const regulares12h = mesAtual.filter((item) => item.tipo === TipoPlantao.REGULAR && item.duracaoHoras === 12).length;
    const extras = mesAtual.filter((item) => item.tipo === TipoPlantao.EXTRA).length;
    const carga = input.configuracao.cargas[chaveCarga(profissional.tipoVinculo, diasDoMes(input.ano, input.mes))];
    if (regulares24h > (carga?.plantoes24h ?? 0) || regulares12h > (carga?.plantoes12h ?? 0)) {
      erros.push(`${profissional.nome} excede a carga regular configurada.`);
    }
    const maxExtras =
      profissional.tipoVinculo === TipoVinculo.CONCURSADO && input.configuracao.maxExtrasConcursado > 0
        ? input.configuracao.maxExtrasConcursado
        : profissional.tipoVinculo === TipoVinculo.CLT && input.configuracao.maxExtrasClt > 0
          ? input.configuracao.maxExtrasClt
          : input.configuracao.maxExtras;
    if (extras > maxExtras) erros.push(`${profissional.nome} excede o limite de plantões extras.`);
    const total = mesAtual.length;
    if (input.configuracao.limitePlantoes > 0 && total > input.configuracao.limitePlantoes) {
      erros.push(`${profissional.nome} excede o limite total de plantões do período.`);
    }
    if (profissional.tipoVinculo === TipoVinculo.RPA && mesAtual.some((item) => item.tipo !== TipoPlantao.EXTRA)) {
      erros.push(`${profissional.nome} possui vínculo RPA e deve ser escalado somente em plantões extras.`);
    }
  }
  return [...new Set(erros)];
}

export function calcularPendenciasCobertura(input: {
  ano: number;
  mes: number;
  setores: {
    id: string;
    nome: string;
    turnos: {
      diurno: { enfermeiros: number; tecnicos: number };
      noturno: { enfermeiros: number; tecnicos: number };
    };
  }[];
  alocacoes: (AlocacaoPlantaoValidacao & { setorId: string })[];
  turnos?: TurnoEscala[];
}): PendenciaCobertura[] {
  const contagem = new Map<string, number>();
  for (const alocacao of input.alocacoes) {
    const turnos = alocacao.duracaoHoras >= 24 ? ['diurno', 'noturno'] : [alocacao.horarioInicio === '07:00' ? 'diurno' : 'noturno'];
    const funcao = alocacao.funcao === Formacao.ENFERMEIRO ? 'enfermeiros' : 'tecnicos';
    for (const turno of turnos) {
      const chave = `${alocacao.setorId}|${alocacao.data.toISOString().slice(0, 10)}|${turno}|${funcao}`;
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
  }

  const pendencias: PendenciaCobertura[] = [];
  for (const setor of input.setores) {
    for (let dia = 1; dia <= diasDoMes(input.ano, input.mes); dia++) {
      const data = utcDate(input.ano, input.mes - 1, dia).toISOString().slice(0, 10);
      for (const turno of ['diurno', 'noturno'] as const) {
        if (input.turnos && !input.turnos.includes(turno)) continue;
        for (const funcao of ['enfermeiros', 'tecnicos'] as const) {
          const necessario = setor.turnos[turno][funcao];
          const alocado = contagem.get(`${setor.id}|${data}|${turno}|${funcao}`) ?? 0;
          if (necessario > alocado) {
            pendencias.push({
              setorId: setor.id,
              setor: setor.nome,
              data,
              turno,
              funcao,
              necessario,
              alocado,
              faltam: necessario - alocado,
              motivo: 'Quantitativo mínimo não atingido sem violar as restrições obrigatórias.',
            });
          }
        }
      }
    }
  }
  return pendencias;
}

export function resumirCobertura(input: {
  ano: number;
  mes: number;
  setores: {
    turnos: {
      diurno: { enfermeiros: number; tecnicos: number };
      noturno: { enfermeiros: number; tecnicos: number };
    };
  }[];
  turnos?: TurnoEscala[];
  pendencias: PendenciaCobertura[];
}): ResumoCobertura {
  const turnos = input.turnos ?? ['diurno', 'noturno'];
  const posicoesExigidas = input.setores.reduce(
    (total, setor) =>
      total +
      diasDoMes(input.ano, input.mes) *
        turnos.reduce((subtotal, turno) => subtotal + setor.turnos[turno].enfermeiros + setor.turnos[turno].tecnicos, 0),
    0,
  );
  const vagas = input.pendencias.reduce((total, item) => total + item.faltam, 0);
  const posicoesPreenchidas = Math.max(0, posicoesExigidas - vagas);
  return {
    posicoesExigidas,
    posicoesPreenchidas,
    percentual: posicoesExigidas === 0 ? null : Math.min(100, Math.floor((100 * posicoesPreenchidas) / posicoesExigidas)),
  };
}

const MS_HORA = 3_600_000;

function inicioEmMs(data: Date, horario: string): number {
  const [hora, minuto] = horario.split(':').map(Number);
  return utcDate(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), hora, minuto).getTime();
}

function parDiurnoNoturnoPermitido(
  anterior: Pick<AlocacaoPlantaoValidacao, 'data' | 'horarioInicio' | 'duracaoHoras'>,
  seguinte: Pick<AlocacaoPlantaoValidacao, 'data' | 'horarioInicio' | 'duracaoHoras'>,
): boolean {
  const mesmaData = anterior.data.getTime() === seguinte.data.getTime();
  return mesmaData && anterior.duracaoHoras === 12 && anterior.horarioInicio === '07:00' && seguinte.horarioInicio === '19:00' && seguinte.duracaoHoras === 12;
}
