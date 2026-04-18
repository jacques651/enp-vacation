export interface EnteteAdmin {
  id: number;

  ministere: string;
  secretariat: string;
  ecole: string;
  directionGenerale: string;
  directionFinanciere: string;
  numeroCourrier: string;

  logo: string; // base64 ou chemin fichier

  pays: string;
  devise: string;
  ville: string;
}
export const enteteData: EnteteAdmin[] = [
  {
    id: 1,

    ministere: 'Ministère de la Sécurité',
    secretariat: 'Secrétariat Général',
    ecole: 'Ecole Nationale de Police',
    directionGenerale: 'Direction Générale',
    directionFinanciere: 'Direction des Finances',
    numeroCourrier: 'N° 001/ENP',

    logo: '',

    pays: 'Burkina Faso',
    devise: 'Unité - Progrès - Justice',
    ville: 'Ouagadougou',
  }
];