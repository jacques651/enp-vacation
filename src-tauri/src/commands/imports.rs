// src-tauri/src/commands/imports.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub success: i32,
    pub errors: Vec<String>,
}

// ================= IMPORT CYCLES =================
#[tauri::command]
pub async fn import_cycles(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();

    for (idx, row) in data.iter().enumerate() {
        let line_num = idx + 1;
        
        let designation = row.get("designation")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let nb_classe = row.get("nb_classe")
            .and_then(|v| v.as_u64())
            .or_else(|| row.get("nb_classe").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()));
        
        let Some(designation) = designation else {
            errors.push(format!("Ligne {}: designation manquante", line_num));
            continue;
        };
        
        let Some(nb_classe) = nb_classe else {
            errors.push(format!("Ligne {}: nb_classe manquant ou invalide", line_num));
            continue;
        };
        
        if designation.trim().is_empty() {
            errors.push(format!("Ligne {}: designation vide", line_num));
            continue;
        }
        
        if nb_classe == 0 {
            errors.push(format!("Ligne {}: nb_classe doit être > 0", line_num));
            continue;
        }
        
        let result = sqlx::query(
            "INSERT INTO cycles (designation, nb_classe) VALUES (?, ?)"
        )
        .bind(&designation)
        .bind(nb_classe as i64)
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => success += 1,
            Err(e) => errors.push(format!("Ligne {}: {}", line_num, e)),
        }
    }
    
    Ok(ImportResult { success, errors })
}

// ================= IMPORT MODULES =================
#[tauri::command]
pub async fn import_modules(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();

    for (idx, row) in data.iter().enumerate() {
        let line_num = idx + 1;
        
        let designation = row.get("designation")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let cycle_designation = row.get("cycle")
            .or_else(|| row.get("cycle_designation"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let Some(designation) = designation else {
            errors.push(format!("Ligne {}: designation manquante", line_num));
            continue;
        };
        
        let Some(cycle_desig) = cycle_designation else {
            errors.push(format!("Ligne {}: cycle manquant", line_num));
            continue;
        };
        
        if designation.trim().is_empty() {
            errors.push(format!("Ligne {}: designation vide", line_num));
            continue;
        }
        
        // Trouver l'ID du cycle
        let cycle_id = sqlx::query_scalar::<_, i32>(
            "SELECT id FROM cycles WHERE designation = ?"
        )
        .bind(&cycle_desig)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let Some(cycle_id) = cycle_id else {
            errors.push(format!("Ligne {}: cycle '{}' non trouvé", line_num, cycle_desig));
            continue;
        };
        
        let result = sqlx::query(
            "INSERT INTO modules (designation, cycle_id) VALUES (?, ?)"
        )
        .bind(&designation)
        .bind(cycle_id)
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => success += 1,
            Err(e) => errors.push(format!("Ligne {}: {}", line_num, e)),
        }
    }
    
    Ok(ImportResult { success, errors })
}

// ================= IMPORT MATIERES =================
#[tauri::command]
pub async fn import_matieres(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();

    for (idx, row) in data.iter().enumerate() {
        let line_num = idx + 1;
        
        // Récupérer les valeurs
        let designation = row.get("designation")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let vhoraire = row.get("vhoraire")
            .and_then(|v| v.as_f64())
            .or_else(|| row.get("vhoraire").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()));
        
        let module_designation = row.get("module")
            .or_else(|| row.get("module_designation"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let module_id = row.get("module_id")
            .and_then(|v| v.as_u64());
        
        // Validation
        let Some(designation) = designation else {
            errors.push(format!("Ligne {}: designation manquante", line_num));
            continue;
        };
        
        let Some(vhoraire) = vhoraire else {
            errors.push(format!("Ligne {}: vhoraire manquant ou invalide", line_num));
            continue;
        };
        
        if designation.trim().is_empty() {
            errors.push(format!("Ligne {}: designation vide", line_num));
            continue;
        }
        
        if vhoraire <= 0.0 {
            errors.push(format!("Ligne {}: vhoraire doit être > 0", line_num));
            continue;
        }
        
        // Trouver l'ID du module
        let actual_module_id = if let Some(id) = module_id {
            id as i32
        } else if let Some(module_desig) = module_designation {
            let result = sqlx::query_scalar::<_, i32>(
                "SELECT id FROM modules WHERE designation = ?"
            )
            .bind(&module_desig)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
            
            match result {
                Some(id) => id,
                None => {
                    errors.push(format!("Ligne {}: module '{}' non trouvé", line_num, module_desig));
                    continue;
                }
            }
        } else {
            errors.push(format!("Ligne {}: module ou module_id manquant", line_num));
            continue;
        };
        
        // Insérer
        let result = sqlx::query(
            "INSERT INTO matieres (designation, vhoraire, module_id) VALUES (?, ?, ?)"
        )
        .bind(&designation)
        .bind(vhoraire)
        .bind(actual_module_id)
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => success += 1,
            Err(e) => {
                if e.to_string().contains("UNIQUE") {
                    errors.push(format!("Ligne {}: matière '{}' existe déjà dans ce module", line_num, designation));
                } else {
                    errors.push(format!("Ligne {}: {}", line_num, e));
                }
            }
        }
    }
    
    Ok(ImportResult { success, errors })
}

// ================= IMPORT ENSEIGNANTS =================
#[tauri::command]
pub async fn import_enseignants(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();
    
    let valid_titres = ["directeur", "chef de service", "chef de division/service", "agent", "retraité", "autre"];
    let valid_statuts = ["interne", "externe"];

    for (idx, row) in data.iter().enumerate() {
        let line_num = idx + 1;
        
        let nom = row.get("nom")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let prenom = row.get("prenom")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let telephone = row.get("telephone")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let titre = row.get("titre")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let statut = row.get("statut")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let Some(nom) = nom else {
            errors.push(format!("Ligne {}: nom manquant", line_num));
            continue;
        };
        
        let Some(prenom) = prenom else {
            errors.push(format!("Ligne {}: prenom manquant", line_num));
            continue;
        };
        
        let Some(titre) = titre else {
            errors.push(format!("Ligne {}: titre manquant", line_num));
            continue;
        };
        
        let Some(statut) = statut else {
            errors.push(format!("Ligne {}: statut manquant", line_num));
            continue;
        };
        
        if !valid_titres.contains(&titre.as_str()) {
            errors.push(format!("Ligne {}: titre '{}' invalide (doit être: {:?})", line_num, titre, valid_titres));
            continue;
        }
        
        if !valid_statuts.contains(&statut.as_str()) {
            errors.push(format!("Ligne {}: statut '{}' invalide (doit être: {:?})", line_num, statut, valid_statuts));
            continue;
        }
        
        let result = sqlx::query(
            "INSERT INTO enseignants (nom, prenom, telephone, titre, statut) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&nom)
        .bind(&prenom)
        .bind(telephone)
        .bind(&titre)
        .bind(&statut)
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => success += 1,
            Err(e) => errors.push(format!("Ligne {}: {}", line_num, e)),
        }
    }
    
    Ok(ImportResult { success, errors })
}

// ================= IMPORT BANQUES =================
#[tauri::command]
pub async fn import_banques(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();

    for (idx, row) in data.iter().enumerate() {
        let line_num = idx + 1;
        
        let designation = row.get("designation")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let Some(designation) = designation else {
            errors.push(format!("Ligne {}: designation manquante", line_num));
            continue;
        };
        
        if designation.trim().is_empty() {
            errors.push(format!("Ligne {}: designation vide", line_num));
            continue;
        }
        
        let result = sqlx::query(
            "INSERT INTO banques (designation) VALUES (?)"
        )
        .bind(&designation)
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => success += 1,
            Err(e) => {
                if e.to_string().contains("UNIQUE") {
                    errors.push(format!("Ligne {}: banque '{}' existe déjà", line_num, designation));
                } else {
                    errors.push(format!("Ligne {}: {}", line_num, e));
                }
            }
        }
    }
    
    Ok(ImportResult { success, errors })
}

// ================= IMPORT PROMOTIONS =================
#[tauri::command]
pub async fn import_promotions(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();

    for (idx, row) in data.iter().enumerate() {
        let line_num = idx + 1;
        
        let libelle = row.get("libelle")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let Some(libelle) = libelle else {
            errors.push(format!("Ligne {}: libelle manquant", line_num));
            continue;
        };
        
        if libelle.trim().is_empty() {
            errors.push(format!("Ligne {}: libelle vide", line_num));
            continue;
        }
        
        let result = sqlx::query(
            "INSERT INTO promotions (libelle) VALUES (?)"
        )
        .bind(&libelle)
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => success += 1,
            Err(e) => {
                if e.to_string().contains("UNIQUE") {
                    errors.push(format!("Ligne {}: promotion '{}' existe déjà", line_num, libelle));
                } else {
                    errors.push(format!("Ligne {}: {}", line_num, e));
                }
            }
        }
    }
    
    Ok(ImportResult { success, errors })
}

// ================= IMPORT PLAFONDS =================
#[tauri::command]
pub async fn import_plafonds(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();
    
    let valid_titres = ["directeur", "chef de service", "chef de division/service", "agent", "retraité", "autre"];
    let valid_statuts = ["interne", "externe"];

    for (idx, row) in data.iter().enumerate() {
        let line_num = idx + 1;
        
        let titre = row.get("titre")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let statut = row.get("statut")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let volume_horaire_max = row.get("volume_horaire_max")
            .and_then(|v| v.as_u64());
        
        let Some(titre) = titre else {
            errors.push(format!("Ligne {}: titre manquant", line_num));
            continue;
        };
        
        let Some(statut) = statut else {
            errors.push(format!("Ligne {}: statut manquant", line_num));
            continue;
        };
        
        let Some(volume_horaire_max) = volume_horaire_max else {
            errors.push(format!("Ligne {}: volume_horaire_max manquant ou invalide", line_num));
            continue;
        };
        
        if !valid_titres.contains(&titre.as_str()) {
            errors.push(format!("Ligne {}: titre '{}' invalide", line_num, titre));
            continue;
        }
        
        if !valid_statuts.contains(&statut.as_str()) {
            errors.push(format!("Ligne {}: statut '{}' invalide", line_num, statut));
            continue;
        }
        
        if volume_horaire_max == 0 {
            errors.push(format!("Ligne {}: volume_horaire_max doit être > 0", line_num));
            continue;
        }
        
        let result = sqlx::query(
            "INSERT INTO plafonds (titre, statut, volume_horaire_max) VALUES (?, ?, ?)"
        )
        .bind(&titre)
        .bind(&statut)
        .bind(volume_horaire_max as i64)
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => success += 1,
            Err(e) => {
                if e.to_string().contains("UNIQUE") {
                    errors.push(format!("Ligne {}: plafond '{}' pour statut '{}' existe déjà", line_num, titre, statut));
                } else {
                    errors.push(format!("Ligne {}: {}", line_num, e));
                }
            }
        }
    }
    
    Ok(ImportResult { success, errors })
}

// ================= IMPORT ANNEES SCOLAIRES =================
#[tauri::command]
pub async fn import_annees_scolaires(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();

    for (idx, row) in data.iter().enumerate() {
        let line_num = idx + 1;
        
        let libelle = row.get("libelle")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let Some(libelle) = libelle else {
            errors.push(format!("Ligne {}: libelle manquant", line_num));
            continue;
        };
        
        if libelle.trim().is_empty() {
            errors.push(format!("Ligne {}: libelle vide", line_num));
            continue;
        }
        
        let result = sqlx::query(
            "INSERT INTO annees_scolaires (libelle) VALUES (?)"
        )
        .bind(&libelle)
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => success += 1,
            Err(e) => {
                if e.to_string().contains("UNIQUE") {
                    errors.push(format!("Ligne {}: année scolaire '{}' existe déjà", line_num, libelle));
                } else {
                    errors.push(format!("Ligne {}: {}", line_num, e));
                }
            }
        }
    }
    
    Ok(ImportResult { success, errors })
}

// ================= IMPORT COMPTES BANCAIRES =================
#[tauri::command]
pub async fn import_comptes_bancaires(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = Vec::new();

    for (idx, row) in data.iter().enumerate() {
        let line_num = idx + 1;
        
        let enseignant_nom = row.get("enseignant_nom")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let enseignant_prenom = row.get("enseignant_prenom")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let banque_designation = row.get("banque_designation")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let numero_compte = row.get("numero_compte")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let Some(enseignant_nom) = enseignant_nom else {
            errors.push(format!("Ligne {}: enseignant_nom manquant", line_num));
            continue;
        };
        
        let Some(enseignant_prenom) = enseignant_prenom else {
            errors.push(format!("Ligne {}: enseignant_prenom manquant", line_num));
            continue;
        };
        
        let Some(banque_designation) = banque_designation else {
            errors.push(format!("Ligne {}: banque_designation manquante", line_num));
            continue;
        };
        
        let Some(numero_compte) = numero_compte else {
            errors.push(format!("Ligne {}: numero_compte manquant", line_num));
            continue;
        };
        
        // Trouver l'enseignant
        let enseignant_id = sqlx::query_scalar::<_, i32>(
            "SELECT id FROM enseignants WHERE nom = ? AND prenom = ?"
        )
        .bind(&enseignant_nom)
        .bind(&enseignant_prenom)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let Some(enseignant_id) = enseignant_id else {
            errors.push(format!("Ligne {}: enseignant '{} {}' non trouvé", line_num, enseignant_nom, enseignant_prenom));
            continue;
        };
        
        // Trouver la banque
        let banque_id = sqlx::query_scalar::<_, i32>(
            "SELECT id FROM banques WHERE designation = ?"
        )
        .bind(&banque_designation)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let Some(banque_id) = banque_id else {
            errors.push(format!("Ligne {}: banque '{}' non trouvée", line_num, banque_designation));
            continue;
        };
        
        let result = sqlx::query(
            "INSERT INTO comptes_bancaires (enseignant_id, banque_id, numero_compte, actif) VALUES (?, ?, ?, 1)"
        )
        .bind(enseignant_id)
        .bind(banque_id)
        .bind(&numero_compte)
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => success += 1,
            Err(e) => errors.push(format!("Ligne {}: {}", line_num, e)),
        }
    }
    
    Ok(ImportResult { success, errors })
}