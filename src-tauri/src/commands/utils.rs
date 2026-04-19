// src-tauri/src/commands/utils.rs

use crate::db::DbState;
use serde::Serialize;
use serde_json::json;
use sqlx::FromRow;
use tauri::State;

// =========================
// STRUCTS EXPORT
// =========================

#[derive(Serialize, FromRow)]
struct Cycle {
    id: i32,
    designation: String,
    nb_classe: i32,
}

#[derive(Serialize, FromRow)]
struct Module {
    id: i32,
    designation: String,
    cycle_id: i32,
}

#[derive(Serialize, FromRow)]
struct Matiere {
    id: i32,
    designation: String,
    vhoraire: f64,
    module_id: i32,
}

#[derive(Serialize, FromRow)]
struct Enseignant {
    id: i32,
    nom: String,
    prenom: String,
    telephone: Option<String>,
    titre: String,
    statut: String,
}

#[derive(Serialize, FromRow)]
struct Compte {
    id: i32,
    enseignant_id: i32,
    banque_id: i32,
    numero_compte: String,
    actif: i32,
}

#[derive(Serialize, FromRow)]
struct Banque {
    id: i32,
    designation: String,
}

#[derive(Serialize, FromRow)]
struct Promotion {
    id: i32,
    libelle: String,
}

#[derive(Serialize, FromRow)]
struct Annee {
    id: i32,
    libelle: String,
}

#[derive(Serialize, FromRow)]
struct Vacation {
    id: i32,
    enseignant_id: i32,
    matiere_id: i32,
    promotion_id: i32,
    annee_scolaire_id: i32,
    nb_classe: i32,
    vht: f64,
    taux_horaire: f64,
    taux_retenue: f64,
    mois: i32,
    annee: i32,
    date_traitement: Option<String>,
}

#[derive(Serialize, FromRow)]
struct Plafond {
    id: i32,
    titre: String,
    statut: String,
    volume_horaire_max: i32,
}

#[derive(Serialize, FromRow)]
struct Signataire {
    id: i32,
    nom: String,
    prenom: String,
    fonction: String,
    titre: String,
    ordre_signature: i32,
    actif: i32,
}

#[derive(Serialize, FromRow)]
struct Entete {
    id: i32,
    cle: String,
    valeur: Option<String>,
}

// =========================
// EXPORT JSON
// =========================

#[tauri::command]
pub async fn export_all_data_json(state: State<'_, DbState>) -> Result<String, String> {
    let cycles = sqlx::query_as::<_, Cycle>("SELECT * FROM cycles")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let modules = sqlx::query_as::<_, Module>("SELECT * FROM modules")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let matieres = sqlx::query_as::<_, Matiere>("SELECT * FROM matieres")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let enseignants = sqlx::query_as::<_, Enseignant>("SELECT * FROM enseignants")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let comptes = sqlx::query_as::<_, Compte>("SELECT * FROM comptes_bancaires")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let banques = sqlx::query_as::<_, Banque>("SELECT * FROM banques")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let promotions = sqlx::query_as::<_, Promotion>("SELECT * FROM promotions")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let annees = sqlx::query_as::<_, Annee>("SELECT * FROM annees_scolaires")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let vacations = sqlx::query_as::<_, Vacation>(
        "SELECT id, enseignant_id, matiere_id, promotion_id, annee_scolaire_id, nb_classe, vht, taux_horaire, taux_retenue, mois, annee, date_traitement FROM vacations",
    )
        .fetch_all(&state.pool).await.map_err(|e| e.to_string())?;

    let plafonds = sqlx::query_as::<_, Plafond>("SELECT * FROM plafonds")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let signataires = sqlx::query_as::<_, Signataire>(
        "SELECT id, nom, prenom, fonction, titre, ordre_signature, actif FROM signataires",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let entetes = sqlx::query_as::<_, Entete>("SELECT * FROM entete")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let export = json!({
        "cycles": cycles,
        "modules": modules,
        "matieres": matieres,
        "enseignants": enseignants,
        "comptes_bancaires": comptes,
        "banques": banques,
        "promotions": promotions,
        "annees_scolaires": annees,
        "vacations": vacations,
        "plafonds": plafonds,
        "signataires": signataires,
        "entete": entetes,
        "export_date": chrono::Local::now().to_string()
    });

    serde_json::to_string_pretty(&export).map_err(|e| e.to_string())
}
