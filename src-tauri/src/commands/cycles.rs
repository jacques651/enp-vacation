// src-tauri/src/commands/cycles.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use tauri::State;
use sqlx::FromRow;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Cycle {
    pub id: i32,
    pub designation: String,
    pub nb_classe: i32,
}

// =========================
// VALIDATION
// =========================

fn validate(designation: &str, nb_classe: i32) -> Result<(), String> {
    if designation.trim().is_empty() {
        return Err("Désignation obligatoire".into());
    }

    if nb_classe <= 0 {
        return Err("Le nombre de classes doit être supérieur à 0".into());
    }

    Ok(())
}

// =========================
// GET ALL
// =========================

#[tauri::command]
pub async fn get_cycles(
    state: State<'_, DbState>,
) -> Result<Vec<Cycle>, String> {

    sqlx::query_as::<_, Cycle>(
        "SELECT id, designation, nb_classe FROM cycles ORDER BY designation"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// GET BY ID
// =========================

#[tauri::command]
pub async fn get_cycle_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<Cycle, String> {

    sqlx::query_as::<_, Cycle>(
        "SELECT id, designation, nb_classe FROM cycles WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Cycle non trouvé".into())
}

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_cycle(
    state: State<'_, DbState>,
    designation: String,
    nb_classe: i32,
) -> Result<Cycle, String> {

    validate(&designation, nb_classe)?;

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO cycles (designation, nb_classe)
        VALUES (?, ?)
        RETURNING id
        "#
    )
    .bind(&designation)
    .bind(nb_classe)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ce cycle existe déjà".into()
        } else {
            e.to_string()
        }
    })?;

    get_cycle_by_id(state, id).await
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_cycle(
    state: State<'_, DbState>,
    id: i32,
    designation: String,
    nb_classe: i32,
) -> Result<Cycle, String> {

    validate(&designation, nb_classe)?;

    let exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM cycles WHERE id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if exists == 0 {
        return Err("Cycle non trouvé".into());
    }

    sqlx::query(
        "UPDATE cycles SET designation = ?, nb_classe = ? WHERE id = ?"
    )
    .bind(&designation)
    .bind(nb_classe)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_cycle_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_cycle(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM cycles WHERE id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if exists == 0 {
        return Err("Cycle non trouvé".into());
    }

    // 🔴 CONTRAINTE MÉTIER IMPORTANTE
    let used: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM modules WHERE cycle_id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if used == 1 {
        return Err("Impossible : cycle utilisé par des modules".into());
    }

    sqlx::query("DELETE FROM cycles WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}