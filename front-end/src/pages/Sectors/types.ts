import type { SectorMinimum } from './components/EditSectorMinimumModal'

export type { SectorMinimum } from './components/EditSectorMinimumModal'

export type Sector = {
    id: string;
    name: string;
    description: string;
    active: boolean;
    minimum: SectorMinimum;
};
