// src-tauri/src/commands/matieres.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Matiere {
    pub id: i32,
    pub designation: String,
    pub vhoraire: f64,
    pub module_id: i32,
    pub module_designation: Option<String>,
    pub cycle_designation: Option<String>,
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Deserialize)]
pub struct CreateMatiere {
    pub designation: String,
    pub vhoraire: f64,
    pub module_id: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMatiere {
    pub designation: Option<String>,
    pub vhoraire: Option<f64>,
    pub module_id: Option<i32>,
}

// =========================
// VALIDATION
// =========================

fn validate(designation: &str, vhoraire: f64) -> Result<(), String> {
    if designation.trim().is_empty() {
        return Err("Désignation obligatoire".into());
    }

    if vhoraire <= 0.0 {
        return Err("Le volume horaire doit être > 0".into());
    }

    Ok(())
}

// =========================
// GET ALL
// =========================

#[tauri::command]
pub async fn get_matieres(
    state: State<'_, DbState>,
) -> Result<Vec<Matiere>, String> {

    sqlx::query_as::<_, Matiere>(
        r#"
        SELECT 
            m.id,
            m.designation,
            m.vhoraire,
            m.module_id,
            mod.designation AS module_designation,
            c.designation AS cycle_designation
        FROM matieres m
        JOIN modules mod ON mod.id = m.module_id
        JOIN cycles c ON c.id = mod.cycle_id
        ORDER BY m.designation
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// GET BY ID
// =========================

#[tauri::command]
pub async fn get_matiere_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<Matiere, String> {

    sqlx::query_as::<_, Matiere>(
        r#"
        SELECT 
            m.id,
            m.designation,
            m.vhoraire,
            m.module_id,
            mod.designation AS module_designation,
            c.designation AS cycle_designation
        FROM matieres m
        JOIN modules mod ON mod.id = m.module_id
        JOIN cycles c ON c.id = mod.cycle_id
        WHERE m.id = ?
        "#
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Matière non trouvée".into())
}

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_matiere(
    state: State<'_, DbState>,
    data: CreateMatiere,
) -> Result<Matiere, String> {

    validate(&data.designation, data.vhoraire)?;

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO matieres (designation, vhoraire, module_id)
        VALUES (?, ?, ?)
        RETURNING id
        "#
    )
    .bind(&data.designation)
    .bind(data.vhoraire)
    .bind(data.module_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Cette matière existe déjà dans ce module".into()
        } else {
            e.to_string()
        }
    })?;

    get_matiere_by_id(state, id).await
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_matiere(
    state: State<'_, DbState>,
    id: i32,
    data: UpdateMatiere,
) -> Result<Matiere, String> {

    let current = get_matiere_by_id(state.clone(), id).await?;

    let designation = data.designation.unwrap_or(current.designation);
    let vhoraire = data.vhoraire.unwrap_or(current.vhoraire);
    let module_id = data.module_id.unwrap_or(current.module_id);

    validate(&designation, vhoraire)?;

    sqlx::query(
        r#"
        UPDATE matieres
        SET designation = ?, vhoraire = ?, module_id = ?
        WHERE id = ?
        "#
    )
    .bind(&designation)
    .bind(vhoraire)
    .bind(module_id)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_matiere_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_matiere(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let used: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM vacations WHERE matiere_id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if used == 1 {
        return Err("Impossible : matière utilisée dans des vacations".into());
    }

    sqlx::query("DELETE FROM matieres WHERE id = ?")
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
pub async fn search_matieres(
    state: State<'_, DbState>,
    search: String,
) -> Result<Vec<Matiere>, String> {

    let pattern = format!("%{}%", search);

    sqlx::query_as::<_, Matiere>(
        r#"
        SELECT 
            m.id,
            m.designation,
            m.vhoraire,
            m.module_id,
            mod.designation AS module_designation,
            c.designation AS cycle_designation
        FROM matieres m
        JOIN modules mod ON mod.id = m.module_id
        JOIN cycles c ON c.id = mod.cycle_id
        WHERE m.designation LIKE ?
        ORDER BY m.designation
        "#
    )
    .bind(pattern)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}