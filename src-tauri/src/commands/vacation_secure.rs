// src-tauri/src/commands/vacation_secure.rs

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// INPUT
// =========================

#[derive(Debug, Serialize, Deserialize)]
pub struct VacationInput {
    pub enseignant_id: i32,
    pub matiere_id: i32,
    pub promotion_id: i32,
    pub annee_scolaire_id: i32,
    pub nb_classe: i32,
    pub mois: i32,
    pub annee: i32,
    pub cycle_id: i32,
    pub module_id: i32,
    pub taux_horaire: f64,
    pub taux_retenue: f64,
}

// =========================
// OUTPUT
// =========================

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct VacationResponse {
    pub id: i32,
    pub enseignant_id: i32,
    pub cycle_id: i32,
    pub module_id: i32,
    pub matiere_id: i32,
    pub nb_classe: i32,
    pub vhoraire_matiere: f64,
    pub taux_horaire: f64,
    pub taux_retenue: f64,
    pub vht: f64,
    pub montant_brut: f64,
    pub montant_retenu: f64,
    pub montant_net: f64,
    pub mois: String,
    pub annee: i32,
    pub date_traitement: String,
    pub annee_scolaire: String,
    pub promotion_id: i32,
    pub nom_enseignant: Option<String>,
    pub prenom_enseignant: Option<String>,
    pub libelle_cycle: Option<String>,
    pub libelle_module: Option<String>,
    pub libelle_matiere: Option<String>,
    pub libelle_promotion: Option<String>,
}

// =========================
// STRUCTURES INTERNES
// =========================

#[allow(dead_code)]
#[derive(FromRow)]
struct MatiereCycle {
    vhoraire: f64,
    module_id: i32,
    cycle_id: i32,
}

#[derive(FromRow)]
struct EnseignantInfo {
    titre: String,
    statut: String,
}

// =========================
// CREATE VACATION - CORRIGÉ
// =========================

#[tauri::command]
pub async fn create_vacation(
    state: State<'_, DbState>,
    input: VacationInput,
) -> Result<i32, String> {
    println!("📥 Création vacation - Input reçu: {:?}", input);

    // 1. MATIERE
    let matiere: MatiereCycle = sqlx::query_as(
        r#"
        SELECT m.vhoraire, m.module_id, mo.cycle_id
        FROM matieres m
        JOIN modules mo ON mo.id = m.module_id
        WHERE m.id = ?
        "#,
    )
    .bind(input.matiere_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        println!("❌ Erreur matière: {}", e);
        format!("Matière {} invalide", input.matiere_id)
    })?;

    println!("✅ Matière trouvée: vhoraire={}, module_id={}, cycle_id={}", 
        matiere.vhoraire, matiere.module_id, matiere.cycle_id);

    // 2. CYCLE
    let nb_classe_cycle: i32 = sqlx::query_scalar("SELECT nb_classe FROM cycles WHERE id = ?")
        .bind(matiere.cycle_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            println!("❌ Erreur cycle id={}: {}", matiere.cycle_id, e);
            format!("Cycle {} invalide", matiere.cycle_id)
        })?;

    println!("✅ Cycle trouvé: nb_classe={}", nb_classe_cycle);

    let nb_classe_cycle_f64 = nb_classe_cycle as f64;
    let vht_demande = input.nb_classe as f64 * matiere.vhoraire;
    let vht_max_cycle = nb_classe_cycle_f64 * matiere.vhoraire;

    println!("📊 VHT demandé: {:.2}h", vht_demande);
    println!("📊 VHT max cycle: {:.2}h", vht_max_cycle);

    // 3. PLAFOND ENSEIGNANT
    let enseignant: EnseignantInfo = sqlx::query_as(
        "SELECT titre, statut FROM enseignants WHERE id = ?"
    )
    .bind(input.enseignant_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        println!("❌ Erreur enseignant id={}: {}", input.enseignant_id, e);
        format!("Enseignant {} non trouvé", input.enseignant_id)
    })?;

    println!("✅ Enseignant trouvé: titre='{}', statut='{}'", enseignant.titre, enseignant.statut);

    let plafond: i32 = sqlx::query_scalar(
        "SELECT volume_horaire_max FROM plafonds WHERE titre = ? AND statut = ?"
    )
    .bind(&enseignant.titre)
    .bind(&enseignant.statut)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        println!("❌ Erreur plafond: {}", e);
        format!("Plafond non trouvé pour titre='{}' statut='{}'", 
            enseignant.titre, enseignant.statut)
    })?;

    let plafond_f64 = plafond as f64;
    println!("✅ Plafond enseignant: {:.2}h", plafond_f64);

    // Cumul enseignant - CORRIGÉ avec Option<f64>
    let cumul_enseignant_raw: Option<f64> = sqlx::query_scalar(
        r#"
        SELECT SUM(vht)
        FROM vacations
        WHERE enseignant_id = ? AND annee_scolaire_id = ?
        "#
    )
    .bind(input.enseignant_id)
    .bind(input.annee_scolaire_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        println!("❌ Erreur cumul enseignant: {}", e);
        e.to_string()
    })?;

    let cumul_enseignant = cumul_enseignant_raw.unwrap_or(0.0);
    println!("📊 Cumul enseignant: {:.2}h", cumul_enseignant);

    if cumul_enseignant + vht_demande > plafond_f64 {
        let restant = plafond_f64 - cumul_enseignant;
        let msg = format!("Plafond dépassé : restant {:.2}h", restant);
        println!("❌ {}", msg);
        return Err(msg);
    }

    // 4. VOLUME MATIERE
    let cumul_cycle_raw: Option<f64> = sqlx::query_scalar(
        r#"
        SELECT SUM(v.vht)
        FROM vacations v
        WHERE v.matiere_id = ? AND v.annee_scolaire_id = ?
        "#
    )
    .bind(input.matiere_id)
    .bind(input.annee_scolaire_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        println!("❌ Erreur cumul matière: {}", e);
        e.to_string()
    })?;

    let cumul_cycle = cumul_cycle_raw.unwrap_or(0.0);
    println!("📊 Cumul matière: {:.2}h", cumul_cycle);

    if cumul_cycle + vht_demande > vht_max_cycle {
        let restant = vht_max_cycle - cumul_cycle;
        let msg = format!("Volume matière dépassé : restant {:.2}h", restant);
        println!("❌ {}", msg);
        return Err(msg);
    }

    // 5. INSERTION
    println!("💾 Insertion de la vacation...");
    
    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO vacations (
            enseignant_id,
            matiere_id,
            promotion_id,
            annee_scolaire_id,
            nb_classe,
            vht,
            taux_horaire,
            taux_retenue,
            mois,
            annee
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
        "#
    )
    .bind(input.enseignant_id)
    .bind(input.matiere_id)
    .bind(input.promotion_id)
    .bind(input.annee_scolaire_id)
    .bind(input.nb_classe)
    .bind(vht_demande)
    .bind(input.taux_horaire)
    .bind(input.taux_retenue)
    .bind(input.mois)
    .bind(input.annee)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        println!("❌ Erreur insertion: {}", e);
        e.to_string()
    })?;

    println!("✅ Vacation créée avec succès! ID: {}", id);
    Ok(id)
}

// =========================
// GET ALL VACATIONS
// =========================

#[tauri::command]
pub async fn get_vacations(state: State<'_, DbState>) -> Result<Vec<VacationResponse>, String> {
    let vacations = sqlx::query_as::<_, VacationResponse>(
        r#"
        SELECT 
            v.id,
            v.enseignant_id,
            c.id AS cycle_id,
            mod.id AS module_id,
            v.matiere_id,
            v.nb_classe,
            mat.vhoraire AS vhoraire_matiere,
            v.taux_horaire,
            v.taux_retenue,
            v.vht,
            (v.vht * v.taux_horaire) AS montant_brut,
            (v.vht * v.taux_horaire * v.taux_retenue / 100.0) AS montant_retenu,
            (v.vht * v.taux_horaire * (1 - v.taux_retenue / 100.0)) AS montant_net,
            CAST(v.mois AS TEXT) AS mois,
            v.annee,
            v.date_traitement,
            a.libelle AS annee_scolaire,
            v.promotion_id,
            e.nom AS nom_enseignant,
            e.prenom AS prenom_enseignant,
            c.designation AS libelle_cycle,
            mod.designation AS libelle_module,
            mat.designation AS libelle_matiere,
            p.libelle AS libelle_promotion
        FROM vacations v
        JOIN enseignants e ON e.id = v.enseignant_id
        JOIN matieres mat ON mat.id = v.matiere_id
        JOIN modules mod ON mod.id = mat.module_id
        JOIN cycles c ON c.id = mod.cycle_id
        JOIN annees_scolaires a ON a.id = v.annee_scolaire_id
        JOIN promotions p ON p.id = v.promotion_id
        ORDER BY v.id DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        eprintln!("Erreur get_vacations: {:?}", e);
        e.to_string()
    })?;

    Ok(vacations)
}

// =========================
// GET VACATION BY ID
// =========================

#[tauri::command]
pub async fn get_vacation_by_id(
    state: State<'_, DbState>,
    id: i32,
) -> Result<VacationResponse, String> {
    let vacation = sqlx::query_as::<_, VacationResponse>(
        r#"
        SELECT 
            v.id,
            v.enseignant_id,
            c.id AS cycle_id,
            mod.id AS module_id,
            v.matiere_id,
            v.nb_classe,
            mat.vhoraire AS vhoraire_matiere,
            v.taux_horaire,
            v.taux_retenue,
            v.vht,
            (v.vht * v.taux_horaire) AS montant_brut,
            (v.vht * v.taux_horaire * v.taux_retenue / 100.0) AS montant_retenu,
            (v.vht * v.taux_horaire * (1 - v.taux_retenue / 100.0)) AS montant_net,
            CAST(v.mois AS TEXT) AS mois,
            v.annee,
            v.date_traitement,
            a.libelle AS annee_scolaire,
            v.promotion_id,
            e.nom AS nom_enseignant,
            e.prenom AS prenom_enseignant,
            c.designation AS libelle_cycle,
            mod.designation AS libelle_module,
            mat.designation AS libelle_matiere,
            p.libelle AS libelle_promotion
        FROM vacations v
        JOIN enseignants e ON e.id = v.enseignant_id
        JOIN matieres mat ON mat.id = v.matiere_id
        JOIN modules mod ON mod.id = mat.module_id
        JOIN cycles c ON c.id = mod.cycle_id
        JOIN annees_scolaires a ON a.id = v.annee_scolaire_id
        JOIN promotions p ON p.id = v.promotion_id
        WHERE v.id = ?
        "#,
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Vacation non trouvée".to_string())?;

    Ok(vacation)
}

// =========================
// UPDATE VACATION
// =========================

#[tauri::command]
pub async fn update_vacation(
    state: State<'_, DbState>,
    id: i32,
    input: VacationInput,
) -> Result<(), String> {
    println!("📝 Modification vacation ID: {}", id);

    // Récupérer vhoraire depuis matieres
    let vhoraire: f64 = sqlx::query_scalar("SELECT vhoraire FROM matieres WHERE id = ?")
        .bind(input.matiere_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| "Matière invalide".to_string())?;

    // Calcul VHT
    let vht = input.nb_classe as f64 * vhoraire;

    // Mise à jour
    let result = sqlx::query(
        r#"
        UPDATE vacations
        SET enseignant_id = ?,
            matiere_id = ?,
            promotion_id = ?,
            annee_scolaire_id = ?,
            nb_classe = ?,
            vht = ?,
            taux_horaire = ?,
            taux_retenue = ?,
            mois = ?,
            annee = ?
        WHERE id = ?
        "#
    )
    .bind(input.enseignant_id)
    .bind(input.matiere_id)
    .bind(input.promotion_id)
    .bind(input.annee_scolaire_id)
    .bind(input.nb_classe)
    .bind(vht)
    .bind(input.taux_horaire)
    .bind(input.taux_retenue)
    .bind(input.mois)
    .bind(input.annee)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Vacation non trouvée".to_string());
    }

    println!("✅ Vacation modifiée avec succès");
    Ok(())
}

// =========================
// DELETE VACATION
// =========================

#[tauri::command]
pub async fn delete_vacation(state: State<'_, DbState>, id: i32) -> Result<(), String> {
    println!("🗑️ Suppression vacation ID: {}", id);

    let exists: Option<i32> = sqlx::query_scalar("SELECT id FROM vacations WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    if exists.is_none() {
        return Err("Vacation introuvable".to_string());
    }

    let result = sqlx::query("DELETE FROM vacations WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Échec de suppression".to_string());
    }

    println!("✅ Vacation supprimée avec succès");
    Ok(())
}

// =========================
// CALCULATE VACATION
// =========================

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VacationCalculated {
    pub volume_horaire_max_enseignant: f64,
    pub cumul_volume_horaire_enseignant: f64,
    pub volume_horaire_restant_enseignant: f64,
    pub vht_total_cycle_matiere: f64,
    pub cumul_vht_cycle_matiere: f64,
    pub vht_restant_cycle_matiere: f64,
    pub nb_classe: i32,
    pub vhoraire_matiere: f64,
    pub vht_demande: f64,
    pub montant_brut: f64,
    pub montant_retenu: f64,
    pub montant_net: f64,
    pub enseignant_ok: bool,
    pub cycle_matiere_ok: bool,
    pub global_ok: bool,
    pub message: String,
}

#[tauri::command]
pub async fn calculate_vacation(
    state: State<'_, DbState>,
    input: VacationInput,
) -> Result<VacationCalculated, String> {
    println!("🧮 Calcul vacation - Input: {:?}", input);

    // 1. MATIERE
    let matiere: MatiereCycle = sqlx::query_as(
        r#"
        SELECT m.vhoraire, m.module_id, mo.cycle_id
        FROM matieres m
        JOIN modules mo ON mo.id = m.module_id
        WHERE m.id = ?
        "#,
    )
    .bind(input.matiere_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Matière invalide".to_string())?;

    // 2. CYCLE
    let nb_classe_cycle: i32 = sqlx::query_scalar("SELECT nb_classe FROM cycles WHERE id = ?")
        .bind(matiere.cycle_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| "Cycle invalide".to_string())?;

    let nb_classe_cycle_f64 = nb_classe_cycle as f64;
    let vht_demande = input.nb_classe as f64 * matiere.vhoraire;
    let vht_total_cycle = nb_classe_cycle_f64 * matiere.vhoraire;

    // 3. PLAFOND ENSEIGNANT
    let enseignant: EnseignantInfo = sqlx::query_as(
        "SELECT titre, statut FROM enseignants WHERE id = ?"
    )
    .bind(input.enseignant_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Enseignant non trouvé".to_string())?;

    let plafond: i32 = sqlx::query_scalar(
        "SELECT volume_horaire_max FROM plafonds WHERE titre = ? AND statut = ?"
    )
    .bind(&enseignant.titre)
    .bind(&enseignant.statut)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Plafond non trouvé".to_string())?;

    let plafond_f64 = plafond as f64;

    // Cumul enseignant
    let cumul_enseignant_raw: Option<f64> = sqlx::query_scalar(
        r#"
        SELECT SUM(vht)
        FROM vacations
        WHERE enseignant_id = ? AND annee_scolaire_id = ?
        "#
    )
    .bind(input.enseignant_id)
    .bind(input.annee_scolaire_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let cumul_enseignant = cumul_enseignant_raw.unwrap_or(0.0);
    let restant_enseignant = plafond_f64 - cumul_enseignant;
    let enseignant_ok = vht_demande <= restant_enseignant;

    // 4. CONTROLE MATIERE
    let cumul_cycle_raw: Option<f64> = sqlx::query_scalar(
        r#"
        SELECT SUM(vht)
        FROM vacations
        WHERE matiere_id = ? AND annee_scolaire_id = ?
        "#
    )
    .bind(input.matiere_id)
    .bind(input.annee_scolaire_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let cumul_cycle = cumul_cycle_raw.unwrap_or(0.0);
    let restant_cycle = vht_total_cycle - cumul_cycle;
    let cycle_matiere_ok = vht_demande <= restant_cycle;

    // 5. FINANCIER
    let montant_brut = vht_demande * input.taux_horaire;
    let montant_retenu = montant_brut * input.taux_retenue / 100.0;
    let montant_net = montant_brut - montant_retenu;

    // 6. VALIDATION
    let global_ok = enseignant_ok && cycle_matiere_ok;

    let message = if !enseignant_ok {
        format!(
            "⚠️ Plafond enseignant dépassé. Restant: {:.2}h",
            restant_enseignant.max(0.0)
        )
    } else if !cycle_matiere_ok {
        format!(
            "⚠️ Volume matière dépassé. Restant: {:.2}h",
            restant_cycle.max(0.0)
        )
    } else {
        "✅ Vacation valide".to_string()
    };

    Ok(VacationCalculated {
        volume_horaire_max_enseignant: plafond_f64,
        cumul_volume_horaire_enseignant: cumul_enseignant,
        volume_horaire_restant_enseignant: restant_enseignant.max(0.0),
        vht_total_cycle_matiere: vht_total_cycle,
        cumul_vht_cycle_matiere: cumul_cycle,
        vht_restant_cycle_matiere: restant_cycle.max(0.0),
        nb_classe: input.nb_classe,
        vhoraire_matiere: matiere.vhoraire,
        vht_demande,
        montant_brut,
        montant_retenu,
        montant_net,
        enseignant_ok,
        cycle_matiere_ok,
        global_ok,
        message,
    })
}