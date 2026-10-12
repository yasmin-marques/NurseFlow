import type { SectorShift } from './components/EditSectorMinimumModal'

export type { SectorMinimum, SectorShift } from './components/EditSectorMinimumModal'

export type Sector = {
    id: string;
    name: string;
    description: string;
    active: boolean;
    shifts: SectorShift[];
};
