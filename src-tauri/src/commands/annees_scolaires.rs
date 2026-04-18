// src-tauri/src/commands/annees_scolaires.rs

use crate::{commands::{CreateCompte, ImportResult, create_compte_bancaire}, db::DbState};
use serde::{Serialize, Deserialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// MODELE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AnneeScolaire {
    pub id: i32,
    pub libelle: String,
}

// =========================
// INPUTS
// =========================

#[derive(Debug, Deserialize)]
pub struct CreateAnneeScolaire {
    pub libelle: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAnneeScolaire {
    pub libelle: String,
}

// =========================
// UTILITAIRE VALIDATION
// =========================

fn validate_annee(libelle: &str) -> Result<(), String> {
    // Format attendu : "2025-2026"
    let parts: Vec<&str> = libelle.split('-').collect();

    if parts.len() != 2 {
        return Err("Format invalide. Exemple attendu : 2025-2026".into());
    }

    let debut: i32 = parts[0]
        .parse()
        .map_err(|_| "Année de début invalide")?;

    let fin: i32 = parts[1]
        .parse()
        .map_err(|_| "Année de fin invalide")?;

    if fin != debut + 1 {
        return Err("Une année scolaire doit être consécutive (ex: 2025-2026)".into());
    }

    Ok(())
}

// =========================
// GET ALL
// =========================

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

// =========================
// GET BY ID
// =========================

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

// =========================
// CREATE
// =========================

#[tauri::command]
pub async fn create_annee_scolaire(
    state: State<'_, DbState>,
    data: CreateAnneeScolaire,
) -> Result<AnneeScolaire, String> {

    if data.libelle.trim().is_empty() {
        return Err("Libellé obligatoire".into());
    }

    validate_annee(&data.libelle)?;

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO annees_scolaires (libelle)
        VALUES (?)
        RETURNING id
        "#
    )
    .bind(&data.libelle)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Cette année scolaire existe déjà".into()
        } else {
            e.to_string()
        }
    })?;

    get_annee_scolaire_by_id(state, id).await
}

// =========================
// UPDATE
// =========================

#[tauri::command]
pub async fn update_annee_scolaire(
    state: State<'_, DbState>,
    id: i32,
    data: UpdateAnneeScolaire,
) -> Result<AnneeScolaire, String> {

    validate_annee(&data.libelle)?;

    sqlx::query(
        r#"
        UPDATE annees_scolaires
        SET libelle = ?
        WHERE id = ?
        "#
    )
    .bind(&data.libelle)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    get_annee_scolaire_by_id(state, id).await
}

// =========================
// DELETE
// =========================

#[tauri::command]
pub async fn delete_annee_scolaire(
    state: State<'_, DbState>,
    id: i32,
) -> Result<(), String> {

    let used: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM vacations WHERE annee_scolaire_id = ?)"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if used == 1 {
        return Err("Impossible : année scolaire utilisée dans des vacations".into());
    }

    sqlx::query("DELETE FROM annees_scolaires WHERE id = ?")
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
pub async fn search_annees_scolaires(
    state: State<'_, DbState>,
    search: String,
) -> Result<Vec<AnneeScolaire>, String> {

    let pattern = format!("%{}%", search);

    sqlx::query_as::<_, AnneeScolaire>(
        "SELECT id, libelle FROM annees_scolaires WHERE libelle LIKE ? ORDER BY libelle DESC"
    )
    .bind(pattern)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

// Dans src-tauri/src/commands/annees_scolaires.rs
#[tauri::command]
pub async fn import_annees_scolaires(
    state: State<'_, DbState>,
    data: Vec<CreateAnneeScolaire>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();

    for item in data {
        match create_annee_scolaire(state.clone(), item).await {
            Ok(_) => success += 1,
            Err(e) => errors.push(e),
        }
    }

    Ok(ImportResult { success, errors })
}

// Dans src-tauri/src/commands/comptes_bancaires.rs
#[derive(Debug, Deserialize)]
pub struct ImportCompteBancaire {
    pub enseignant_nom: String,
    pub enseignant_prenom: String,
    pub banque_designation: String,
    pub numero_compte: String,
}

#[tauri::command]
pub async fn import_comptes_bancaires(
    state: State<'_, DbState>,
    data: Vec<ImportCompteBancaire>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();

    for item in data {
        // Chercher l'enseignant
        let enseignant: Option<(i32,)> = sqlx::query_as(
            "SELECT id FROM enseignants WHERE nom = ? AND prenom = ?"
        )
        .bind(&item.enseignant_nom)
        .bind(&item.enseignant_prenom)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

        let Some((enseignant_id,)) = enseignant else {
            errors.push(format!(
                "Enseignant non trouvé: {} {}",
                item.enseignant_nom, item.enseignant_prenom
            ));
            continue;
        };

        // Chercher la banque
        let banque: Option<(i32,)> = sqlx::query_as(
            "SELECT id FROM banques WHERE designation = ?"
        )
        .bind(&item.banque_designation)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

        let Some((banque_id,)) = banque else {
            errors.push(format!("Banque non trouvée: {}", item.banque_designation));
            continue;
        };

        // Créer le compte bancaire
        let compte_data = CreateCompte {
            enseignant_id,
            banque_id,
            numero_compte: item.numero_compte,
        };

        match create_compte_bancaire(state.clone(), compte_data).await {
            Ok(_) => success += 1,
            Err(e) => errors.push(e),
        }
    }

    Ok(ImportResult { success, errors })
}