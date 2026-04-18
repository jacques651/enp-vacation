// src-tauri/src/commands/etat_liquidation.rs

use crate::db::DbState;
use serde::{Serialize, Deserialize};
use tauri::State;
use sqlx::FromRow;

// =========================
// STRUCTURE
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct LiquidationRow {
    pub id: i32,
    pub nom: String,
    pub prenom: String,
    pub titre: String,
    pub statut: String,

    pub cycle: String,
    pub module: String,
    pub matiere: String,

    pub banque: Option<String>,
    pub numero_compte: Option<String>,

    pub vhoraire: f64,
    pub nb_classe: f64,

    pub vht: f64,
    pub montant_brut: f64,
    pub montant_retenu: f64,
    pub montant_net: f64,

    pub mois: i32,
    pub annee: i32,
}

// =========================
// QUERY PRINCIPALE
// =========================

async fn get_rows(
    pool: &sqlx::SqlitePool,
    mois: i32,
    annee: i32,
) -> Result<Vec<LiquidationRow>, String> {

    let rows = sqlx::query_as::<_, LiquidationRow>(
    r#"
    SELECT 
        v.id,
        e.nom,
        e.prenom,
        e.titre,
        e.statut,

        c.designation as cycle,
        mo.designation as module,
        m.designation as matiere,

        b.designation as banque,
        cb.numero_compte,

        m.vhoraire,              -- ✔ vient de matieres
        v.nb_classe,

        v.vht,                   -- ✔ source de vérité

        (v.vht * v.taux_horaire) as montant_brut,

        (v.vht * v.taux_horaire * v.taux_retenue / 100.0) as montant_retenu,

        (v.vht * v.taux_horaire * (1 - v.taux_retenue/100.0)) as montant_net,

        v.mois,
        v.annee

    FROM vacations v
    JOIN enseignants e ON e.id = v.enseignant_id
    JOIN matieres m ON m.id = v.matiere_id
    JOIN modules mo ON mo.id = m.module_id
    JOIN cycles c ON c.id = mo.cycle_id

    LEFT JOIN comptes_bancaires cb 
        ON cb.enseignant_id = e.id AND cb.actif = 1
    LEFT JOIN banques b ON b.id = cb.banque_id

    WHERE v.mois = ? AND v.annee = ?

    ORDER BY e.nom, e.prenom
    "#
)
.bind(mois)
.bind(annee)
.fetch_all(pool)
.await
.map_err(|e| e.to_string())?;

    Ok(rows)
}

// =========================
// COMMANDES
// =========================

#[tauri::command]
pub async fn get_etat_liquidation(
    state: State<'_, DbState>,
    mois: i32,
    annee: i32,
) -> Result<Vec<LiquidationRow>, String> {

    get_rows(&state.pool, mois, annee).await
}

// =========================
// TOTALS
// =========================

#[derive(Debug, Serialize, Deserialize)]
pub struct Totaux {
    pub total_heures: f64,
    pub total_brut: f64,
    pub total_retenu: f64,
    pub total_net: f64,
}

#[tauri::command]
pub async fn get_totaux_liquidation(
    state: State<'_, DbState>,
    mois: i32,
    annee: i32,
) -> Result<Totaux, String> {

    let rows = get_rows(&state.pool, mois, annee).await?;

    let total_heures: f64 = rows.iter().map(|r| r.vht).sum();
    let total_brut: f64 = rows.iter().map(|r| r.montant_brut).sum();
    let total_retenu: f64 = rows.iter().map(|r| r.montant_retenu).sum();
    let total_net: f64 = rows.iter().map(|r| r.montant_net).sum();

    Ok(Totaux {
        total_heures,
        total_brut,
        total_retenu,
        total_net,
    })
}