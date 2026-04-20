// src-tauri/src/models.rs
#![allow(dead_code)]
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// =========================
// 📌 ANNEES SCOLAIRES
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct AnneeScolaire {
    pub id: i64,
    pub libelle: String,
}

// =========================
// 📌 PROMOTIONS
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Promotion {
    pub id: i64,
    pub libelle: String,
}

// =========================
// 📌 CYCLES
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Cycle {
    pub id: i64,
    pub designation: String,
    pub nb_classe: i64,
}

// =========================
// 📌 MODULES
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Module {
    pub id: i64,
    pub designation: String,
    pub cycle_id: i64,
}

// Module avec jointure
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct ModuleWithCycle {
    pub id: i64,
    pub designation: String,
    pub cycle_id: i64,
    pub cycle_designation: String,
}

// =========================
// 📌 MATIERES
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Matiere {
    pub id: i64,
    pub designation: String,
    pub vhoraire: f64,
    pub module_id: i64,
}

// Matiere avec jointure
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct MatiereWithModule {
    pub id: i64,
    pub designation: String,
    pub vhoraire: f64,
    pub module_id: i64,
    pub module_designation: String,
    pub cycle_id: i64,
    pub cycle_designation: String,
}

// =========================
// 📌 ENSEIGNANTS
// =========================

// Structure de base
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Enseignant {
    pub id: i64,
    pub nom: String,
    pub prenom: String,
    pub telephone: Option<String>,
    pub titre: String,
    pub statut: String,
    pub vh_max: f64,
}

// Enseignant avec volume horaire maximum
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct EnseignantWithPlafond {
    pub id: i64,
    pub nom: String,
    pub prenom: String,
    pub telephone: Option<String>,
    pub titre: String,
    pub statut: String,
    pub volume_horaire_max: f64,
}

// Enseignant avec cumul (heures consommées et restantes)
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct EnseignantCumul {
    pub id: i64,
    pub nom: String,
    pub prenom: String,
    pub titre: String,
    pub statut: String,
    pub volume_max: f64,
    pub heures_consommees: f64,
    pub heures_restantes: f64,
}

// Enseignant avec compte bancaire actif
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct EnseignantWithCompte {
    pub id: i64,
    pub nom: String,
    pub prenom: String,
    pub telephone: Option<String>,
    pub titre: String,
    pub statut: String,
    pub vh_max: f64,
    pub banque_id: Option<i64>,
    pub banque_designation: Option<String>,
    pub numero_compte: Option<String>,
    pub cle_rib: Option<String>,
    pub actif: Option<i32>,
}

// =========================
// 📌 BANQUES
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Banque {
    pub id: i64,
    pub designation: String,
}

// =========================
// 📌 COMPTES BANCAIRES
// =========================

// Version simple (sans jointures)
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct CompteBancaireSimple {
    pub id: i64,
    pub enseignant_id: i64,
    pub banque_id: i64,
    pub numero_compte: String,
    pub cle_rib: String,
    pub actif: i32,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
}

// Version avec jointures (pour l'affichage)
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct CompteBancaire {
    pub id: i64,
    pub enseignant_id: i64,
    pub banque_id: i64,
    pub numero_compte: String,
    pub cle_rib: String,
    pub actif: i32,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
    pub enseignant_nom: String,
    pub enseignant_prenom: String,
    pub banque_designation: String,
}

// Alias pour compatibilité
pub type CompteBancaireWithBanque = CompteBancaire;

// =========================
// 📌 PLAFONDS
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Plafond {
    pub id: i64,
    pub titre: String,
    pub statut: String,
    pub volume_horaire_max: i64,
}

// =========================
// 📌 VACATIONS
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Vacation {
    pub id: i64,
    pub enseignant_id: i64,
    pub matiere_id: i64,
    pub promotion_id: i64,
    pub annee_scolaire_id: i64,
    pub nb_classe: i64,
    pub vht: f64,
    pub taux_horaire: f64,
    pub taux_retenue: f64,
    pub mois: i32,
    pub annee: i32,
    pub date_traitement: String,
}

// Vacation avec toutes les jointures
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct VacationDetail {
    pub id: i64,
    pub numero_ordre: Option<i64>,
    pub nom: String,
    pub prenom: String,
    pub titre: String,
    pub statut: String,
    pub cycle: String,
    pub module: String,
    pub matiere: String,
    pub vhoraire: f64,
    pub nb_classe: i64,
    pub vht: f64,
    pub taux_horaire: f64,
    pub taux_retenue: f64,
    pub montant_brut: f64,
    pub montant_retenu: f64,
    pub montant_net: f64,
    pub mois: i32,
    pub annee: i32,
    pub annee_scolaire: String,
    pub promotion: String,
}

// =========================
// 📌 ORDRES DE VIREMENT
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct OrdreVirement {
    pub id: i64,
    pub banque_id: i64,
    pub numero_ordre: String,
    pub date_edition: String,
    pub objet: Option<String>,
    pub created_at: String,
}

// Ordre avec détails
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrdreVirementDetail {
    pub id: i64,
    pub banque_id: i64,
    pub banque_designation: String,
    pub numero_ordre: String,
    pub date_edition: String,
    pub objet: Option<String>,
    pub created_at: String,
    pub total_net: f64,
    pub lignes: Vec<LigneOrdre>,
}

// =========================
// 📌 LIGNES ORDRE DE VIREMENT
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct LigneOrdre {
    pub id: i64,
    pub ordre_id: i64,
    pub enseignant_id: i64,
    pub compte_bancaire_id: i64,
    pub cle_rib: String,
    pub montant_brut: f64,
    pub retenue: f64,
    pub montant_net: f64,
}

// Ligne avec détails enseignant et compte
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LigneOrdreDetail {
    pub enseignant_id: i64,
    pub nom: String,
    pub prenom: String,
    pub titre: String,
    pub statut: String,
    pub numero_compte: String,
    pub cle_rib: String,
    pub banque_designation: String,
    pub montant_brut: f64,
    pub retenue: f64,
    pub montant_net: f64,
}

// =========================
// 📌 SIGNAIRES
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Signataire {
    pub id: i64,
    pub nom: String,
    pub prenom: String,
    pub grade: String,
    pub fonction: String,
    pub titre: String,
    pub ordre_signature: i32,
    pub actif: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Signataire avec nom complet
impl Signataire {
    pub fn nom_complet(&self) -> String {
        format!("{} {}", self.prenom, self.nom)
    }
    
    pub fn nom_complet_avec_grade(&self) -> String {
        format!("{} {} {}", self.grade, self.prenom, self.nom)
    }
    
    pub fn signature_line(&self) -> String {
        format!("{} {} - {} ({})", self.prenom, self.nom, self.titre, self.fonction)
    }
}

// =========================
// 📌 ENTETE (PARAMETRES GENERAUX)
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Entete {
    pub id: i64,
    pub cle: String,
    pub valeur: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Structure pour les paramètres organisés
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParametresEtablissement {
    pub nom_etablissement: String,
    pub sigle: String,
    pub logo: Option<String>,
    pub adresse: String,
    pub telephone: String,
    pub email: String,
    pub directeur_nom: String,
    pub directeur_titre: String,
    pub directeur_fonction: String,
    pub comptable_nom: String,
    pub comptable_titre: String,
    pub comptable_fonction: String,
    pub signataire_defaut: String,
}

// =========================
// 📌 INPUT TYPES (pour les mutations)
// =========================

// Vacation Input
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VacationInput {
    pub enseignant_id: i64,
    pub matiere_id: i64,
    pub promotion_id: i64,
    pub annee_scolaire_id: i64,
    pub nb_classe: i64,
    pub vht: f64,
    pub taux_horaire: Option<f64>,
    pub taux_retenue: Option<f64>,
    pub mois: i32,
    pub annee: i32,
}

// Enseignant Input
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnseignantInput {
    pub nom: String,
    pub prenom: String,
    pub telephone: Option<String>,
    pub titre: String,
    pub statut: String,
}

// Compte Bancaire Input
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompteBancaireInput {
    pub enseignant_id: i64,
    pub banque_id: i64,
    pub numero_compte: String,
    pub cle_rib: String,
    pub actif: Option<i32>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
}

// Signataire Input
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SignataireInput {
    pub nom: String,
    pub prenom: String,
    pub grade: String,
    pub fonction: String,
    pub titre: String,
    pub ordre_signature: Option<i32>,
    pub actif: Option<i32>,
}

// Ordre Virement Input
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrdreVirementInput {
    pub banque_id: i64,
    pub numero_ordre: String,
    pub date_edition: String,
    pub objet: Option<String>,
    pub vacations_ids: Vec<i64>,
}

// =========================
// 📌 STATS & RECAP
// =========================

// Récapitulatif par enseignant
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecapEnseignant {
    pub enseignant_id: i64,
    pub nom: String,
    pub prenom: String,
    pub total_vacations: i64,
    pub total_heures: f64,
    pub total_brut: f64,
    pub total_retenu: f64,
    pub total_net: f64,
}

// Récapitulatif mensuel
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecapMensuel {
    pub mois: i32,
    pub annee: i32,
    pub total_vacations: i64,
    pub total_enseignants: i64,
    pub total_heures: f64,
    pub total_brut: f64,
    pub total_retenu: f64,
    pub total_net: f64,
}

// Suivi des classes par matière
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SuiviClasses {
    pub matiere_id: i64,
    pub matiere_designation: String,
    pub cycle_designation: String,
    pub total_classes_prevues: f64,
    pub total_classes_utilisees: f64,
    pub taux_utilisation: f64,
}

// =========================
// 📌 RÉPONSE GÉNÉRIQUE API
// =========================
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

impl Default for ApiResponse<()> {
    fn default() -> Self {
        Self {
            success: true,
            data: None,
            error: None,
        }
    }
}

// =========================
// 📌 ORDRES DE VIREMENT (COMPLÉMENT)
// =========================

// Structure pour la réponse de génération d'ordre
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrdreVirementGenerated {
    pub id: i64,
    pub banque_id: i64,
    pub banque_designation: String,
    pub numero_ordre: String,
    pub date_edition: String,
    pub objet: String,
    pub total_net: f64,
    pub lignes: Vec<LigneOrdreGenerated>,
}

// Structure pour les lignes d'ordre générées
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LigneOrdreGenerated {
    pub id: i64,
    pub enseignant_id: i64,
    pub nom: String,
    pub prenom: String,
    pub titre: String,
    pub statut: String,
    pub compte_bancaire_id: i64,
    pub numero_compte: String,
    pub cle_rib: String,
    pub banque_designation: String,
    pub montant_brut: f64,
    pub retenue: f64,
    pub montant_net: f64,
}

// Structure pour le regroupement par enseignant (génération)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnseignantVacationTotal {
    pub enseignant_id: i64,
    pub nom: String,
    pub prenom: String,
    pub titre: String,
    pub statut: String,
    pub numero_compte: Option<String>,
    pub cle_rib: Option<String>,
    pub banque_designation: Option<String>,
    pub banque_id: Option<i64>,
    pub montant_brut: f64,
    pub retenue: f64,
    pub montant_net: f64,
}