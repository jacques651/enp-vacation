use crate::db::DbState;
use serde::Serialize;
use sqlx::FromRow;
use tauri::State;

// =========================
// STRUCTURES
// =========================

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub total_vacations_mois: i32,
    pub total_net_mois: f64,
    pub total_enseignants: i32,
    pub total_matieres: i32,
    pub vacations_par_mois: Vec<VacationMois>,
    pub repartition_statut: Vec<RepartitionStatut>,
    pub dernieres_vacations: Vec<DerniereVacation>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct VacationMois {
    pub mois: i32,
    pub total: i32,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RepartitionStatut {
    pub statut: String,
    pub count: i32,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DerniereVacation {
    pub id: i32,
    pub enseignant: String,
    pub matiere: String,
    pub net: f64,
    pub mois: i32,
    pub annee: i32,
}

// =========================
// COMMAND
// =========================

#[tauri::command]
pub async fn get_dashboard_stats(state: State<'_, DbState>) -> Result<DashboardStats, String> {
    // =========================
    // COUNTS
    // =========================

    let total_enseignants: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM enseignants")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let total_matieres: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM matieres")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    // =========================
    // MOIS COURANT
    // =========================

    let total_vacations_mois: i32 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM vacations
        WHERE mois = CAST(strftime('%m','now') AS INTEGER)
          AND annee = CAST(strftime('%Y','now') AS INTEGER)
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // =========================
    // CALCUL FINANCIER - VERSION CORRIGÉE
    // =========================
    // Note: vhoraire est bien une colonne de la table matieres
    let total_net_mois: f64 = sqlx::query_scalar(
        r#"
    SELECT COALESCE(SUM(
        v.vht * v.taux_horaire * (1 - v.taux_retenue/100.0)
    ), 0.0)
    FROM vacations v
    WHERE v.mois = CAST(strftime('%m','now') AS INTEGER)
      AND v.annee = CAST(strftime('%Y','now') AS INTEGER)
    "#,
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?; // ✅ FIX

    // =========================
    // PAR MOIS
    // =========================

    let vacations_par_mois = sqlx::query_as::<_, VacationMois>(
        r#"
        SELECT mois, COUNT(*) as total
        FROM vacations
        GROUP BY mois
        ORDER BY mois
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // =========================
    // STATUTS
    // =========================

    let repartition_statut = sqlx::query_as::<_, RepartitionStatut>(
        r#"
        SELECT statut, COUNT(*) as count
        FROM enseignants
        GROUP BY statut
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // =========================
    let dernieres_vacations = sqlx::query_as::<_, DerniereVacation>(
        r#"
    SELECT 
        v.id,
        (e.nom || ' ' || e.prenom) as enseignant,
        m.designation as matiere,
        (v.vht * v.taux_horaire * (1 - v.taux_retenue/100.0)) as net,
        v.mois,
        v.annee
    FROM vacations v
    JOIN enseignants e ON e.id = v.enseignant_id
    JOIN matieres m ON m.id = v.matiere_id
    ORDER BY v.id DESC
    LIMIT 10
    "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        eprintln!("Erreur SQL pour dernieres_vacations: {:?}", e);
        e.to_string()
    })?;

    // =========================
    // RESULT
    // =========================

    Ok(DashboardStats {
        total_vacations_mois,
        total_net_mois,
        total_enseignants,
        total_matieres,
        vacations_par_mois,
        repartition_statut,
        dernieres_vacations,
    })
}
