// src-tauri/src/commands/comptes_bancaires.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CompteBancaire {
    pub id: i32,
    pub enseignant_id: i32,
    pub banque_id: i32,
    pub numero_compte: String,
    pub actif: i32, // SQLite utilise 0/1 pour les booléens
    pub banque: Option<String>,
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Deserialize)]
pub struct CreateCompte {
    pub enseignant_id: i32,
    pub banque_id: i32,
    pub numero_compte: String,
}

// =========================
// VALIDATION
// =========================

fn validate(numero: &str) -> Result<(), String> {
    if numero.trim().is_empty() {
        return Err("Numéro de compte obligatoire".into());
    }
    Ok(())
}

// =========================
// GET PAR ENSEIGNANT
// =========================

#[tauri::command]
pub async fn get_comptes_by_enseignant(
    state: State<'_, DbState>,
    enseignant_id: i32,
) -> Result<Vec<CompteBancaire>, String> {

    sqlx::query_as::<_, CompteBancaire>(
        r#"
        SELECT 
            cb.id,
            cb.enseignant_id,
            cb.banque_id,
            cb.numero_compte,
            cb.actif,
            b.designation as banque
        FROM comptes_bancaires cb
        JOIN banques b ON b.id = cb.banque_id
        WHERE cb.enseignant_id = ?
        ORDER BY cb.actif DESC, cb.id DESC
        "#
    )
    .bind(enseignant_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// GET ALL COMPTES
// =========================

#[tauri::command]
pub async fn get_comptes(
    state: State<'_, DbState>,
) -> Result<Vec<CompteBancaire>, String> {

    sqlx::query_as::<_, CompteBancaire>(
        r#"
        SELECT 
            cb.id,
            cb.enseignant_id,
            cb.banque_id,
            cb.numero_compte,
            cb.actif,
            b.designation as banque
        FROM comptes_bancaires cb
        JOIN banques b ON b.id = cb.banque_id
        ORDER BY cb.enseignant_id, cb.actif DESC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_compte_bancaire(
    state: State<'_, DbState>,
    data: CreateCompte,
) -> Result<CompteBancaire, String> {

    validate(&data.numero_compte)?;

    // Désactiver les anciens comptes de cet enseignant
    sqlx::query(
        "UPDATE comptes_bancaires SET actif = 0 WHERE enseignant_id = ?"
    )
    .bind(data.enseignant_id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // Créer le nouveau compte (actif par défaut)
    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO comptes_bancaires (enseignant_id, banque_id, numero_compte, actif)
        VALUES (?, ?, ?, 1)
        RETURNING id
        "#
    )
    .bind(data.enseignant_id)
    .bind(data.banque_id)
    .bind(&data.numero_compte)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_compte_by_id(state, id).await
}

// =========================
// GET BY ID
// =========================

#[tauri::command]
pub async fn get_compte_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<CompteBancaire, String> {

    sqlx::query_as::<_, CompteBancaire>(
        r#"
        SELECT 
            cb.id,
            cb.enseignant_id,
            cb.banque_id,
            cb.numero_compte,
            cb.actif,
            b.designation as banque
        FROM comptes_bancaires cb
        JOIN banques b ON b.id = cb.banque_id
        WHERE cb.id = ?
        "#
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Compte non trouvé".into())
}

// =========================
// SET ACTIF
// =========================

#[tauri::command]
pub async fn set_compte_actif(
    state: State<'_, DbState>,
    id: i32,
    enseignant_id: i32,
) -> Result<(), String> {

    // Désactiver tous les comptes de l'enseignant
    sqlx::query(
        "UPDATE comptes_bancaires SET actif = 0 WHERE enseignant_id = ?"
    )
    .bind(enseignant_id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // Activer le compte spécifique
    let rows_affected = sqlx::query(
        "UPDATE comptes_bancaires SET actif = 1 WHERE id = ?"
    )
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if rows_affected.rows_affected() == 0 {
        return Err("Compte non trouvé".into());
    }

    Ok(())
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_compte(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let rows_affected = sqlx::query("DELETE FROM comptes_bancaires WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    if rows_affected.rows_affected() == 0 {
        return Err("Compte non trouvé".into());
    }

    Ok(())
}

// ⚠️ NOTE: La fonction import_comptes_bancaires_upsert a été SUPPRIMÉE
// Elle se trouve maintenant dans imports.rs avec le nom import_comptes_bancaires