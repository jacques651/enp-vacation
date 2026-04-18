// src-tauri/src/commands/banques.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use tauri::State;
use sqlx::FromRow;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Banque {
    pub id: i32,
    pub designation: String,
}

// =========================
// GET ALL
// =========================

#[tauri::command]
pub async fn get_banques(
    state: State<'_, DbState>,
) -> Result<Vec<Banque>, String> {

    sqlx::query_as::<_, Banque>(
        "SELECT id, designation FROM banques ORDER BY designation"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// GET BY ID
// =========================

#[tauri::command]
pub async fn get_banque_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<Banque, String> {

    sqlx::query_as::<_, Banque>(
        "SELECT id, designation FROM banques WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Banque non trouvée".into())
}

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_banque(
    state: State<'_, DbState>,
    designation: String,
) -> Result<Banque, String> {

    if designation.trim().is_empty() {
        return Err("Désignation obligatoire".into());
    }

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO banques (designation)
        VALUES (?)
        RETURNING id
        "#
    )
    .bind(&designation)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Cette banque existe déjà".into()
        } else {
            e.to_string()
        }
    })?;

    get_banque_by_id(state, id).await
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_banque(
    state: State<'_, DbState>,
    id: i32,
    designation: String,
) -> Result<Banque, String> {

    if designation.trim().is_empty() {
        return Err("Désignation obligatoire".into());
    }

    let exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM banques WHERE id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if exists == 0 {
        return Err("Banque non trouvée".into());
    }

    sqlx::query(
        "UPDATE banques SET designation = ? WHERE id = ?"
    )
    .bind(&designation)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_banque_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_banque(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM banques WHERE id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if exists == 0 {
        return Err("Banque non trouvée".into());
    }

    // ✅ CORRECTION IMPORTANTE
    let used: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM comptes_bancaires WHERE banque_id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if used == 1 {
        return Err("Impossible : banque utilisée dans des comptes bancaires".into());
    }

    sqlx::query("DELETE FROM banques WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}