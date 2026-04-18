export interface Signataire {
  id: number;
  nom: string;
  prenom: string;
  grade: string;
  fonction: string;
  titre: string; // peut être vide ''
}
export const signatairesData: Signataire[] = [
  {
    id: 1,
    nom: 'SINDE',
    prenom: 'Salif',
    grade: 'Commissaire Divisionnaire de Police',
    fonction: "Le Directeur de l'Administration des Finances",
    titre: '',
  },
  {
    id: 2,
    nom: 'BELEM',
    prenom: 'Abdoulaye',
    grade: 'Commissaire Divisionnaire de Police',
    fonction: 'Le Directeur Général',
    titre: "Chevalier de l'Ordre de l'Etalon",
  },
];