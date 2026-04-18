// src-tauri/src/commands/imports.rs

use crate::db::DbState;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct ImportResult {
    pub success: usize,
    pub errors: Vec<String>,
}

// =========================
// 🧠 HELPER
// =========================

fn get_str(v: &serde_json::Value, key: &str) -> String {
    v[key].as_str().unwrap_or("").trim().to_string()
}

// =========================
// IMPORT CYCLES
// =========================

#[tauri::command]
pub async fn import_cycles(
    state: State<'_, DbState>,
    data: Vec<serde_json::Value>,
) -> Result<ImportResult, String> {

    let mut success = 0;
    let mut errors = vec![];

    for (i, item) in data.iter().enumerate() {
        let ligne = i + 1;

        let designation = get_str(item, "designation");
        let nb_classe = item["nb_classe"].as_i64().unwrap_or(0);

        if designation.is_empty() || nb_classe <= 0 {
            errors.push(format!("Ligne {} invalide", ligne));
            continue;
        }

        let res = sqlx::query(
            "INSERT INTO cycles (designation, nb_classe)
             VALUES (?, ?)
             ON CONFLICT(designation) DO NOTHING"
        )
        .bind(&designation)
        .bind(nb_classe)
        .execute(&state.pool)
        .await;

        match res {
            Ok(r) => {
                if r.rows_affected() > 0 {
                    success += 1;
                }
            }
            Err(e) => errors.push(format!("Ligne {}: {}", ligne, e)),
        }
    }

    Ok(ImportResult { success, errors })
}