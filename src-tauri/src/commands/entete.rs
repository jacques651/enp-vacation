// src-tauri/src/commands/entete.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
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
    logo_base64: String,
) -> Result<(), String> {
    
    // Valider que le base64 n'est pas vide
    if logo_base64.is_empty() {
        return Err("Le logo ne peut pas être vide".into());
    }
    
    // Valider que c'est bien un format data URL ou base64 pur
    let is_valid = logo_base64.starts_with("data:image/") || 
                   logo_base64.starts_with("iVBOR") || // PNG
                   logo_base64.starts_with("/9j/");     // JPEG
    
    if !is_valid {
        return Err("Format de logo invalide. Utilisez PNG ou JPG".into());
    }
    
    // Vérifier la taille approximative (max 2MB)
    let size_mb = logo_base64.len() as f64 * 0.75 / (1024.0 * 1024.0);
    if size_mb > 2.0 {
        return Err(format!("Le logo est trop volumineux: {:.2}MB (max 2MB)", size_mb));
    }
    
    // Stocker directement le base64 dans la table entete
    sqlx::query(
        "INSERT OR REPLACE INTO entete (cle, valeur) VALUES ('logo', ?)"
    )
    .bind(&logo_base64)
    .execute(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de l'upload du logo: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_logo_base64(
    state: State<'_, DbState>,
) -> Result<Option<String>, String> {
    
    let logo: Option<String> = sqlx::query_scalar(
        "SELECT valeur FROM entete WHERE cle = 'logo'"
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de la récupération du logo: {}", e))?;
    
    // Si le logo est vide ou null, retourner None
    Ok(logo.filter(|l| !l.is_empty()))
}

#[tauri::command]
pub async fn delete_logo_base64(
    state: State<'_, DbState>,
) -> Result<(), String> {
    
    let result = sqlx::query(
        "UPDATE entete SET valeur = '' WHERE cle = 'logo'"
    )
    .execute(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de la suppression du logo: {}", e))?;
    
    if result.rows_affected() == 0 {
        return Err("Aucun logo trouvé à supprimer".into());
    }
    
    Ok(())
}

// =========================
// AUTRES FONCTIONS ENTETE
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
    .map_err(|e| format!("Erreur lors de la récupération des entêtes: {}", e))
}

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
    .map_err(|_| format!("Entête non trouvée pour la clé: {}", cle))
}

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
    .map_err(|e| format!("Erreur lors de la récupération de la valeur: {}", e))?;
    
    Ok(value.unwrap_or(default_value.unwrap_or_default()))
}

#[tauri::command]
pub async fn set_entete_value(
    state: State<'_, DbState>,
    cle: String,
    valeur: Option<String>,
) -> Result<Entete, String> {

    if cle.trim().is_empty() {
        return Err("La clé est obligatoire".into());
    }
    
    // Limiter la longueur de la valeur pour éviter les abus
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
        "#
    )
    .bind(&cle)
    .bind(&valeur)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de l'enregistrement de l'entête: {}", e))?;

    Ok(entete)
}

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
    .map_err(|e| format!("Erreur lors de la vérification de l'entête: {}", e))?;

    if exists == 0 {
        return Err(format!("Entête avec l'id {} non trouvée", id));
    }
    
    // Empêcher la suppression des clés système importantes
    let cle: Option<String> = sqlx::query_scalar("SELECT cle FROM entete WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if let Some(cle) = cle {
        let system_keys = vec!["logo", "nom_etablissement", "sigle"];
        if system_keys.contains(&cle.as_str()) {
            return Err(format!("Impossible de supprimer la clé système '{}'", cle));
        }
    }

    sqlx::query("DELETE FROM entete WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de la suppression de l'entête: {}", e))?;

    Ok(())
}

// =========================
// FONCTIONS UTILITAIRES
// =========================

#[tauri::command]
pub async fn get_entete_values(
    state: State<'_, DbState>,
) -> Result<std::collections::HashMap<String, String>, String> {
    
    let rows = sqlx::query_as::<_, Entete>(
        "SELECT cle, valeur FROM entete"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Erreur lors de la récupération des entêtes: {}", e))?;
    
    let mut map = std::collections::HashMap::new();
    for row in rows {
        if let Some(valeur) = row.valeur {
            map.insert(row.cle, valeur);
        }
    }
    
    Ok(map)
}

#[tauri::command]
pub async fn init_default_entetes(
    state: State<'_, DbState>,
) -> Result<(), String> {
    
    let defaults = vec![
        ("nom_etablissement", "ECOLE NATIONALE DE POLICE"),
        ("sigle", "ENP"),
        ("logo", ""),
        ("adresse", "01 BP 1234 OUAGADOUGOU 01"),
        ("telephone", "25 36 11 11"),
        ("email", "enp@police.bf"),
        ("directeur_nom", ""),
        ("directeur_titre", ""),
        ("directeur_fonction", ""),
        ("comptable_nom", ""),
        ("comptable_titre", ""),
        ("comptable_fonction", ""),
        ("signataire_defaut", ""),
    ];
    
    for (cle, valeur) in defaults {
        sqlx::query(
            "INSERT OR IGNORE INTO entete (cle, valeur) VALUES (?, ?)"
        )
        .bind(cle)
        .bind(valeur)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Erreur lors de l'initialisation de '{}': {}", cle, e))?;
    }
    
    Ok(())
}