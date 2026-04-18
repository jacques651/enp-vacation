// src-tauri/src/commands/ordres_virement.rs

use crate::db::DbState;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;

// =========================
// MODELES
// =========================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct LigneOrdre {
    pub enseignant_id: i32,
    pub nom: String,
    pub prenom: String,
    pub banque: Option<String>,
    pub numero_compte: Option<String>,
    pub montant_net: Option<f64>, // ⚠️ SUM peut être NULL
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrdreOutput {
    pub total: f64,
    pub lignes: Vec<LigneOrdre>,
}

// =========================
// CALCUL LIGNES
// =========================

async fn get_lignes(
    pool: &sqlx::SqlitePool,
    annee_scolaire_id: i32,
) -> Result<Vec<LigneOrdre>, String> {
    let mut rows = sqlx::query_as::<_, LigneOrdre>(
        r#"
    SELECT 
        e.id as enseignant_id,
        e.nom,
        e.prenom,
        b.designation as banque,
        cb.numero_compte,

        SUM(
            v.vht * v.taux_horaire * (1 - v.taux_retenue/100.0)
        ) as montant_net

    FROM vacations v
    JOIN enseignants e ON e.id = v.enseignant_id

    LEFT JOIN comptes_bancaires cb 
        ON cb.enseignant_id = e.id AND cb.actif = 1
    LEFT JOIN banques b ON b.id = cb.banque_id

    WHERE v.annee_scolaire_id = ?

    GROUP BY e.id
    ORDER BY e.nom
    "#,
    )
    .bind(annee_scolaire_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    // 🔥 sécuriser NULL → 0
    for r in &mut rows {
        r.montant_net = Some(r.montant_net.unwrap_or(0.0));
    }

    Ok(rows)
}

// =========================
// GENERER ORDRE
// =========================

#[tauri::command]
pub async fn generer_ordre_virement(
    state: State<'_, DbState>,
    annee_scolaire_id: i32,
) -> Result<OrdreOutput, String> {
    let lignes = get_lignes(&state.pool, annee_scolaire_id).await?;

    let total: f64 = lignes.iter().map(|l| l.montant_net.unwrap_or(0.0)).sum();

    Ok(OrdreOutput { total, lignes })
}
