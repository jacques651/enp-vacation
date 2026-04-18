export interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
  statut: 'vacataire' | 'permanent';
  categorie_vacataire?: string;
}