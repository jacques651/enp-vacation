// src-tauri/src/commands/entete.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Entete {
    pub id: i32,
    pub cle: String,
    pub valeur: Option<String>,
}

// =========================
// VALIDATION
// =========================

fn validate(cle: &str) -> Result<(), String> {
    if cle.trim().is_empty() {
        return Err("Clé obligatoire".into());
    }
    Ok(())
}

// =========================
// GET ALL
// =========================

#[tauri::command]
pub async fn get_entetes(
    state: State<'_, DbState>,
) -> Result<Vec<Entete>, String> {

    sqlx::query_as::<_, Entete>(
        "SELECT id, cle, valeur FROM entete ORDER BY cle"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// GET BY KEY
// =========================

#[tauri::command]
pub async fn get_entete_by_key(
    state: State<'_, DbState>,
    cle: String,
) -> Result<Entete, String> {

    sqlx::query_as::<_, Entete>(
        "SELECT id, cle, valeur FROM entete WHERE cle = ?"
    )
    .bind(&cle)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Entête non trouvée".into())
}

// =========================
// UPSERT (IMPORTANT)
// =========================

#[tauri::command]
pub async fn set_entete_value(
    state: State<'_, DbState>,
    cle: String,
    valeur: Option<String>,
) -> Result<Entete, String> {

    validate(&cle)?;

    let entete = sqlx::query_as::<_, Entete>(
        r#"
        INSERT INTO entete (cle, valeur)
        VALUES (?, ?)
        ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur
        RETURNING id, cle, valeur
        "#
    )
    .bind(&cle)
    .bind(&valeur)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(entete)
}

// =========================
// GET VALUE
// =========================

#[tauri::command]
pub async fn get_entete_value(
    state: State<'_, DbState>,
    cle: String,
    default_value: Option<String>,
) -> Result<String, String> {

    let value: Option<String> = sqlx::query_scalar(
        "SELECT valeur FROM entete WHERE cle = ?"
    )
    .bind(&cle)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(value.unwrap_or(default_value.unwrap_or_default()))
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_entete(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM entete WHERE id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if exists == 0 {
        return Err("Entête non trouvée".into());
    }

    sqlx::query("DELETE FROM entete WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}