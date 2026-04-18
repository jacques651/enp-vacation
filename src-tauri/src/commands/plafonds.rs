// src-tauri/src/commands/plafonds.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Plafond {
    pub id: i32,
    pub titre: String,
    pub statut: String,
    pub volume_horaire_max: i32,
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Deserialize)]
pub struct CreatePlafond {
    pub titre: String,
    pub statut: String,
    pub volume_horaire_max: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePlafond {
    pub titre: Option<String>,
    pub statut: Option<String>,
    pub volume_horaire_max: Option<i32>,
}

// =========================
// VALIDATION
// =========================

fn validate(titre: &str, statut: &str, volume: i32) -> Result<(), String> {
    if titre.trim().is_empty() {
        return Err("Titre obligatoire".into());
    }

    if statut != "interne" && statut != "externe" {
        return Err("Statut invalide (interne / externe)".into());
    }

    if volume <= 0 {
        return Err("Volume horaire doit être > 0".into());
    }

    Ok(())
}

// =========================
// GET ALL
// =========================

#[tauri::command]
pub async fn get_plafonds(
    state: State<'_, DbState>,
) -> Result<Vec<Plafond>, String> {

    sqlx::query_as::<_, Plafond>(
        "SELECT id, titre, statut, volume_horaire_max FROM plafonds ORDER BY titre, statut"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// GET BY ID
// =========================

#[tauri::command]
pub async fn get_plafond_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<Plafond, String> {

    sqlx::query_as::<_, Plafond>(
        "SELECT id, titre, statut, volume_horaire_max FROM plafonds WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Plafond non trouvé".into())
}

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_plafond(
    state: State<'_, DbState>,
    data: CreatePlafond,
) -> Result<Plafond, String> {

    validate(&data.titre, &data.statut, data.volume_horaire_max)?;

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO plafonds (titre, statut, volume_horaire_max)
        VALUES (?, ?, ?)
        RETURNING id
        "#
    )
    .bind(&data.titre)
    .bind(&data.statut)
    .bind(data.volume_horaire_max)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ce plafond existe déjà".into()
        } else {
            e.to_string()
        }
    })?;

    get_plafond_by_id(state, id).await
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_plafond(
    state: State<'_, DbState>,
    id: i32,
    data: UpdatePlafond,
) -> Result<Plafond, String> {

    let current = get_plafond_by_id(state.clone(), id).await?;

    let titre = data.titre.unwrap_or(current.titre);
    let statut = data.statut.unwrap_or(current.statut);
    let volume = data.volume_horaire_max.unwrap_or(current.volume_horaire_max);

    validate(&titre, &statut, volume)?;

    sqlx::query(
        r#"
        UPDATE plafonds
        SET titre = ?, statut = ?, volume_horaire_max = ?
        WHERE id = ?
        "#
    )
    .bind(&titre)
    .bind(&statut)
    .bind(volume)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_plafond_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_plafond(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let plafond = get_plafond_by_id(state.clone(), id).await?;

    let used: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM enseignants WHERE titre = ? AND statut = ?)"
    )
    .bind(&plafond.titre)
    .bind(&plafond.statut)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if used == 1 {
        return Err("Impossible : plafond utilisé par des enseignants".into());
    }

    sqlx::query("DELETE FROM plafonds WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// =========================
// GET PAR TITRE + STATUT
// =========================

#[tauri::command]
pub async fn get_volume_horaire_max(
    state: State<'_, DbState>,
    titre: String,
    statut: String,
) -> Result<i32, String> {

    let volume: i32 = sqlx::query_scalar(
        "SELECT volume_horaire_max FROM plafonds WHERE titre = ? AND statut = ?"
    )
    .bind(titre)
    .bind(statut)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Plafond non trouvé".to_string())?;

    Ok(volume)
}