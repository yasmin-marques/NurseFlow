import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

/** Contrato com o serviço Python (optimizer/app/schemas.py). */
export type OpcaoPlantao = '24h' | '12d' | '12n';

export interface ProfissionalOtimizacao {
  id: string;
  formacao: 'enfermeiro' | 'tecnico';
  vinculo: string;
  carga_24h: number;
  carga_12h: number;
  max_extras: number;
  max_plantoes: number;
  dias_bloqueados: number[];
  livre_a_partir_horas: number;
}

export interface SetorOtimizacao {
  id: string;
  nome: string;
  turnos: {
    diurno: { enfermeiros: number; tecnicos: number };
    noturno: { enfermeiros: number; tecnicos: number };
  };
}

export interface ProblemaOtimizacao {
  ano: number;
  mes: number;
  dias_mes: number;
  profissionais: ProfissionalOtimizacao[];
  setores: SetorOtimizacao[];
  parametros: { tempo_limite_segundos: number };
}

export interface AlocacaoOtimizada {
  profissional_id: string;
  setor_id: string;
  dia: number;
  opcao: OpcaoPlantao;
  extra: boolean;
}

export interface DescobertoOtimizado {
  setor_id: string;
  dia: number;
  turno: 'diurno' | 'noturno';
  funcao: 'enfermeiros' | 'tecnicos';
  necessario: number;
  alocado: number;
  faltam: number;
}

export interface SolucaoOtimizacao {
  alocacoes: AlocacaoOtimizada[];
  descobertos: DescobertoOtimizado[];
  estatisticas: {
    status: string;
    otimo: boolean;
    objetivo: number | null;
    melhor_limite: number | null;
    tempo_segundos: number;
    total_alocacoes: number;
    total_descobertos: number;
    cargas: {
      profissional_id: string;
      plantoes_24h: number;
      plantoes_12h: number;
      extras: number;
      faltam_24h: number;
      faltam_12h: number;
    }[];
  };
}

/** Porta para o otimizador: permite substituí-lo por um dublê nos testes. */
export abstract class OtimizadorEscala {
  abstract resolver(problema: ProblemaOtimizacao): Promise<SolucaoOtimizacao>;
}

@Injectable()
export class OtimizadorHttp extends OtimizadorEscala {
  private readonly logger = new Logger(OtimizadorHttp.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    super();
  }

  async resolver(problema: ProblemaOtimizacao): Promise<SolucaoOtimizacao> {
    const { url, timeoutMs } = this.config.get('otimizador', { infer: true });
    let resposta: Response;
    try {
      resposta = await fetch(`${url.replace(/\/$/, '')}/otimizar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(problema),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (erro) {
      this.logger.error(`Serviço de otimização inacessível em ${url}: ${(erro as Error).message}`);
      throw new ServiceUnavailableException('Serviço de otimização indisponível. Tente novamente em instantes.');
    }
    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      this.logger.error(`Otimizador respondeu ${resposta.status}: ${detalhe.slice(0, 500)}`);
      throw new BadGatewayException(`O serviço de otimização falhou (HTTP ${resposta.status}).`);
    }
    return (await resposta.json()) as SolucaoOtimizacao;
  }
}
