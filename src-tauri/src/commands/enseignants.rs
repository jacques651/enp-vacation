// src-tauri/src/commands/enseignants.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use tauri::State;
use sqlx::FromRow;

// =========================
// MODELES
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Enseignant {
    pub id: i32,
    pub nom: String,
    pub prenom: String,
    pub telephone: Option<String>,
    pub titre: String,
    pub statut: String,
    pub vh_max: f64,  // ← AJOUTÉ
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEnseignantInput {
    pub nom: String,
    pub prenom: String,
    pub telephone: Option<String>,
    pub titre: String,
    pub statut: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateEnseignantInput {
    pub nom: String,
    pub prenom: String,
    pub telephone: Option<String>,
    pub titre: String,
    pub statut: String,
}

// =========================
// STRUCTURE CUMUL (IMPORTANT)
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct EnseignantCumul {
    pub id: i32,
    pub nom: String,
    pub prenom: String,
    pub titre: String,
    pub statut: String,
    pub volume_max: i32,
    pub heures_consommees: f64,
    pub heures_restantes: f64,
}

// =========================
// GET ALL
// =========================

#[tauri::command]
pub async fn get_enseignants(
    state: State<'_, DbState>,
) -> Result<Vec<Enseignant>, String> {
    sqlx::query_as::<_, Enseignant>(
        "SELECT id, nom, prenom, telephone, titre, statut, vh_max FROM enseignants ORDER BY nom, prenom"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// GET BY ID
// =========================

#[tauri::command]
pub async fn get_enseignant_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<Enseignant, String> {
    sqlx::query_as::<_, Enseignant>(
        "SELECT id, nom, prenom, telephone, titre, statut, vh_max FROM enseignants WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Enseignant non trouvé".to_string())
}

// =========================
// CREATE - Avec auto-remplissage de vh_max
// =========================

#[tauri::command]
pub async fn create_enseignant(
    state: State<'_, DbState>,
    input: CreateEnseignantInput,
) -> Result<Enseignant, String> {

    // Vérifier que le plafond existe pour ce couple (titre, statut)
    let vh_max: i32 = sqlx::query_scalar(
        "SELECT volume_horaire_max FROM plafonds WHERE titre = ? AND statut = ?"
    )
    .bind(&input.titre)
    .bind(&input.statut)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| format!("Plafond non trouvé pour titre='{}' et statut='{}'", input.titre, input.statut))?;

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO enseignants (nom, prenom, telephone, titre, statut, vh_max)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
        "#
    )
    .bind(&input.nom)
    .bind(&input.prenom)
    .bind(&input.telephone)
    .bind(&input.titre)
    .bind(&input.statut)
    .bind(vh_max as f64)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_enseignant_by_id(state, id).await
}

// =========================
// UPDATE - Avec recalcul de vh_max si titre/statut changent
// =========================

#[tauri::command]
pub async fn update_enseignant(
    state: State<'_, DbState>,
    id: i32,
    input: UpdateEnseignantInput,
) -> Result<Enseignant, String> {

    // Récupérer l'ancien enseignant
    let old = get_enseignant_by_id(state.clone(), id).await?;
    
    // Déterminer la nouvelle valeur de vh_max
    let vh_max = if old.titre != input.titre || old.statut != input.statut {
        // Si titre ou statut a changé, aller chercher le nouveau plafond
        let new_max: i32 = sqlx::query_scalar(
            "SELECT volume_horaire_max FROM plafonds WHERE titre = ? AND statut = ?"
        )
        .bind(&input.titre)
        .bind(&input.statut)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| format!("Plafond non trouvé pour titre='{}' et statut='{}'", input.titre, input.statut))?;
        new_max as f64
    } else {
        // Sinon, garder l'ancienne valeur
        old.vh_max
    };

    sqlx::query(
        r#"
        UPDATE enseignants
        SET nom = ?, prenom = ?, telephone = ?, titre = ?, statut = ?, vh_max = ?
        WHERE id = ?
        "#
    )
    .bind(&input.nom)
    .bind(&input.prenom)
    .bind(&input.telephone)
    .bind(&input.titre)
    .bind(&input.statut)
    .bind(vh_max)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_enseignant_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_enseignant(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let has_vacations: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM vacations WHERE enseignant_id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if has_vacations == 1 {
        return Err("Impossible de supprimer : vacations existantes".into());
    }

    sqlx::query("DELETE FROM enseignants WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// =========================
// CUMUL AVEC PLAFOND (IMPORTANT)
// =========================

#[tauri::command]
pub async fn get_enseignants_with_cumul(
    state: State<'_, DbState>,
    annee_scolaire_id: i32,
) -> Result<Vec<EnseignantCumul>, String> {

    sqlx::query_as::<_, EnseignantCumul>(
        r#"
        SELECT 
            e.id,
            e.nom,
            e.prenom,
            e.titre,
            e.statut,

            e.vh_max AS volume_max,

            COALESCE(SUM(v.nb_classe * v.vhoraire), 0) AS heures_consommees,

            (e.vh_max - COALESCE(SUM(v.nb_classe * v.vhoraire), 0)) 
            AS heures_restantes

        FROM enseignants e

        LEFT JOIN vacations v 
            ON v.enseignant_id = e.id
           AND v.annee_scolaire_id = ?

        GROUP BY e.id
        ORDER BY e.nom, e.prenom
        "#
    )
    .bind(annee_scolaire_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}