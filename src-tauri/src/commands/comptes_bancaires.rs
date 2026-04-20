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
    pub cle_rib: String,
    pub actif: i32,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
    pub enseignant_nom: Option<String>,
    pub enseignant_prenom: Option<String>,
    pub banque_designation: Option<String>,
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Deserialize)]
pub struct CreateCompteBancaire {
    pub enseignant_id: i32,
    pub banque_id: i32,
    pub numero_compte: String,
    pub cle_rib: String,
    pub actif: Option<i32>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCompteBancaire {
    pub enseignant_id: Option<i32>,
    pub banque_id: Option<i32>,
    pub numero_compte: Option<String>,
    pub cle_rib: Option<String>,
    pub actif: Option<i32>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
}

// =========================
// VALIDATION
// =========================

fn validate(numero_compte: &str, cle_rib: &str) -> Result<(), String> {
    if numero_compte.trim().is_empty() {
        return Err("Numéro de compte obligatoire".into());
    }
    
    if cle_rib.trim().is_empty() {
        return Err("Clé RIB obligatoire".into());
    }
    
    Ok(())
}

// =========================
// GET ALL COMPTES
// =========================

#[tauri::command]
pub async fn get_comptes_bancaires(
    state: State<'_, DbState>,
) -> Result<Vec<CompteBancaire>, String> {

    sqlx::query_as::<_, CompteBancaire>(
        r#"
        SELECT 
            cb.id,
            cb.enseignant_id,
            cb.banque_id,
            cb.numero_compte,
            cb.cle_rib,
            cb.actif,
            cb.date_debut,
            cb.date_fin,
            e.nom as enseignant_nom,
            e.prenom as enseignant_prenom,
            b.designation as banque_designation
        FROM comptes_bancaires cb
        JOIN enseignants e ON e.id = cb.enseignant_id
        JOIN banques b ON b.id = cb.banque_id
        ORDER BY e.nom, e.prenom, cb.actif DESC
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
pub async fn get_compte_bancaire_by_id(
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
            cb.cle_rib,
            cb.actif,
            cb.date_debut,
            cb.date_fin,
            e.nom as enseignant_nom,
            e.prenom as enseignant_prenom,
            b.designation as banque_designation
        FROM comptes_bancaires cb
        JOIN enseignants e ON e.id = cb.enseignant_id
        JOIN banques b ON b.id = cb.banque_id
        WHERE cb.id = ?
        "#
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Compte bancaire non trouvé".into())
}

// =========================
// GET BY ENSEIGNANT
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
            cb.cle_rib,
            cb.actif,
            cb.date_debut,
            cb.date_fin,
            e.nom as enseignant_nom,
            e.prenom as enseignant_prenom,
            b.designation as banque_designation
        FROM comptes_bancaires cb
        JOIN enseignants e ON e.id = cb.enseignant_id
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
// CREATE
// =========================

#[tauri::command]
pub async fn create_compte_bancaire(
    state: State<'_, DbState>,
    data: CreateCompteBancaire,
) -> Result<CompteBancaire, String> {

    validate(&data.numero_compte, &data.cle_rib)?;

    // Vérifier si l'enseignant existe
    let enseignant_exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM enseignants WHERE id = ?)"
    )
    .bind(data.enseignant_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if enseignant_exists == 0 {
        return Err("Enseignant non trouvé".into());
    }

    // Vérifier si la banque existe
    let banque_exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM banques WHERE id = ?)"
    )
    .bind(data.banque_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if banque_exists == 0 {
        return Err("Banque non trouvée".into());
    }

    let actif = data.actif.unwrap_or(1);

    // Si le compte est actif, désactiver les autres comptes du même enseignant
    if actif == 1 {
        sqlx::query(
            "UPDATE comptes_bancaires SET actif = 0 WHERE enseignant_id = ?"
        )
        .bind(data.enseignant_id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO comptes_bancaires (enseignant_id, banque_id, numero_compte, cle_rib, actif, date_debut, date_fin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id
        "#
    )
    .bind(data.enseignant_id)
    .bind(data.banque_id)
    .bind(&data.numero_compte)
    .bind(&data.cle_rib)
    .bind(actif)
    .bind(&data.date_debut)
    .bind(&data.date_fin)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_compte_bancaire_by_id(state, id).await
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_compte_bancaire(
    state: State<'_, DbState>,
    id: i32,
    data: UpdateCompteBancaire,
) -> Result<CompteBancaire, String> {

    let current = get_compte_bancaire_by_id(state.clone(), id).await?;

    let enseignant_id = data.enseignant_id.unwrap_or(current.enseignant_id);
    let banque_id = data.banque_id.unwrap_or(current.banque_id);
    let numero_compte = data.numero_compte.unwrap_or(current.numero_compte);
    let cle_rib = data.cle_rib.unwrap_or(current.cle_rib);
    let actif = data.actif.unwrap_or(current.actif);
    let date_debut = data.date_debut;
    let date_fin = data.date_fin;

    validate(&numero_compte, &cle_rib)?;

    // Si on active ce compte, désactiver les autres comptes du même enseignant
    if actif == 1 && current.actif != 1 {
        sqlx::query(
            "UPDATE comptes_bancaires SET actif = 0 WHERE enseignant_id = ? AND id != ?"
        )
        .bind(enseignant_id)
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    sqlx::query(
        r#"
        UPDATE comptes_bancaires 
        SET enseignant_id = ?, 
            banque_id = ?, 
            numero_compte = ?, 
            cle_rib = ?, 
            actif = ?, 
            date_debut = ?, 
            date_fin = ?
        WHERE id = ?
        "#
    )
    .bind(enseignant_id)
    .bind(banque_id)
    .bind(&numero_compte)
    .bind(&cle_rib)
    .bind(actif)
    .bind(date_debut)
    .bind(date_fin)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_compte_bancaire_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_compte_bancaire(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let rows_affected = sqlx::query("DELETE FROM comptes_bancaires WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    if rows_affected.rows_affected() == 0 {
        return Err("Compte bancaire non trouvé".into());
    }

    Ok(())
}

// =========================
// SET ACTIF
// =========================

#[tauri::command]
pub async fn set_compte_bancaire_actif(
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
        return Err("Compte bancaire non trouvé".into());
    }

    Ok(())
}