export type Statut = 'permanent' | 'vacataire';

export type CategorieVacataire =
  | 'directeur'
  | 'chef_service'
  | 'agent'
  | 'retraite'
  | 'autre';

export interface PlafondHoraire {
  id: number;
  statut: Statut;
  categorie: CategorieVacataire | null;
  plafond_annuel_heures: number;
}
export const plafondsData: PlafondHoraire[] = [
  { id: 1, statut: 'permanent', categorie: null, plafond_annuel_heures: 200 },
  { id: 2, statut: 'vacataire', categorie: 'directeur', plafond_annuel_heures: 140 },
  { id: 3, statut: 'vacataire', categorie: 'chef_service', plafond_annuel_heures: 160 },
  { id: 4, statut: 'vacataire', categorie: 'agent', plafond_annuel_heures: 180 },
  { id: 5, statut: 'vacataire', categorie: 'retraite', plafond_annuel_heures: 200 },
  { id: 6, statut: 'vacataire', categorie: 'autre', plafond_annuel_heures: 180 },
];