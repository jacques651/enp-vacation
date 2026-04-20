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
// FONCTIONS DE NORMALISATION
// =========================

fn normalize_titre(titre: &str) -> String {
    match titre.to_lowercase().as_str() {
        t if t.contains("agent") => "agent".to_string(),
        t if t.contains("directeur") => "directeur".to_string(),
        t if t.contains("chef de service") => "chef de service".to_string(),
        t if t.contains("chef de division") => "chef de division/service".to_string(),
        t if t.contains("retraité") || t.contains("retraite") => "retraité".to_string(),
        _ => "autre".to_string(),
    }
}

fn normalize_statut(statut: &str) -> Result<String, String> {
    match statut.to_lowercase().as_str() {
        s if s.contains("interne") => Ok("interne".to_string()),
        s if s.contains("externe") => Ok("externe".to_string()),
        _ => Err(format!("Statut '{}' invalide (doit être: interne ou externe)", statut)),
    }
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
// CREATE (AVEC NORMALISATION)
// =========================

#[tauri::command]
pub async fn create_plafond(
    state: State<'_, DbState>,
    data: CreatePlafond,
) -> Result<Plafond, String> {

    // Normaliser les valeurs
    let titre = normalize_titre(&data.titre);
    let statut = normalize_statut(&data.statut)?;
    let volume = data.volume_horaire_max;

    validate(&titre, &statut, volume)?;

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO plafonds (titre, statut, volume_horaire_max)
        VALUES (?, ?, ?)
        RETURNING id
        "#
    )
    .bind(&titre)
    .bind(&statut)
    .bind(volume)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            format!("Le plafond '{}' pour le statut '{}' existe déjà", titre, statut)
        } else {
            e.to_string()
        }
    })?;

    get_plafond_by_id(state, id).await
}


// =========================
// UPDATE (CORRIGÉ)
// =========================

#[tauri::command]
pub async fn update_plafond(
    state: State<'_, DbState>,
    id: i32,
    data: UpdatePlafond,
) -> Result<Plafond, String> {

    let current = get_plafond_by_id(state.clone(), id).await?;

    // Utiliser des références pour éviter de déplacer les valeurs
    let titre = if let Some(ref t) = data.titre {
        normalize_titre(t)
    } else {
        current.titre.clone()
    };
    
    let statut = if let Some(ref s) = data.statut {
        normalize_statut(s)?
    } else {
        current.statut.clone()
    };
    
    let volume = data.volume_horaire_max.unwrap_or(current.volume_horaire_max);

    validate(&titre, &statut, volume)?;

    // Vérifier si le nouveau couple (titre, statut) existe déjà
    let titre_changed = data.titre.is_some() && titre != current.titre;
    let statut_changed = data.statut.is_some() && statut != current.statut;
    
    if titre_changed || statut_changed {
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM plafonds WHERE titre = ? AND statut = ? AND id != ?)"
        )
        .bind(&titre)
        .bind(&statut)
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists == 1 {
            return Err(format!("Le plafond '{}' pour le statut '{}' existe déjà", titre, statut));
        }
    }

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
        return Err(format!("Impossible de supprimer : le plafond '{}' pour le statut '{}' est utilisé par des enseignants", 
            plafond.titre, plafond.statut));
    }

    sqlx::query("DELETE FROM plafonds WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// =========================
// GET PAR TITRE + STATUT (AVEC NORMALISATION)
// =========================

#[tauri::command]
pub async fn get_volume_horaire_max(
    state: State<'_, DbState>,
    titre: String,
    statut: String,
) -> Result<i32, String> {

    // Normaliser les valeurs pour la recherche
    let titre_norm = normalize_titre(&titre);
    let statut_norm = normalize_statut(&statut)?;

    let volume: i32 = sqlx::query_scalar(
        "SELECT volume_horaire_max FROM plafonds WHERE titre = ? AND statut = ?"
    )
    .bind(&titre_norm)
    .bind(&statut_norm)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| format!("Plafond non trouvé pour titre='{}' et statut='{}'", titre_norm, statut_norm))?;

    Ok(volume)
}