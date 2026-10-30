import type { Mensagem } from './montar-problema';
import type { PendenciaCobertura, ResumoCobertura } from './regras-plantao';

export interface PlantaoPdf {
  id: string;
  data: string;
  setor: { id: string; nome: string };
  horarioInicio: string;
  horarioFim: string;
  duracaoHoras: number;
  tipo: 'regular' | 'extra';
  profissionais: { id: string; nome: string; formacao: string; vinculo: string }[];
}

export interface VisualizacaoEscalaPdf {
  escala: { id: string; ano: number; mes: number; status: string };
  cobertura: ResumoCobertura | null;
  plantoes: PlantaoPdf[];
  pendencias: PendenciaCobertura[];
  conflitos: Mensagem[];
  avisos: Mensagem[];
}

export interface DadosEscalaPdf extends VisualizacaoEscalaPdf {
  numero: number;
  publicadoEm: Date;
}

export function isVisualizacaoEscalaPdf(value: unknown): value is VisualizacaoEscalaPdf {
  if (!value || typeof value !== 'object') return false;
  const visualizacao = value as Partial<VisualizacaoEscalaPdf>;
  return (
    typeof visualizacao.escala === 'object' &&
    visualizacao.escala !== null &&
    Array.isArray(visualizacao.plantoes) &&
    Array.isArray(visualizacao.pendencias) &&
    Array.isArray(visualizacao.conflitos) &&
    Array.isArray(visualizacao.avisos)
  );
}
