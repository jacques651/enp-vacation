// src-tauri/src/commands/annees_scolaires.rs
// Ce fichier ne doit contenir que les commandes CRUD de base, PAS d'import

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AnneeScolaire {
    pub id: i32,
    pub libelle: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAnneeScolaire {
    pub libelle: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAnneeScolaire {
    pub libelle: Option<String>,
}

// ================= GET ALL =================
#[tauri::command]
pub async fn get_annees_scolaires(
    state: State<'_, DbState>,
) -> Result<Vec<AnneeScolaire>, String> {
    sqlx::query_as::<_, AnneeScolaire>(
        "SELECT id, libelle FROM annees_scolaires ORDER BY libelle DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// ================= GET BY ID =================
#[tauri::command]
pub async fn get_annee_scolaire_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<AnneeScolaire, String> {
    sqlx::query_as::<_, AnneeScolaire>(
        "SELECT id, libelle FROM annees_scolaires WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Année scolaire non trouvée".into())
}

// ================= CREATE =================
#[tauri::command]
pub async fn create_annee_scolaire(
    state: State<'_, DbState>,
    data: CreateAnneeScolaire,
) -> Result<AnneeScolaire, String> {
    if data.libelle.trim().is_empty() {
        return Err("Libellé obligatoire".into());
    }
    
    let result = sqlx::query_as::<_, AnneeScolaire>(
        "INSERT INTO annees_scolaires (libelle) VALUES (?) RETURNING id, libelle"
    )
    .bind(&data.libelle)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(result)
}

// ================= UPDATE =================
#[tauri::command]
pub async fn update_annee_scolaire(
    state: State<'_, DbState>,
    id: i32,
    data: UpdateAnneeScolaire,
) -> Result<AnneeScolaire, String> {
    let current = get_annee_scolaire_by_id(state.clone(), id).await?;
    let libelle = data.libelle.unwrap_or(current.libelle);
    
    if libelle.trim().is_empty() {
        return Err("Libellé obligatoire".into());
    }
    
    let result = sqlx::query_as::<_, AnneeScolaire>(
        "UPDATE annees_scolaires SET libelle = ? WHERE id = ? RETURNING id, libelle"
    )
    .bind(&libelle)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(result)
}

// ================= DELETE =================
#[tauri::command]
pub async fn delete_annee_scolaire(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {
    let affected = sqlx::query("DELETE FROM annees_scolaires WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?
        .rows_affected();
    
    if affected == 0 {
        return Err("Année scolaire non trouvée".into());
    }
    
    Ok(())
}

// ================= SEARCH =================
#[tauri::command]
pub async fn search_annees_scolaires(
    state: State<'_, DbState>,
    search: String,
) -> Result<Vec<AnneeScolaire>, String> {
    let pattern = format!("%{}%", search);
    
    sqlx::query_as::<_, AnneeScolaire>(
        "SELECT id, libelle FROM annees_scolaires WHERE libelle LIKE ? ORDER BY libelle DESC"
    )
    .bind(&pattern)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// ⚠️ NE PAS METTRE import_annees_scolaires ICI