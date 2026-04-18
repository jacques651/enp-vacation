// src-tauri/src/commands/promotions.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Promotion {
    pub id: i32,
    pub libelle: String,
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Deserialize)]
pub struct CreatePromotion {
    pub libelle: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePromotion {
    pub libelle: String,
}

// =========================
// GET ALL
// =========================

#[tauri::command]
pub async fn get_promotions(
    state: State<'_, DbState>,
) -> Result<Vec<Promotion>, String> {

    sqlx::query_as::<_, Promotion>(
        "SELECT id, libelle FROM promotions ORDER BY libelle"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// GET BY ID
// =========================

#[tauri::command]
pub async fn get_promotion_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<Promotion, String> {

    sqlx::query_as::<_, Promotion>(
        "SELECT id, libelle FROM promotions WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Promotion non trouvée".into())
}

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_promotion(
    state: State<'_, DbState>,
    data: CreatePromotion,
) -> Result<Promotion, String> {

    if data.libelle.trim().is_empty() {
        return Err("Libellé obligatoire".into());
    }

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO promotions (libelle)
        VALUES (?)
        RETURNING id
        "#
    )
    .bind(&data.libelle)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_promotion_by_id(state, id).await
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_promotion(
    state: State<'_, DbState>,
    id: i32,
    data: UpdatePromotion,
) -> Result<Promotion, String> {

    sqlx::query(
        r#"
        UPDATE promotions
        SET libelle = ?
        WHERE id = ?
        "#
    )
    .bind(&data.libelle)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_promotion_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_promotion(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let used: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM vacations WHERE promotion_id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if used == 1 {
        return Err("Impossible : promotion utilisée dans des vacations".into());
    }

    sqlx::query("DELETE FROM promotions WHERE id = ?")
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
pub async fn search_promotions(
    state: State<'_, DbState>,
    search: String,
) -> Result<Vec<Promotion>, String> {

    let pattern = format!("%{}%", search);

    sqlx::query_as::<_, Promotion>(
        "SELECT id, libelle FROM promotions WHERE libelle LIKE ? ORDER BY libelle"
    )
    .bind(pattern)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}