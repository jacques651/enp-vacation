// src-tauri/src/commands/cycles.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use serde_json::Value;
use sqlx::FromRow;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Cycle {
    pub id: i32,
    pub designation: String,
    pub nb_classe: i32,
}

fn validate(designation: &str, nb_classe: i32) -> Result<(), String> {
    if designation.trim().is_empty() {
        return Err("La désignation est obligatoire".to_string());
    }
    if nb_classe <= 0 {
        return Err("Le nombre de classes doit être supérieur à 0".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_cycles(state: State<'_, DbState>) -> Result<Vec<Cycle>, String> {
    let cycles = sqlx::query_as::<_, Cycle>(
        "SELECT id, designation, nb_classe FROM cycles ORDER BY id"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Erreur: {}", e))?;
    Ok(cycles)
}

#[tauri::command]
pub async fn get_cycle_by_id(state: State<'_, DbState>, id: i32) -> Result<Cycle, String> {
    let cycle = sqlx::query_as::<_, Cycle>(
        "SELECT id, designation, nb_classe FROM cycles WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| format!("Cycle id {} non trouvé", id))?;
    Ok(cycle)
}

#[tauri::command]
pub async fn create_cycle(
    state: State<'_, DbState>,
    payload: Value,
) -> Result<Cycle, String> {
    println!("=== CREATE CYCLE PAYLOAD ===");
    println!("{:?}", payload);
    
    let designation = payload.get("designation")
        .and_then(|v| v.as_str())
        .ok_or("designation manquante")?
        .to_string();
    
    let nb_classe = payload.get("nb_classe")
        .or_else(|| payload.get("nbClasse"))
        .and_then(|v| v.as_i64())
        .ok_or("nb_classe ou nbClasse manquant")? as i32;
    
    validate(&designation, nb_classe)?;
    
    let exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM cycles WHERE designation = ?)"
    )
    .bind(&designation)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    
    if exists > 0 {
        return Err(format!("Le cycle '{}' existe déjà", designation));
    }
    
    let id: i32 = sqlx::query_scalar(
        "INSERT INTO cycles (designation, nb_classe) VALUES (?, ?) RETURNING id"
    )
    .bind(&designation)
    .bind(nb_classe)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    
    get_cycle_by_id(state, id).await
}

#[tauri::command]
pub async fn update_cycle(
    state: State<'_, DbState>,
    payload: Value,
) -> Result<Cycle, String> {
    let id = payload.get("id")
        .and_then(|v| v.as_i64())
        .ok_or("id manquant")? as i32;
    
    let designation = payload.get("designation")
        .and_then(|v| v.as_str())
        .ok_or("designation manquante")?
        .to_string();
    
    let nb_classe = payload.get("nb_classe")
        .or_else(|| payload.get("nbClasse"))
        .and_then(|v| v.as_i64())
        .ok_or("nb_classe manquant")? as i32;
    
    validate(&designation, nb_classe)?;
    
    let exists: i64 = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM cycles WHERE id = ?)")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if exists == 0 {
        return Err(format!("Cycle id {} non trouvé", id));
    }
    
    sqlx::query("UPDATE cycles SET designation = ?, nb_classe = ? WHERE id = ?")
        .bind(&designation)
        .bind(nb_classe)
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    
    get_cycle_by_id(state, id).await
}

#[tauri::command]
pub async fn delete_cycle(state: State<'_, DbState>, id: i32) -> Result<(), String> {
    let exists: i64 = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM cycles WHERE id = ?)")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if exists == 0 {
        return Err(format!("Cycle id {} non trouvé", id));
    }
    
    let used: i64 = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM modules WHERE cycle_id = ?)")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if used > 0 {
        return Err("Cycle utilisé par des modules".to_string());
    }
    
    sqlx::query("DELETE FROM cycles WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
#[tauri::command]
pub async fn search_cycles(
    state: State<'_, DbState>,
    search: String,
) -> Result<Vec<Cycle>, String> {
    let search_pattern = format!("%{}%", search);
    let cycles = sqlx::query_as::<_, Cycle>(
        "SELECT id, designation, nb_classe FROM cycles WHERE designation LIKE ? ORDER BY id"
    )
    .bind(&search_pattern)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Erreur recherche: {}", e))?;
    Ok(cycles)
}

#[tauri::command]
pub async fn count_cycles(state: State<'_, DbState>) -> Result<i64, String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM cycles")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Erreur comptage: {}", e))?;
    Ok(count)
}

#[tauri::command]
pub async fn get_cycle_by_designation(
    state: State<'_, DbState>,
    designation: String,
) -> Result<Option<Cycle>, String> {
    let cycle = sqlx::query_as::<_, Cycle>(
        "SELECT id, designation, nb_classe FROM cycles WHERE designation = ?"
    )
    .bind(&designation)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| format!("Erreur recherche: {}", e))?;
    Ok(cycle)
}