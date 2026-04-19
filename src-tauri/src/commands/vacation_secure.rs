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

    pub vhoraire_matiere: f64, // ✔ renommé (source = matieres)

    pub taux_horaire: f64,
    pub taux_retenue: f64,

    pub vht: f64, // ✔ source de vérité

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
// STRUCT INTERNE
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
// CREATE SECURE
// =========================

#[tauri::command]
pub async fn create_vacation(
    state: State<'_, DbState>,
    input: VacationInput,
) -> Result<i32, String> {
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

    let nb_classe_cycle: f64 = sqlx::query_scalar("SELECT nb_classe FROM cycles WHERE id = ?")
        .bind(matiere.cycle_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| "Cycle invalide".to_string())?;

    let vht_demande = input.nb_classe as f64 * matiere.vhoraire;

    // 2. PLAFOND
    let enseignant: EnseignantInfo =
        sqlx::query_as("SELECT titre, statut FROM enseignants WHERE id = ?")
            .bind(input.enseignant_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|_| "Enseignant non trouvé".to_string())?;

    let plafond: f64 = sqlx::query_scalar(
        "SELECT volume_horaire_max FROM plafonds WHERE titre = ? AND statut = ?",
    )
    .bind(&enseignant.titre)
    .bind(&enseignant.statut)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Plafond non trouvé".to_string())?;

    let cumul: f64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(vht),0)
        FROM vacations
        WHERE enseignant_id = ? AND annee_scolaire_id = ?
        "#,
    )
    .bind(input.enseignant_id)
    .bind(input.annee_scolaire_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if cumul + vht_demande > plafond {
        return Err(format!("Plafond dépassé : restant {:.2}h", plafond - cumul));
    }

    // 3. CONTROLE CYCLE
    let vht_max = nb_classe_cycle * matiere.vhoraire;

    let cumul_cycle: f64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(v.vht),0)
        FROM vacations v
        WHERE v.matiere_id = ? AND v.annee_scolaire_id = ?
        "#,
    )
    .bind(input.matiere_id)
    .bind(input.annee_scolaire_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if cumul_cycle + vht_demande > vht_max {
        return Err(format!(
            "Volume matière dépassé : restant {:.2}h",
            vht_max - cumul_cycle
        ));
    }

    // 4. INSERTION CORRECTE
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
            annee,
            date_traitement
        )
        VALUES (?, ?, ?, ?, ?, ?, 5000, 2, ?, ?, DATE('now'))
        RETURNING id
        "#,
    )
    .bind(input.enseignant_id)
    .bind(input.matiere_id)
    .bind(input.promotion_id)
    .bind(input.annee_scolaire_id)
    .bind(input.nb_classe)
    .bind(vht_demande)
    .bind(input.mois)
    .bind(input.annee)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

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

           mat.vhoraire AS vhoraire_matiere, -- ✔ vient de matieres

            v.taux_horaire,
            v.taux_retenue,

            v.vht, -- ✔ clé principale

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
// UPDATE VACATION
// =========================

#[tauri::command]
pub async fn update_vacation(
    state: State<'_, DbState>,
    id: i32,
    input: VacationInput,
) -> Result<(), String> {
    // 1. Récupérer vhoraire depuis matieres
    let vhoraire: f64 = sqlx::query_scalar("SELECT vhoraire FROM matieres WHERE id = ?")
        .bind(input.matiere_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| "Matière invalide".to_string())?;

    // 2. Calcul VHT
    let vht = input.nb_classe as f64 * vhoraire;

    // 3. UPDATE PROPRE
    sqlx::query(
        r#"
        UPDATE vacations
        SET enseignant_id = ?,
            matiere_id = ?,
            promotion_id = ?,
            annee_scolaire_id = ?,
            nb_classe = ?,
            vht = ?,              -- ✔ seule valeur calculée
            taux_horaire = ?,     -- ⚠️ important
            taux_retenue = ?,     -- ⚠️ important
            mois = ?,
            annee = ?
        WHERE id = ?
        "#,
    )
    .bind(input.enseignant_id)
    .bind(input.matiere_id)
    .bind(input.promotion_id)
    .bind(input.annee_scolaire_id)
    .bind(input.nb_classe)
    .bind(vht)
    .bind(5000) // ou input.taux_horaire si dispo
    .bind(2) // ou input.taux_retenue si dispo
    .bind(input.mois)
    .bind(input.annee)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
// =========================
// DELETE VACATION
// =========================

#[tauri::command]
pub async fn delete_vacation(state: State<'_, DbState>, id: i32) -> Result<(), String> {
    // 1. Vérifier existence
    let exists: Option<i32> = sqlx::query_scalar("SELECT id FROM vacations WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    if exists.is_none() {
        return Err("Vacation introuvable".to_string());
    }

    // 2. Suppression
    let result = sqlx::query("DELETE FROM vacations WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    // 3. Vérifier suppression
    if result.rows_affected() == 0 {
        return Err("Échec de suppression".to_string());
    }

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

    pub vhoraire_matiere: f64, // ✔ renommé

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

    let nb_classe_cycle: f64 = sqlx::query_scalar(
        "SELECT nb_classe FROM cycles WHERE id = ?"
    )
    .bind(matiere.cycle_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Cycle invalide".to_string())?;

    let vht_demande = input.nb_classe as f64 * matiere.vhoraire;
    let vht_total_cycle = nb_classe_cycle * matiere.vhoraire;

    // =========================
    // 2. PLAFOND ENSEIGNANT
    // =========================

    let enseignant: EnseignantInfo = sqlx::query_as(
        "SELECT titre, statut FROM enseignants WHERE id = ?"
    )
    .bind(input.enseignant_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Enseignant non trouvé".to_string())?;

    let plafond: f64 = sqlx::query_scalar(
        "SELECT volume_horaire_max FROM plafonds WHERE titre = ? AND statut = ?"
    )
    .bind(&enseignant.titre)
    .bind(&enseignant.statut)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| "Plafond non trouvé".to_string())?;

    let cumul_enseignant: f64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(vht),0)
        FROM vacations
        WHERE enseignant_id = ? AND annee_scolaire_id = ?
        "#
    )
    .bind(input.enseignant_id)
    .bind(input.annee_scolaire_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let restant_enseignant = plafond - cumul_enseignant;
    let enseignant_ok = vht_demande <= restant_enseignant;

    // =========================
    // 3. CONTROLE MATIERE
    // =========================

    let cumul_cycle: f64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(vht),0)
        FROM vacations
        WHERE matiere_id = ? AND annee_scolaire_id = ?
        "#
    )
    .bind(input.matiere_id)
    .bind(input.annee_scolaire_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let restant_cycle = vht_total_cycle - cumul_cycle;
    let cycle_matiere_ok = vht_demande <= restant_cycle;

    // =========================
    // 4. FINANCIER
    // =========================

    let taux_horaire = 5000.0;
    let taux_retenue = 2.0;

    let montant_brut = vht_demande * taux_horaire;
    let montant_retenu = montant_brut * taux_retenue / 100.0;
    let montant_net = montant_brut - montant_retenu;

    // =========================
    // 5. VALIDATION
    // =========================

    let global_ok = enseignant_ok && cycle_matiere_ok;

    let message = if !enseignant_ok {
        format!(
            "Plafond enseignant dépassé. Restant: {:.2}h",
            restant_enseignant
        )
    } else if !cycle_matiere_ok {
        format!(
            "Volume matière dépassé. Restant: {:.2}h",
            restant_cycle
        )
    } else {
        "Vacation valide".to_string()
    };

    Ok(VacationCalculated {
        volume_horaire_max_enseignant: plafond,
        cumul_volume_horaire_enseignant: cumul_enseignant,
        volume_horaire_restant_enseignant: restant_enseignant,

        vht_total_cycle_matiere: vht_total_cycle,
        cumul_vht_cycle_matiere: cumul_cycle,
        vht_restant_cycle_matiere: restant_cycle,

        nb_classe: input.nb_classe,
        vhoraire_matiere: matiere.vhoraire, // ✔ IMPORTANT (renommé)
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