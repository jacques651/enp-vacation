// src-tauri/src/commands/signataires.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Signataire {
    pub id: i32,
    pub nom: String,
    pub prenom: String,
    pub grade: Option<String>,
    pub fonction: Option<String>,
    pub titre_honorifique: Option<String>,
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Deserialize)]
pub struct CreateSignataire {
    pub nom: String,
    pub prenom: String,
    pub grade: Option<String>,
    pub fonction: Option<String>,
    pub titre_honorifique: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSignataire {
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub grade: Option<String>,
    pub fonction: Option<String>,
    pub titre_honorifique: Option<String>,
}

// =========================
// VALIDATION
// =========================

fn validate(nom: &str, prenom: &str) -> Result<(), String> {
    if nom.trim().is_empty() {
        return Err("Nom obligatoire".into());
    }

    if prenom.trim().is_empty() {
        return Err("Prénom obligatoire".into());
    }

    Ok(())
}

// =========================
// GET ALL
// =========================

#[tauri::command]
pub async fn get_signataires(
    state: State<'_, DbState>,
) -> Result<Vec<Signataire>, String> {

    sqlx::query_as::<_, Signataire>(
        "SELECT id, nom, prenom, grade, fonction, titre_honorifique 
         FROM signataires 
         ORDER BY nom, prenom"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// GET BY ID
// =========================

#[tauri::command]
pub async fn get_signataire_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<Signataire, String> {

    sqlx::query_as::<_, Signataire>(
        "SELECT id, nom, prenom, grade, fonction, titre_honorifique 
         FROM signataires WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Signataire non trouvé".into())
}

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_signataire(
    state: State<'_, DbState>,
    data: CreateSignataire,
) -> Result<Signataire, String> {

    validate(&data.nom, &data.prenom)?;

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO signataires (nom, prenom, grade, fonction, titre_honorifique)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id
        "#
    )
    .bind(&data.nom)
    .bind(&data.prenom)
    .bind(&data.grade)
    .bind(&data.fonction)
    .bind(&data.titre_honorifique)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_signataire_by_id(state, id).await
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_signataire(
    state: State<'_, DbState>,
    id: i32,
    data: UpdateSignataire,
) -> Result<Signataire, String> {

    let current = get_signataire_by_id(state.clone(), id).await?;

    let nom = data.nom.unwrap_or(current.nom);
    let prenom = data.prenom.unwrap_or(current.prenom);

    validate(&nom, &prenom)?;

    sqlx::query(
        r#"
        UPDATE signataires
        SET nom = ?, prenom = ?, grade = ?, fonction = ?, titre_honorifique = ?
        WHERE id = ?
        "#
    )
    .bind(&nom)
    .bind(&prenom)
    .bind(data.grade.or(current.grade))
    .bind(data.fonction.or(current.fonction))
    .bind(data.titre_honorifique.or(current.titre_honorifique))
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_signataire_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_signataire(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM signataires WHERE id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if exists == 0 {
        return Err("Signataire non trouvé".into());
    }

    sqlx::query("DELETE FROM signataires WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// =========================
// SEARCH
// =========================

#[tauri::command]
pub async fn search_signataires(
    state: State<'_, DbState>,
    search: String,
) -> Result<Vec<Signataire>, String> {

    let pattern = format!("%{}%", search);

    sqlx::query_as::<_, Signataire>(
        "SELECT id, nom, prenom, grade, fonction, titre_honorifique 
         FROM signataires 
         WHERE nom LIKE ? OR prenom LIKE ?
         ORDER BY nom, prenom"
    )
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}