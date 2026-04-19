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
        
        // Vérifier si le cycle existe déjà
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM cycles WHERE designation = ?)"
        )
        .bind(&designation)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists > 0 {
            errors.push(format!("Ligne {}: cycle '{}' existe déjà", line_num, designation));
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
        
        // Accepter cycle_id (numérique) ou cycle (texte)
        let cycle_id = row.get("cycle_id")
            .and_then(|v| v.as_u64());
        
        let cycle_name = row.get("cycle")
            .or_else(|| row.get("cycle_designation"))
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
        
        // Trouver l'ID du cycle
        let actual_cycle_id = if let Some(id) = cycle_id {
            // Vérifier que le cycle existe
            let exists: i64 = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM cycles WHERE id = ?)"
            )
            .bind(id as i32)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
            
            if exists == 0 {
                errors.push(format!("Ligne {}: cycle_id {} n'existe pas", line_num, id));
                continue;
            }
            id as i32
        } else if let Some(name) = cycle_name {
            let result = sqlx::query_scalar::<_, i32>(
                "SELECT id FROM cycles WHERE designation = ?"
            )
            .bind(&name)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
            
            match result {
                Some(id) => id,
                None => {
                    errors.push(format!("Ligne {}: cycle '{}' non trouvé", line_num, name));
                    continue;
                }
            }
        } else {
            errors.push(format!("Ligne {}: cycle_id ou cycle manquant", line_num));
            continue;
        };
        
        // Vérifier si le module existe déjà
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM modules WHERE designation = ? AND cycle_id = ?)"
        )
        .bind(&designation)
        .bind(actual_cycle_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists > 0 {
            errors.push(format!("Ligne {}: module '{}' existe déjà pour ce cycle", line_num, designation));
            continue;
        }
        
        let result = sqlx::query(
            "INSERT INTO modules (designation, cycle_id) VALUES (?, ?)"
        )
        .bind(&designation)
        .bind(actual_cycle_id)
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
        
        let designation = row.get("designation")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let vhoraire = row.get("vhoraire")
            .and_then(|v| v.as_f64())
            .or_else(|| row.get("vhoraire").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()));
        
        // Accepter module_id (numérique) ou module (texte)
        let module_id = row.get("module_id")
            .and_then(|v| v.as_u64());
        
        let module_name = row.get("module")
            .or_else(|| row.get("module_designation"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let coefficient = row.get("coefficient")
            .and_then(|v| v.as_f64())
            .or_else(|| row.get("coefficient").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()))
            .unwrap_or(1.0);
        
        let observation = row.get("observation")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        
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
            // Vérifier que le module existe
            let exists: i64 = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM modules WHERE id = ?)"
            )
            .bind(id as i32)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
            
            if exists == 0 {
                errors.push(format!("Ligne {}: module_id {} n'existe pas", line_num, id));
                continue;
            }
            id as i32
        } else if let Some(name) = module_name {
            let result = sqlx::query_scalar::<_, i32>(
                "SELECT id FROM modules WHERE designation = ?"
            )
            .bind(&name)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
            
            match result {
                Some(id) => id,
                None => {
                    errors.push(format!("Ligne {}: module '{}' non trouvé", line_num, name));
                    continue;
                }
            }
        } else {
            errors.push(format!("Ligne {}: module_id ou module manquant", line_num));
            continue;
        };
        
        // Vérifier si la matière existe déjà
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM matieres WHERE designation = ? AND module_id = ?)"
        )
        .bind(&designation)
        .bind(actual_module_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists > 0 {
            errors.push(format!("Ligne {}: matière '{}' existe déjà pour ce module", line_num, designation));
            continue;
        }
        
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
            Err(e) => errors.push(format!("Ligne {}: {}", line_num, e)),
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
        
        if nom.trim().is_empty() {
            errors.push(format!("Ligne {}: nom vide", line_num));
            continue;
        }
        
        if prenom.trim().is_empty() {
            errors.push(format!("Ligne {}: prenom vide", line_num));
            continue;
        }
        
        if !valid_titres.contains(&titre.as_str()) {
            errors.push(format!("Ligne {}: titre '{}' invalide (doit être: {:?})", line_num, titre, valid_titres));
            continue;
        }
        
        if !valid_statuts.contains(&statut.as_str()) {
            errors.push(format!("Ligne {}: statut '{}' invalide (doit être: {:?})", line_num, statut, valid_statuts));
            continue;
        }
        
        // Vérifier si l'enseignant existe déjà
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM enseignants WHERE nom = ? AND prenom = ?)"
        )
        .bind(&nom)
        .bind(&prenom)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists > 0 {
            errors.push(format!("Ligne {}: enseignant '{} {}' existe déjà", line_num, nom, prenom));
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
        
        // Vérifier si la banque existe déjà
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM banques WHERE designation = ?)"
        )
        .bind(&designation)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists > 0 {
            errors.push(format!("Ligne {}: banque '{}' existe déjà", line_num, designation));
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
            Err(e) => errors.push(format!("Ligne {}: {}", line_num, e)),
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
        
        // Vérifier si la promotion existe déjà
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM promotions WHERE libelle = ?)"
        )
        .bind(&libelle)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists > 0 {
            errors.push(format!("Ligne {}: promotion '{}' existe déjà", line_num, libelle));
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
            Err(e) => errors.push(format!("Ligne {}: {}", line_num, e)),
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
        
        if titre.trim().is_empty() {
            errors.push(format!("Ligne {}: titre vide", line_num));
            continue;
        }
        
        if statut.trim().is_empty() {
            errors.push(format!("Ligne {}: statut vide", line_num));
            continue;
        }
        
        if !valid_titres.contains(&titre.as_str()) {
            errors.push(format!("Ligne {}: titre '{}' invalide (doit être: {:?})", line_num, titre, valid_titres));
            continue;
        }
        
        if !valid_statuts.contains(&statut.as_str()) {
            errors.push(format!("Ligne {}: statut '{}' invalide (doit être: {:?})", line_num, statut, valid_statuts));
            continue;
        }
        
        if volume_horaire_max == 0 {
            errors.push(format!("Ligne {}: volume_horaire_max doit être > 0", line_num));
            continue;
        }
        
        // Vérifier si le plafond existe déjà
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM plafonds WHERE titre = ? AND statut = ?)"
        )
        .bind(&titre)
        .bind(&statut)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists > 0 {
            errors.push(format!("Ligne {}: plafond '{}' pour statut '{}' existe déjà", line_num, titre, statut));
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
            Err(e) => errors.push(format!("Ligne {}: {}", line_num, e)),
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
        
        // Vérifier si l'année scolaire existe déjà
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM annees_scolaires WHERE libelle = ?)"
        )
        .bind(&libelle)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists > 0 {
            errors.push(format!("Ligne {}: année scolaire '{}' existe déjà", line_num, libelle));
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
            Err(e) => errors.push(format!("Ligne {}: {}", line_num, e)),
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
        
        if enseignant_nom.trim().is_empty() {
            errors.push(format!("Ligne {}: enseignant_nom vide", line_num));
            continue;
        }
        
        if enseignant_prenom.trim().is_empty() {
            errors.push(format!("Ligne {}: enseignant_prenom vide", line_num));
            continue;
        }
        
        if banque_designation.trim().is_empty() {
            errors.push(format!("Ligne {}: banque_designation vide", line_num));
            continue;
        }
        
        if numero_compte.trim().is_empty() {
            errors.push(format!("Ligne {}: numero_compte vide", line_num));
            continue;
        }
        
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
        
        // Vérifier si le compte existe déjà
        let exists: i64 = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM comptes_bancaires WHERE enseignant_id = ? AND banque_id = ? AND numero_compte = ?)"
        )
        .bind(enseignant_id)
        .bind(banque_id)
        .bind(&numero_compte)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        if exists > 0 {
            errors.push(format!("Ligne {}: compte bancaire pour '{} {}' existe déjà", line_num, enseignant_nom, enseignant_prenom));
            continue;
        }
        
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