// src-tauri/src/models.rs
#![allow(dead_code)]
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// =========================
// 📌 PROMOTION
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Promotion {
    pub id: i64,
    pub libelle: String,
    pub annee_scolaire: Option<String>,
}

// =========================
// 📌 CYCLE
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Cycle {
    pub id: i64,
    pub designation: String,
    pub nb_classe: i64,
}

// =========================
// 📌 MODULE
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Module {
    pub id: i64,
    pub designation: String,
    pub cycle_id: i64,
    pub cycle_designation: Option<String>,
}

// =========================
// 📌 MATIERE
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Matiere {
    pub id: i64,
    pub designation: String,
    pub vhoraire: f64,
    pub coefficient: Option<f64>,
    pub observation: Option<String>,
    pub module_id: i64,
    pub module_designation: Option<String>,
}

// =========================
// 📌 BANQUE
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Banque {
    pub id: i64,
    pub designation: String,
}

// =========================
// 📌 PLAFOND
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Plafond {
    pub id: i64,
    pub titre: String,
    pub statut: String,
    pub volume_horaire_max: i64,
}

// =========================
// 📌 ENSEIGNANT
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Enseignant {
    pub id: i64,
    pub nom: String,
    pub prenom: String,
    pub telephone: Option<String>,
    pub titre: String,
    pub statut: String,
    pub volume_horaire_max: i64,
    pub banque_id: Option<i64>,
    pub numero_compte: Option<String>,
    pub cle_rib: Option<String>,
    pub banque_designation: Option<String>,
    pub nom_complet: Option<String>,
}

// =========================
// 📌 SIGNATAIRE
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Signataire {
    pub id: i64,
    pub nom: String,
    pub prenom: String,
    pub grade: Option<String>,
    pub fonction: Option<String>,
    pub titre_honorifique: Option<String>,
    pub nom_complet: Option<String>,
}

// =========================
// 📌 ENTÊTE ADMINISTRATIF
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Entete {
    pub id: i64,
    pub cle: String,
    pub valeur: String,
}

// =========================
// 📌 VACATION (sans annee_scolaire car vient de la vue)
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Vacation {
    pub id: i64,
    pub enseignant_id: i64,
    pub volume_horaire_max: f64,
    pub cycle_id: i64,
    pub module_id: i64,
    pub matiere_id: i64,
    pub nb_classe: f64,
    pub vhoraire_matiere: f64,
    pub taux_horaire: f64,
    pub taux_retenue: f64,
    pub vht: f64,
    pub montant_brut: f64,
    pub montant_retenu: f64,
    pub montant_net: f64,
    pub mois: String,
    pub annee: i64,
    pub date_traitement: String,
    pub promotion_id: Option<i64>,
    
    // Champs joints (de la vue)
    pub enseignant_nom: Option<String>,
    pub enseignant_prenom: Option<String>,
    pub enseignant_titre: Option<String>,
    pub enseignant_statut: Option<String>,
    pub cycle_designation: Option<String>,
    pub cycle_nb_classe: Option<i64>,
    pub module_designation: Option<String>,
    pub matiere_designation: Option<String>,
    pub matiere_vhoraire: Option<f64>,
    pub promotion_libelle: Option<String>,
    pub annee_scolaire: Option<String>,  // ← vient de p.annee_scolaire dans la vue
}

// =========================
// 📌 VACATION INPUT
// =========================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VacationInput {
    pub enseignant_id: i64,
    pub cycle_id: i64,
    pub module_id: i64,
    pub matiere_id: i64,
    pub nb_classe: Option<f64>,
    pub taux_horaire: Option<f64>,
    pub taux_retenue: Option<f64>,
    pub mois: String,
    pub annee: i64,
    pub promotion_id: i64,
}

// =========================
// 📌 SUIVI CLASSES
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct SuiviClasses {
    pub id: i64,
    pub cycle_id: i64,
    pub matiere_id: i64,
    pub annee_scolaire: String,
    pub classes_utilisees: f64,
    pub classes_restantes: f64,
    pub cycle_designation: Option<String>,
    pub matiere_designation: Option<String>,
}

// =========================
// 📌 LIGNE ORDRE
// =========================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LigneOrdre {
    pub enseignant_id: i64,
    pub nom: String,
    pub prenom: String,
    pub titre: String,
    pub statut_enseignant: String,
    pub numero_compte: Option<String>,
    pub cle_rib: Option<String>,
    pub banque_designation: Option<String>,
    pub montant_brut: f64,
    pub montant_retenu: f64,
    pub montant_net: f64,
}

// =========================
// 📌 ORDRE VIREMENT OUTPUT
// =========================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrdreVirementOutput {
    pub id: i64,
    pub numero_ordre: String,
    pub date_edition: String,
    pub objet: String,
    pub motif: Option<String>,
    pub total_net: f64,
    pub filtre_banque: Option<String>,
    pub filtre_enseignant_id: Option<String>,
    pub filtre_mois: Option<String>,
    pub filtre_annee: Option<i64>,
    pub filtre_annee_scolaire: Option<String>,
    pub filtre_promotion_libelle: Option<String>,
    pub filtre_cycle_designation: Option<String>,
    pub filtre_module_designation: Option<String>,
    pub filtre_matiere_designation: Option<String>,
    pub lignes: Vec<LigneOrdre>,
    pub entete: EnteteOrdre,
}

// =========================
// 📌 ENTÊTE ORDRE
// =========================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnteteOrdre {
    pub ministere: String,
    pub ecole: String,
    pub directeur_nom: String,
    pub directeur_titre: String,
    pub chef_service_nom: String,
    pub chef_service_titre: String,
    pub date_edition: String,
}

// =========================
// 📌 ORDRE VIREMENT DB
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct OrdreVirementDB {
    pub id: i64,
    pub numero_ordre: String,
    pub date_edition: String,
    pub objet: String,
    pub motif: Option<String>,
    pub filtre_banque: Option<String>,
    pub filtre_enseignant_id: Option<String>,
    pub filtre_mois: Option<String>,
    pub filtre_annee: Option<i64>,
    pub filtre_annee_scolaire: Option<String>,
    pub filtre_promotion_id: Option<i64>,
    pub filtre_cycle_id: Option<i64>,
    pub filtre_module_id: Option<i64>,
    pub filtre_matiere_id: Option<i64>,
    pub filtre_date_debut: Option<String>,
    pub filtre_date_fin: Option<String>,
    pub created_at: String,
    pub created_by: Option<String>,
}

// =========================
// 📌 LIQUIDATION ROW
// =========================
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct LiquidationRow {
    pub id: i64,
    pub nom: String,
    pub prenom: String,
    pub titre: String,
    pub statut: String,
    pub cycle_designation: String,
    pub module_designation: String,
    pub matiere_designation: String,
    pub banque_designation: Option<String>,
    pub numero_compte: Option<String>,
    pub cle_rib: Option<String>,
    pub vhoraire_matiere: f64,
    pub nb_classe: f64,
    pub taux_horaire: f64,
    pub taux_retenue: f64,
    pub vht: f64,
    pub montant_brut: f64,
    pub montant_retenu: f64,
    pub montant_net: f64,
    pub mois: String,
    pub annee: i64,
    pub annee_scolaire: String,
    pub promotion_libelle: Option<String>,
}

// =========================
// 📌 RÉCAP ENSEIGNANT
// =========================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecapEnseignant {
    pub enseignant_id: i64,
    pub annee_scolaire: String,
    pub lignes: Vec<LigneRecap>,
    pub total_vacations: i64,
    pub total_classes: f64,
    pub total_heures: f64,
    pub total_brut: f64,
    pub total_retenu: f64,
    pub total_net: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct LigneRecap {
    pub mois: String,
    pub annee: i64,
    pub nombre_vacations: i64,
    pub total_classes: f64,
    pub total_heures: f64,
    pub total_brut: f64,
    pub total_retenu: f64,
    pub total_net: f64,
}

// =========================
// 📌 FILTRES POUR ORDRES
// =========================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrdreFiltres {
    pub filtre_banque: Option<String>,
    pub filtre_enseignant_id: Option<String>,
    pub filtre_mois: Option<String>,
    pub filtre_annee: Option<i64>,
    pub filtre_annee_scolaire: Option<String>,
    pub filtre_promotion_id: Option<i64>,
    pub filtre_cycle_id: Option<i64>,
    pub filtre_module_id: Option<i64>,
    pub filtre_matiere_id: Option<i64>,
    pub filtre_date_debut: Option<String>,
    pub filtre_date_fin: Option<String>,
}

// =========================
// 📌 RÉPONSE GÉNÉRIQUE
// =========================
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

// =========================
// 📌 IMPLEMENTATIONS
// =========================

impl Default for ApiResponse<()> {
    fn default() -> Self {
        Self {
            success: true,
            data: None,
            error: None,
        }
    }
}