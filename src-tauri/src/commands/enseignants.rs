// src-tauri/src/commands/enseignants.rs

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;

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
pub async fn get_enseignants(state: State<'_, DbState>) -> Result<Vec<Enseignant>, String> {
    sqlx::query_as::<_, Enseignant>("SELECT * FROM enseignants ORDER BY nom, prenom")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_enseignant(
    state: State<'_, DbState>,
    input: CreateEnseignantInput,
) -> Result<Enseignant, String> {
    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO enseignants (nom, prenom, telephone, titre, statut)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id
        "#,
    )
    .bind(&input.nom)
    .bind(&input.prenom)
    .bind(&input.telephone)
    .bind(&input.titre)
    .bind(&input.statut)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_enseignant_by_id(state, id).await
}

// =========================
// GET BY ID
// =========================

#[tauri::command]
pub async fn get_enseignant_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<Enseignant, String> {
    sqlx::query_as::<_, Enseignant>("SELECT * FROM enseignants WHERE id = ?")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| "Enseignant non trouvé".to_string())
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_enseignant(
    state: State<'_, DbState>,
    id: i32,
    input: UpdateEnseignantInput,
) -> Result<Enseignant, String> {
    sqlx::query(
        r#"
        UPDATE enseignants
        SET nom = ?, prenom = ?, telephone = ?, titre = ?, statut = ?
        WHERE id = ?
        "#,
    )
    .bind(&input.nom)
    .bind(&input.prenom)
    .bind(&input.telephone)
    .bind(&input.titre)
    .bind(&input.statut)
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
pub async fn delete_enseignant(state: State<'_, DbState>, id: i32) -> Result<(), String> {
    let has_vacations: i64 =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM vacations WHERE enseignant_id = ?)")
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

    if has_vacations == 1 {
        return Err("Impossible de supprimer : vacations existantes".into());
    }

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM comptes_bancaires WHERE enseignant_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    let result = sqlx::query("DELETE FROM enseignants WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Enseignant non trouve".into());
    }

    tx.commit().await.map_err(|e| e.to_string())?;

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

            p.volume_horaire_max AS volume_max,

            COALESCE(SUM(v.vht), 0) AS heures_consommees,

            (p.volume_horaire_max - COALESCE(SUM(v.vht), 0)) 
            AS heures_restantes

        FROM enseignants e

        JOIN plafonds p 
            ON p.titre = e.titre AND p.statut = e.statut

        LEFT JOIN vacations v 
            ON v.enseignant_id = e.id
           AND v.annee_scolaire_id = ?

        GROUP BY e.id
        ORDER BY e.nom, e.prenom
        "#,
    )
    .bind(annee_scolaire_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}
