// src-tauri/src/commands/entete.rs

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Entete {
    pub id: i32,
    pub cle: String,
    pub valeur: Option<String>,
}

// =========================
// GESTION DU LOGO EN BASE64
// =========================

#[tauri::command]
pub async fn upload_logo_base64(
    state: State<'_, DbState>,
    logoBase64: String,
) -> Result<(), String> {
    if logoBase64.is_empty() {
        return Err("Le logo ne peut pas être vide".into());
    }

    let is_valid = logoBase64.starts_with("data:image/")
        || logoBase64.starts_with("iVBOR")
        || logoBase64.starts_with("/9j/");

    if !is_valid {
        return Err("Format de logo invalide. Utilisez PNG ou JPG".into());
    }

    let size_mb = logoBase64.len() as f64 * 0.75 / (1024.0 * 1024.0);
    if size_mb > 2.0 {
        return Err(format!(
            "Le logo est trop volumineux: {:.2}MB (max 2MB)",
            size_mb
        ));
    }

    sqlx::query("INSERT OR REPLACE INTO entete (cle, valeur) VALUES ('logo', ?)")
        .bind(&logoBase64)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de l'upload du logo: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_logo_base64(state: State<'_, DbState>) -> Result<Option<String>, String> {
    let logo: Option<String> = sqlx::query_scalar("SELECT valeur FROM entete WHERE cle = 'logo'")
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de la récupération du logo: {}", e))?;

    Ok(logo.filter(|l| !l.is_empty()))
}

#[tauri::command]
pub async fn delete_logo_base64(state: State<'_, DbState>) -> Result<(), String> {
    let result = sqlx::query("UPDATE entete SET valeur = '' WHERE cle = 'logo'")
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de la suppression du logo: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("Aucun logo trouvé à supprimer".into());
    }

    Ok(())
}

// =========================
// OPÉRATIONS CRUD COMPLÈTES
// =========================

#[tauri::command]
pub async fn get_entetes(state: State<'_, DbState>) -> Result<Vec<Entete>, String> {
    sqlx::query_as::<_, Entete>("SELECT id, cle, valeur FROM entete ORDER BY cle")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de la récupération des entêtes: {}", e))
}

#[tauri::command]
pub async fn get_entete_by_id(state: State<'_, DbState>, id: i32) -> Result<Entete, String> {
    sqlx::query_as::<_, Entete>("SELECT id, cle, valeur FROM entete WHERE id = ?")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| format!("Entête avec l'id {} non trouvée", id))
}

#[tauri::command]
pub async fn get_entete_by_key(state: State<'_, DbState>, cle: String) -> Result<Entete, String> {
    sqlx::query_as::<_, Entete>("SELECT id, cle, valeur FROM entete WHERE cle = ?")
        .bind(&cle)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| format!("Entête non trouvée pour la clé: {}", cle))
}

// Helper: Récupérer toutes les valeurs dans une HashMap
#[tauri::command]
pub async fn get_entete_values(
    state: State<'_, DbState>,
) -> Result<HashMap<String, String>, String> {
    let entetes = get_entetes(state).await?;

    Ok(entetes
        .into_iter()
        .filter_map(|e| e.valeur.map(|v| (e.cle, v)))
        .collect())
}

// CREATE - Créer un nouveau paramètre
#[tauri::command]
pub async fn create_entete(
    state: State<'_, DbState>,
    cle: String,
    valeur: Option<String>,
) -> Result<Entete, String> {
    if cle.trim().is_empty() {
        return Err("La clé est obligatoire".into());
    }

    let exists: i64 = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM entete WHERE cle = ?)")
        .bind(&cle)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de la vérification: {}", e))?;

    if exists == 1 {
        return Err(format!(
            "La clé '{}' existe déjà. Utilisez update_entete pour modifier.",
            cle
        ));
    }

    if let Some(v) = &valeur {
        if v.len() > 10000 {
            return Err("La valeur est trop longue (max 10000 caractères)".into());
        }
    }

    let entete = sqlx::query_as::<_, Entete>(
        r#"
        INSERT INTO entete (cle, valeur)
        VALUES (?, ?)
        RETURNING id, cle, valeur
        "#,
    )
    .bind(&cle)
    .bind(&valeur)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de la création de l'entête: {}", e))?;

    Ok(entete)
}

// UPDATE - Mettre à jour un paramètre existant
#[tauri::command]
pub async fn update_entete(
    state: State<'_, DbState>,
    id: i32,
    cle: String,
    valeur: Option<String>,
) -> Result<Entete, String> {
    if cle.trim().is_empty() {
        return Err("La clé est obligatoire".into());
    }

    let exists: i64 = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM entete WHERE id = ?)")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de la vérification: {}", e))?;

    if exists == 0 {
        return Err(format!("Entête avec l'id {} non trouvée", id));
    }

    let key_exists: i64 =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM entete WHERE cle = ? AND id != ?)")
            .bind(&cle)
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| format!("Erreur lors de la vérification: {}", e))?;

    if key_exists == 1 {
        return Err(format!(
            "La clé '{}' est déjà utilisée par un autre paramètre",
            cle
        ));
    }

    if let Some(v) = &valeur {
        if v.len() > 10000 {
            return Err("La valeur est trop longue (max 10000 caractères)".into());
        }
    }

    let entete = sqlx::query_as::<_, Entete>(
        r#"
        UPDATE entete 
        SET cle = ?, valeur = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING id, cle, valeur
        "#,
    )
    .bind(&cle)
    .bind(&valeur)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de la mise à jour de l'entête: {}", e))?;

    Ok(entete)
}

// UPSERT - Créer ou mettre à jour (utilisé par le formulaire principal)
#[tauri::command]
pub async fn set_entete_value(
    state: State<'_, DbState>,
    cle: String,
    valeur: Option<String>,
) -> Result<Entete, String> {
    if cle.trim().is_empty() {
        return Err("La clé est obligatoire".into());
    }

    if let Some(v) = &valeur {
        if v.len() > 10000 {
            return Err("La valeur est trop longue (max 10000 caractères)".into());
        }
    }

    let entete = sqlx::query_as::<_, Entete>(
        r#"
        INSERT INTO entete (cle, valeur)
        VALUES (?, ?)
        ON CONFLICT(cle) DO UPDATE SET 
            valeur = excluded.valeur,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id, cle, valeur
        "#,
    )
    .bind(&cle)
    .bind(&valeur)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de l'enregistrement de l'entête: {}", e))?;

    Ok(entete)
}

// DELETE - Suppression libre (aucune restriction)
#[tauri::command]
pub async fn delete_entete(state: State<'_, DbState>, id: i32) -> Result<(), String> {
    let exists: i64 = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM entete WHERE id = ?)")
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de la vérification de l'entête: {}", e))?;

    if exists == 0 {
        return Err(format!("Entête avec l'id {} non trouvée", id));
    }

    // Suppression sans aucune restriction - Liberté totale pour l'administrateur
    sqlx::query("DELETE FROM entete WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de la suppression de l'entête: {}", e))?;

    println!("✅ Entête id={} supprimée avec succès", id);
    Ok(())
}

// =========================
// INITIALISATION PAR DÉFAUT
// =========================

#[tauri::command]
pub async fn init_default_entetes(state: State<'_, DbState>) -> Result<(), String> {
    let defaults = vec![
        ("ministere", "MINISTERE DE LA SECURITE"),
        ("secretariat", "SECRETARIAT GENERAL"),
        ("nom_etablissement", "ECOLE NATIONALE DE POLICE"),
        ("sigle", "ENP"),
        ("direction_generale", "DIRECTION GENERALE"),
        ("direction_financiere", "DIRECTION DE L'ADMINISTRATION DES FINANCES"),
        ("adresse", "01 BP 1234 OUAGADOUGOU 01"),
        ("telephone", "25 36 11 11"),
        ("email", "enp@police.bf"),
        ("numero_courrier", "N°2026-               /MSECU/SG/ENP/DG/DAF"),
        ("logo", ""),
        ("directeur_nom", ""),
        ("directeur_titre", ""),
        ("directeur_fonction", ""),
        ("comptable_nom", ""),
        ("comptable_titre", ""),
        ("comptable_fonction", ""),
        ("signataire_defaut", ""),
        ("version_document", "1"),
    ];

    for (cle, valeur) in defaults {
        sqlx::query("INSERT OR IGNORE INTO entete (cle, valeur) VALUES (?, ?)")
            .bind(cle)
            .bind(valeur)
            .execute(&state.pool)
            .await
            .map_err(|e| format!("Erreur lors de l'initialisation de '{}': {}", cle, e))?;
    }

    println!("✅ Paramètres par défaut initialisés avec succès");
    Ok(())
}