import { createHash } from 'node:crypto';

/** Os horários dos plantões são locais (Fortaleza, UTC-3, sem horário de verão) — mesma convenção da escala do profissional. */
export const FUSO_PLANTOES = 'America/Fortaleza';
const OFFSET_LOCAL_MS = 3 * 3_600_000;
const HORA_MS = 3_600_000;

export interface PlantaoParaEvento {
  profissionalId: string;
  plantaoId: string;
  /** Dia de início do plantão (00:00 UTC). */
  data: Date;
  horarioInicio: string;
  duracaoHoras: number;
  setorNome: string;
  funcao: string;
  lideranca: boolean;
  tipo: string;
}

export interface EventoGoogle {
  summary: string;
  description: string;
  status: 'confirmed';
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  extendedProperties: { private: Record<string, string> };
}

export interface EventoDesejado {
  plantaoId: string;
  googleEventId: string;
  hash: string;
  inicio: Date;
  fim: Date;
  corpo: EventoGoogle;
}

const dois = (n: number) => String(n).padStart(2, '0');

/** Formata um instante como horário local de Fortaleza com offset explícito (`-03:00`). */
function dataHoraLocal(instante: number): string {
  const local = new Date(instante - OFFSET_LOCAL_MS);
  return (
    `${local.getUTCFullYear()}-${dois(local.getUTCMonth() + 1)}-${dois(local.getUTCDate())}` +
    `T${dois(local.getUTCHours())}:${dois(local.getUTCMinutes())}:00-03:00`
  );
}

/** Início e fim reais do plantão; plantões noturnos/24h terminam no dia seguinte porque o fim é início + duração. */
export function intervaloDoPlantao(plantao: Pick<PlantaoParaEvento, 'data' | 'horarioInicio' | 'duracaoHoras'>): { inicio: Date; fim: Date } {
  const [horas, minutos] = plantao.horarioInicio.split(':').map(Number);
  const dia = new Date(plantao.data);
  const inicio = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), horas, minutos) + OFFSET_LOCAL_MS;
  return { inicio: new Date(inicio), fim: new Date(inicio + plantao.duracaoHoras * HORA_MS) };
}

const BASE32HEX = '0123456789abcdefghijklmnopqrstuv';

/**
 * Identificador determinístico do evento (alfabeto base32hex, aceito pelo Google Calendar: a-v e 0-9).
 * Mesma dupla profissional+plantão => mesmo id, o que torna a inserção idempotente e impede duplicatas.
 */
export function idEventoGoogle(profissionalId: string, plantaoId: string): string {
  const digest = createHash('sha256').update(`nurseflow:${profissionalId}:${plantaoId}`).digest();
  let bits = 0;
  let valor = 0;
  let saida = '';
  for (const byte of digest) {
    valor = ((valor << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      saida += BASE32HEX[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return `nf${saida.slice(0, 40)}`;
}

/**
 * Monta o evento a partir dos dados oficiais. Só inclui data/horário, setor e função do próprio profissional:
 * nada de pacientes, colegas ou observações internas.
 */
export function montarEvento(plantao: PlantaoParaEvento): EventoDesejado {
  const { inicio, fim } = intervaloDoPlantao(plantao);
  const funcao = plantao.funcao === 'tecnico' ? 'Técnico' : 'Enfermeiro';
  const descricao = [
    `Setor: ${plantao.setorNome}`,
    `Função: ${funcao}${plantao.lideranca ? ' (chefia)' : ''}`,
    ...(plantao.tipo === 'extra' ? ['Plantão extra'] : []),
    'Criado pelo NurseFlow. Alterações devem ser feitas no NurseFlow.',
  ].join('\n');
  const corpo: EventoGoogle = {
    summary: `Plantão — ${plantao.setorNome}`,
    description: descricao,
    status: 'confirmed',
    start: { dateTime: dataHoraLocal(inicio.getTime()), timeZone: FUSO_PLANTOES },
    end: { dateTime: dataHoraLocal(fim.getTime()), timeZone: FUSO_PLANTOES },
    extendedProperties: { private: { nurseflow: '1', plantaoId: plantao.plantaoId, profissionalId: plantao.profissionalId } },
  };
  return {
    plantaoId: plantao.plantaoId,
    googleEventId: idEventoGoogle(plantao.profissionalId, plantao.plantaoId),
    hash: createHash('sha256').update(JSON.stringify(corpo)).digest('hex'),
    inicio,
    fim,
    corpo,
  };
}
