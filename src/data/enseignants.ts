export interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
  statut: string;
  categorie_vacataire: string;
}

export const enseignantsData: Enseignant[] = [
  { id: 1, nom: 'KORGO', prenom: 'Jacques', statut: 'vacataire', categorie_vacataire: 'agent' },
  { id: 2, nom: 'OUEDRAOGO', prenom: 'Paul', statut: 'vacataire', categorie_vacataire: 'agent' },
];