import { Injectable } from '@nestjs/common';

export interface PlantaoFuturoPublicado {
  plantaoId: string;
  data: Date;
  setor: string;
}

/**
 * Porta para a regra do DA04: a desativação é impedida se o profissional tem plantões futuros
 * em escalas já publicadas. Esse dado pertence ao módulo de Escalas, que ainda não existe.
 *
 * Quando o módulo de Escalas for implementado, basta fornecer uma implementação real:
 *   { provide: PlantoesFuturosChecker, useClass: EscalasPlantoesFuturosChecker }
 */
export abstract class PlantoesFuturosChecker {
  abstract buscarPublicadosFuturos(profissionalId: string): Promise<PlantaoFuturoPublicado[]>;
}

/** Implementação provisória: sem módulo de Escalas não há plantões a consultar, então nunca bloqueia. */
@Injectable()
export class SemEscalasPlantoesFuturosChecker extends PlantoesFuturosChecker {
  buscarPublicadosFuturos(): Promise<PlantaoFuturoPublicado[]> {
    return Promise.resolve([]);
  }
}
