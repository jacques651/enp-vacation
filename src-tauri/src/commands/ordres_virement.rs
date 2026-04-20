// src-tauri/src/commands/ordres_virement.rs

use crate::db::DbState;
use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Clone, FromRow)]
struct EnseignantTotal {
    enseignant_id: i64,
    nom: String,
    prenom: String,
    titre: String,
    statut: String,
    numero_compte: Option<String>,
    cle_rib: Option<String>,
    banque_designation: Option<String>,
    banque_id: Option<i64>,
    montant_brut: f64,
    retenue: f64,
    montant_net: f64,
}

#[derive(Debug, Clone, FromRow)]
struct LigneOrdreSql {
    id: i64,
    enseignant_id: i64,
    nom: String,
    prenom: String,
    compte_bancaire_id: i64,
    numero_compte: String,
    cle_rib: String,
    montant_brut: f64,
    retenue: f64,
    montant_net: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LigneOrdreResponse {
    pub id: i64,
    pub enseignant_id: i64,
    pub nom: String,
    pub prenom: String,
    pub compte_bancaire_id: i64,
    pub numero_compte: String,
    pub cle_rib: String,
    pub montant_brut: f64,
    pub retenue: f64,
    pub montant_net: f64,
}

impl From<LigneOrdreSql> for LigneOrdreResponse {
    fn from(sql: LigneOrdreSql) -> Self {
        Self {
            id: sql.id,
            enseignant_id: sql.enseignant_id,
            nom: sql.nom,
            prenom: sql.prenom,
            compte_bancaire_id: sql.compte_bancaire_id,
            numero_compte: sql.numero_compte,
            cle_rib: sql.cle_rib,
            montant_brut: sql.montant_brut,
            retenue: sql.retenue,
            montant_net: sql.montant_net,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrdreVirementResponse {
    pub id: i64,
    pub banque_id: i64,
    pub banque_designation: String,
    pub numero_ordre: String,
    pub date_edition: String,
    pub objet: String,
    pub total_net: f64,
    pub lignes: Vec<LigneOrdreResponse>,
}

#[tauri::command]
pub async fn generer_ordre_virement(
    state: State<'_, DbState>,
    mois: i32,
    annee: i32,
) -> Result<Vec<OrdreVirementResponse>, String> {
    println!(
        "🔍 Génération ordre virement - mois: {}, année: {}",
        mois, annee
    );

    let enseignants: Vec<EnseignantTotal> = sqlx::query_as(
        r#"
        SELECT 
            e.id as enseignant_id,
            e.nom,
            e.prenom,
            e.titre,
            e.statut,
            cb.numero_compte,
            cb.cle_rib,
            b.designation as banque_designation,
            b.id as banque_id,
            COALESCE(SUM(v.vht * v.taux_horaire), 0) as montant_brut,
            COALESCE(SUM(v.vht * v.taux_horaire * v.taux_retenue / 100.0), 0) as retenue,
            COALESCE(SUM(v.vht * v.taux_horaire * (1 - v.taux_retenue / 100.0)), 0) as montant_net
        FROM vacations v
        JOIN enseignants e ON e.id = v.enseignant_id
        LEFT JOIN comptes_bancaires cb ON cb.enseignant_id = e.id AND cb.actif = 1
        LEFT JOIN banques b ON b.id = cb.banque_id
        WHERE v.mois = ? AND v.annee = ?
        GROUP BY e.id, e.nom, e.prenom, e.titre, e.statut, cb.numero_compte, cb.cle_rib, b.designation, b.id
        HAVING COALESCE(SUM(v.vht * v.taux_horaire * (1 - v.taux_retenue / 100.0)), 0) > 0
        "#,
    )
    .bind(mois)
    .bind(annee)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        println!("❌ Erreur récupération: {}", e);
        format!("Erreur lors de la récupération des données: {}", e)
    })?;

    if enseignants.is_empty() {
        return Err("Aucune vacation trouvée pour la période sélectionnée".to_string());
    }

    println!("✅ {} enseignants trouvés", enseignants.len());

    let mut group_by_banque: HashMap<Option<i64>, (String, Vec<EnseignantTotal>)> = HashMap::new();

    for enseignant in enseignants {
        let key = enseignant.banque_id;
        let banque_name = enseignant
            .banque_designation
            .clone()
            .unwrap_or_else(|| "SANS BANQUE".to_string());

        group_by_banque
            .entry(key)
            .or_insert_with(|| (banque_name, Vec::new()))
            .1
            .push(enseignant);
    }

    let mut result = Vec::new();
    let date_edition = Local::now().format("%Y-%m-%d").to_string();

    for (banque_id, (banque_designation, enseignants_groupe)) in group_by_banque {
        let numero_ordre = format!(
            "ORD-{}-{}",
            Local::now().format("%Y%m%d%H%M%S"),
            banque_designation
                .replace(" ", "")
                .chars()
                .take(10)
                .collect::<String>()
        );

        let ordre_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO ordres_virement (banque_id, numero_ordre, date_edition, objet)
            VALUES (?, ?, ?, ?)
            RETURNING id
            "#,
        )
        .bind(banque_id)
        .bind(&numero_ordre)
        .bind(&date_edition)
        .bind(format!("Ordre de virement - Période: {}/{}", mois, annee))
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            println!("❌ Erreur insertion ordre: {}", e);
            format!("Erreur lors de la création de l'ordre: {}", e)
        })?;

        println!("✅ Ordre créé: {} (ID: {})", numero_ordre, ordre_id);

        let mut lignes = Vec::new();
        let mut total_net = 0.0;

        for enseignant in enseignants_groupe {
            let compte_bancaire_id: i64 = if let Some(numero_compte) = &enseignant.numero_compte {
                let id: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM comptes_bancaires WHERE enseignant_id = ? AND numero_compte = ? AND actif = 1"
        )
        .bind(enseignant.enseignant_id)
        .bind(numero_compte)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
                id.unwrap_or(0)
            } else {
                0
            };

            // Valeur par défaut pour cle_rib si NULL
            let cle_rib_value = enseignant.cle_rib.clone().unwrap_or_else(|| "".to_string());

            let ligne_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO ordre_virement_lignes (ordre_id, enseignant_id, compte_bancaire_id, cle_rib, montant_brut, retenue, montant_net)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id
        "#
    )
    .bind(ordre_id)
    .bind(enseignant.enseignant_id)
    .bind(compte_bancaire_id)
    .bind(&cle_rib_value)
    .bind(enseignant.montant_brut)
    .bind(enseignant.retenue)
    .bind(enseignant.montant_net)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        println!("❌ Erreur insertion ligne: {}", e);
        format!("Erreur lors de l'insertion de la ligne: {}", e)
    })?;

            total_net += enseignant.montant_net;

            lignes.push(LigneOrdreResponse {
                id: ligne_id,
                enseignant_id: enseignant.enseignant_id,
                nom: enseignant.nom,
                prenom: enseignant.prenom,
                compte_bancaire_id,
                numero_compte: enseignant.numero_compte.unwrap_or_default(),
                cle_rib: cle_rib_value,
                montant_brut: enseignant.montant_brut,
                retenue: enseignant.retenue,
                montant_net: enseignant.montant_net,
            });
        }
        result.push(OrdreVirementResponse {
            id: ordre_id,
            banque_id: banque_id.unwrap_or(0),
            banque_designation: banque_designation.clone(),
            numero_ordre,
            date_edition: date_edition.clone(),
            objet: format!("Ordre de virement - Période: {}/{}", mois, annee),
            total_net,
            lignes,
        });
    }

    println!("✅ {} ordres générés", result.len());
    Ok(result)
}

#[tauri::command]
pub async fn get_ordres_virement(
    state: State<'_, DbState>,
) -> Result<Vec<OrdreVirementResponse>, String> {
    let ordres = sqlx::query_as::<_, (i64, Option<i64>, String, String, Option<String>, String)>(
        "SELECT id, banque_id, numero_ordre, date_edition, objet, created_at FROM ordres_virement ORDER BY id DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for (id, banque_id, numero_ordre, date_edition, objet, _created_at) in ordres {
        let banque_designation: String = if let Some(b_id) = banque_id {
            sqlx::query_scalar("SELECT designation FROM banques WHERE id = ?")
                .bind(b_id)
                .fetch_one(&state.pool)
                .await
                .unwrap_or_else(|_| "Banque inconnue".to_string())
        } else {
            "SANS BANQUE".to_string()
        };

        let lignes_sql: Vec<LigneOrdreSql> = sqlx::query_as(
            r#"
            SELECT 
                ol.id,
                ol.enseignant_id,
                e.nom,
                e.prenom,
                ol.compte_bancaire_id,
                COALESCE(cb.numero_compte, '') as numero_compte,
                COALESCE(cb.cle_rib, '') as cle_rib,
                ol.montant_brut,
                ol.retenue,
                ol.montant_net
            FROM ordre_virement_lignes ol
            JOIN enseignants e ON e.id = ol.enseignant_id
            LEFT JOIN comptes_bancaires cb ON cb.id = ol.compte_bancaire_id
            WHERE ol.ordre_id = ?
            "#,
        )
        .bind(id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

        let lignes: Vec<LigneOrdreResponse> = lignes_sql.into_iter().map(|l| l.into()).collect();
        let total_net: f64 = lignes.iter().map(|l| l.montant_net).sum();

        result.push(OrdreVirementResponse {
            id,
            banque_id: banque_id.unwrap_or(0),
            banque_designation,
            numero_ordre,
            date_edition,
            objet: objet.unwrap_or_default(),
            total_net,
            lignes,
        });
    }

    Ok(result)
}
