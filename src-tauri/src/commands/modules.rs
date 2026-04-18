// src-tauri/src/commands/modules.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Module {
    pub id: i32,
    pub designation: String,
    pub cycle_id: i32,
    pub cycle_designation: Option<String>,
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Deserialize)]
pub struct CreateModule {
    pub designation: String,
    pub cycle_id: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModule {
    pub designation: Option<String>,
    pub cycle_id: Option<i32>,
}

// =========================
// VALIDATION
// =========================

fn validate(designation: &str) -> Result<(), String> {
    if designation.trim().is_empty() {
        return Err("Désignation obligatoire".into());
    }
    Ok(())
}

// =========================
// GET ALL
// =========================

#[tauri::command]
pub async fn get_modules(
    state: State<'_, DbState>,
) -> Result<Vec<Module>, String> {

    sqlx::query_as::<_, Module>(
        r#"
        SELECT 
            m.id,
            m.designation,
            m.cycle_id,
            c.designation AS cycle_designation
        FROM modules m
        JOIN cycles c ON c.id = m.cycle_id
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
pub async fn get_module_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<Module, String> {

    sqlx::query_as::<_, Module>(
        r#"
        SELECT 
            m.id,
            m.designation,
            m.cycle_id,
            c.designation AS cycle_designation
        FROM modules m
        JOIN cycles c ON c.id = m.cycle_id
        WHERE m.id = ?
        "#
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Module non trouvé".into())
}

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_module(
    state: State<'_, DbState>,
    data: CreateModule,
) -> Result<Module, String> {

    validate(&data.designation)?;

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO modules (designation, cycle_id)
        VALUES (?, ?)
        RETURNING id
        "#
    )
    .bind(&data.designation)
    .bind(data.cycle_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("FOREIGN KEY") {
            "Cycle invalide".into()
        } else if e.to_string().contains("UNIQUE") {
            "Ce module existe déjà dans ce cycle".into()
        } else {
            e.to_string()
        }
    })?;

    get_module_by_id(state, id).await
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_module(
    state: State<'_, DbState>,
    id: i32,
    data: UpdateModule,
) -> Result<Module, String> {

    let current = get_module_by_id(state.clone(), id).await?;

    let designation = data.designation.unwrap_or(current.designation);
    let cycle_id = data.cycle_id.unwrap_or(current.cycle_id);

    validate(&designation)?;

    sqlx::query(
        r#"
        UPDATE modules
        SET designation = ?, cycle_id = ?
        WHERE id = ?
        "#
    )
    .bind(&designation)
    .bind(cycle_id)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_module_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_module(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let used: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM matieres WHERE module_id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if used == 1 {
        return Err("Impossible : module utilisé par des matières".into());
    }

    sqlx::query("DELETE FROM modules WHERE id = ?")
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
pub async fn search_modules(
    state: State<'_, DbState>,
    search: String,
) -> Result<Vec<Module>, String> {

    let pattern = format!("%{}%", search);

    sqlx::query_as::<_, Module>(
        r#"
        SELECT 
            m.id,
            m.designation,
            m.cycle_id,
            c.designation AS cycle_designation
        FROM modules m
        JOIN cycles c ON c.id = m.cycle_id
        WHERE m.designation LIKE ?
        ORDER BY m.designation
        "#
    )
    .bind(pattern)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}