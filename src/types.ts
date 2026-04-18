// ================= ENSEIGNANT =================
export interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
  telephone: string | null;
  titre: string;
  statut: string;
}

// ================= CYCLE =================
export interface Cycle {
  id: number;
  designation: string;
  nb_classe: number;
}

// ================= MODULE =================
export interface Module {
  id: number;
  designation: string;
  cycle_id: number;
}

// ================= MATIERE =================
export interface Matiere {
  id: number;
  designation: string;
  vhoraire: number; // ✔ reste ici
  module_id: number;
}

// ================= BANQUE =================
export interface Banque {
  id: number;
  designation: string;
}

// ================= COMPTE BANCAIRE =================
export interface CompteBancaire {
  id: number;
  enseignant_id: number;
  banque_id: number;
  numero_compte: string;
  actif: boolean;
  banque?: string | null;
}

// ================= PROMOTION =================
export interface Promotion {
  id: number;
  libelle: string;
}

// ================= ANNEE SCOLAIRE =================
export interface AnneeScolaire {
  id: number;
  libelle: string;
}

// ================= SIGNATAIRE =================
export interface Signataire {
  id: number;
  nom: string;
  prenom: string;
  grade: string | null;
  fonction: string;
  titre_honorifique: string | null;
}

// ================= PLAFOND =================
export interface Plafond {
  id: number;
  titre: string;
  statut: string;
  volume_horaire_max: number;
}

// ================= ENTETE =================
export interface Entete {
  id: number;
  cle: string;
  valeur: string | null;
}

// ================= INPUT VACATION =================
export interface VacationInput {
  enseignant_id: number;
  matiere_id: number;
  promotion_id: number;
  annee_scolaire_id: number;
  nb_classe: number;
  mois: number;
  annee: number;
}

// ================= VACATION (DB PURE) =================
export interface Vacation {
  id: number;
  enseignant_id: number;
  matiere_id: number;
  promotion_id: number;
  annee_scolaire_id: number;

  nb_classe: number;

  vht: number;               // ✔ CORRIGÉ
  taux_horaire: number;
  taux_retenue: number;

  mois: number;
  annee: number;
}

// ================= VACATION VIEW (UI) =================
export interface VacationView {
  id: number;
  enseignant_id: number;
  matiere_id: number;

  nb_classe: number;

  vhoraire: number; // ✔ vient de matieres
  vht: number;

  taux_horaire: number;
  taux_retenue: number;

  mois: number;
  annee: number;
}

// ================= LIQUIDATION =================
export interface LiquidationRow {
  id: number;
  nom: string;
  prenom: string;
  titre: string;
  statut: string;
  cycle: string;
  module: string;
  matiere: string;
  banque: string | null;
  numero_compte: string | null;

  vhoraire: number; // ✔ matieres
  nb_classe: number;
  vht: number;

  montant_brut: number;
  montant_retenu: number;
  montant_net: number;

  mois: number;
  annee: number;
}

export interface Totaux {
  total_heures: number;
  total_brut: number;
  total_retenu: number;
  total_net: number;
}

// ================= ORDRE DE VIREMENT =================
export interface LigneOrdre {
  enseignant_id: number;
  nom: string;
  prenom: string;
  banque: string | null;
  numero_compte: string | null;
  montant_net: number;
}

export interface OrdreVirementOutput {
  total: number;
  lignes: LigneOrdre[];
}

// ================= DASHBOARD =================
export interface DashboardStats {
  total_vacations_mois: number;
  total_net_mois: number;
  total_enseignants: number;
  total_matieres: number;
  vacations_par_mois: VacationMois[];
  repartition_statut: RepartitionStatut[];
  dernieres_vacations: DerniereVacation[];
}

export interface VacationMois {
  mois: number;
  total: number;
}

export interface RepartitionStatut {
  statut: string;
  count: number;
}

export interface DerniereVacation {
  id: number;
  enseignant: string;
  matiere: string;
  net: number;
  mois: number;
  annee: number;
}