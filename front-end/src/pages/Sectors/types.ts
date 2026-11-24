import type { SectorMinimum } from './components/EditSectorMinimumModal';

export type { SectorMinimum } from './components/EditSectorMinimumModal';

/** Subdivisão de um setor; carrega o mínimo de técnicos do próprio subsetor (não há mínimo de enfermeiros). */
export type Subsector = {
    id: string;
    sectorId: string;
    name: string;
    description: string;
    active: boolean;
    minimumTechnicians: number;
};

export type NewSubsector = { name: string; description: string; minimumTechnicians: number };

export type Sector = {
    id: string;
    name: string;
    description: string;
    active: boolean;
    /** Em setor com subsetores, `minimum.technicians` é null: o mínimo de técnicos pertence a cada subsetor. */
    minimum: SectorMinimum;
    hasSubsectors: boolean;
    subsectors: Subsector[];
    /** Técnicos ligados ao setor sem subsetor (pendência de adequação em setor com subsetores). */
    techniciansWithoutSubsector: number;
};

/** Dados de cadastro de setor. Com `subsectors`, `minimum.technicians` deve ser null. */
export type NewSector = {
    name: string;
    description: string;
    minimum: SectorMinimum;
    subsectors?: { name: string; description: string; minimumTechnicians: number }[];
};
