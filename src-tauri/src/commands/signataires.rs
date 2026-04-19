// src-tauri/src/commands/signataires.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;
use chrono::NaiveDateTime;

// =========================
// MODELE (ALIGNÉ AVEC db.rs)
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Signataire {
    pub id: i32,
    pub nom: String,
    pub prenom: String,
    pub grade: Option<String>,
    pub fonction: String,        // fonction après grade
    pub titre: String,           // titre après fonction
    pub ordre_signature: i32,
    pub actif: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Deserialize)]
pub struct CreateSignataire {
    pub nom: String,
    pub prenom: String,
    pub grade: Option<String>,
    pub fonction: String,        // fonction après grade
    pub titre: String,
    pub ordre_signature: Option<i32>,
    pub actif: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSignataire {
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub grade: Option<String>,
    pub fonction: Option<String>, // fonction après grade
    pub titre: Option<String>,
    pub ordre_signature: Option<i32>,
    pub actif: Option<i32>,
}

// =========================
// VALIDATION
// =========================

fn validate(nom: &str, prenom: &str, grade: &Option<String>, fonction: &str, titre: &str) -> Result<(), String> {
    if nom.trim().is_empty() {
        return Err("Le nom est obligatoire".into());
    }

    if prenom.trim().is_empty() {
        return Err("Le prénom est obligatoire".into());
    }

    if let Some(grade) = grade {
        if grade.trim().is_empty() {
            return Err("Le grade ne peut pas être vide s'il est fourni".into());
        }
    }

    if fonction.trim().is_empty() {
        return Err("La fonction est obligatoire".into());
    }

    if titre.trim().is_empty() {
        return Err("Le titre est obligatoire".into());
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
        "SELECT id, nom, prenom, grade, fonction, titre, ordre_signature, actif, created_at, updated_at
         FROM signataires 
         ORDER BY ordre_signature ASC, nom, prenom"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors du chargement des signataires: {}", e))
}

// =========================
// GET ACTIFS
// =========================

#[tauri::command]
pub async fn get_signataires_actifs(
    state: State<'_, DbState>,
) -> Result<Vec<Signataire>, String> {

    sqlx::query_as::<_, Signataire>(
        "SELECT id, nom, prenom, grade, fonction, titre, ordre_signature, actif, created_at, updated_at
         FROM signataires 
         WHERE actif = 1
         ORDER BY ordre_signature ASC, nom, prenom"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors du chargement des signataires actifs: {}", e))
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
        "SELECT id, nom, prenom, grade, fonction, titre, ordre_signature, actif, created_at, updated_at
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

    validate(&data.nom, &data.prenom, &data.grade, &data.fonction, &data.titre)?;

    let ordre_signature = data.ordre_signature.unwrap_or(1);
    let actif = data.actif.unwrap_or(1);

    // Vérifier que l'ordre_signature est > 0
    if ordre_signature <= 0 {
        return Err("L'ordre de signature doit être supérieur à 0".into());
    }

    // Vérifier que actif est 0 ou 1
    if actif != 0 && actif != 1 {
        return Err("Le statut actif doit être 0 (inactif) ou 1 (actif)".into());
    }

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO signataires (nom, prenom, grade, fonction, titre, ordre_signature, actif, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
        "#
    )
    .bind(&data.nom)
    .bind(&data.prenom)
    .bind(&data.grade)
    .bind(&data.fonction)  // Correction : fonction après grade
    .bind(&data.titre)
    .bind(ordre_signature)
    .bind(actif)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de la création du signataire: {}", e))?;

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
    let grade = data.grade.or(current.grade);
    let fonction = data.fonction.unwrap_or(current.fonction);
    let titre = data.titre.unwrap_or(current.titre);

    validate(&nom, &prenom, &grade, &fonction, &titre)?;

    let ordre_signature = data.ordre_signature.unwrap_or(current.ordre_signature);
    let actif = data.actif.unwrap_or(current.actif);

    // Vérifier que l'ordre_signature est > 0
    if ordre_signature <= 0 {
        return Err("L'ordre de signature doit être supérieur à 0".into());
    }

    // Vérifier que actif est 0 ou 1
    if actif != 0 && actif != 1 {
        return Err("Le statut actif doit être 0 (inactif) ou 1 (actif)".into());
    }

    sqlx::query(
        r#"
        UPDATE signataires
        SET nom = ?, prenom = ?, grade = ?, fonction = ?, titre = ?, ordre_signature = ?, actif = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(&nom)
    .bind(&prenom)
    .bind(&grade)      // Correction : grade avant fonction
    .bind(&fonction)   // Correction : fonction après grade
    .bind(&titre)
    .bind(ordre_signature)
    .bind(actif)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de la mise à jour du signataire: {}", e))?;

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
        .map_err(|e| format!("Erreur lors de la suppression du signataire: {}", e))?;

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
        "SELECT id, nom, prenom, grade, fonction, titre, ordre_signature, actif, created_at, updated_at
         FROM signataires 
         WHERE nom LIKE ? OR prenom LIKE ? OR grade LIKE ? OR fonction LIKE ? OR titre LIKE ?
         ORDER BY ordre_signature ASC, nom, prenom"
    )
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de la recherche des signataires: {}", e))
}