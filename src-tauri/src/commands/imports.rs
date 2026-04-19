use crate::db::DbState;
use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Serialize)]
pub struct ImportResult {
    pub success: usize,
    pub errors: Vec<String>,
}

fn normalize_text(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| match character {
            'a'..='z' | '0'..='9' | '/' => character,
            '\u{00E0}' | '\u{00E1}' | '\u{00E2}' | '\u{00E4}' => 'a',
            '\u{00E7}' => 'c',
            '\u{00E8}' | '\u{00E9}' | '\u{00EA}' | '\u{00EB}' => 'e',
            '\u{00EC}' | '\u{00ED}' | '\u{00EE}' | '\u{00EF}' => 'i',
            '\u{00F2}' | '\u{00F3}' | '\u{00F4}' | '\u{00F6}' => 'o',
            '\u{00F9}' | '\u{00FA}' | '\u{00FB}' | '\u{00FC}' => 'u',
            _ => ' ',
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn canonical_titre(value: &str) -> Option<&'static str> {
    match normalize_text(value).as_str() {
        "" => None,
        "directeur" => Some("directeur"),
        "chef de service" => Some("chef de service"),
        "chef de division/service" | "chef de division / service" => {
            Some("chef de division/service")
        }
        "agent" => Some("agent"),
        "retraite" => Some("retrait\u{00E9}"),
        "autre" => Some("autre"),
        _ => None,
    }
}

fn canonical_statut(value: &str) -> Option<&'static str> {
    match normalize_text(value).as_str() {
        "" => None,
        "interne" => Some("interne"),
        "externe" => Some("externe"),
        _ => None,
    }
}

fn scalar_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(content) => Some(content.trim().to_string()),
        Value::Number(number) => Some(
            number
                .as_i64()
                .map(|integer| integer.to_string())
                .or_else(|| {
                    number.as_f64().map(|float| {
                        if float.fract() == 0.0 {
                            format!("{}", float as i64)
                        } else {
                            float.to_string()
                        }
                    })
                })
                .unwrap_or_default(),
        ),
        Value::Bool(boolean) => Some(boolean.to_string()),
        _ => None,
    }
}

fn get_str(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(scalar_to_string)
        .unwrap_or_default()
}

fn get_first_str(value: &Value, keys: &[&str]) -> String {
    keys.iter()
        .map(|key| get_str(value, key))
        .find(|candidate| !candidate.is_empty())
        .unwrap_or_default()
}

fn get_optional_str(value: &Value, key: &str) -> Option<String> {
    let content = get_str(value, key);
    if content.is_empty() {
        None
    } else {
        Some(content)
    }
}

fn get_first_optional_str(value: &Value, keys: &[&str]) -> Option<String> {
    let content = get_first_str(value, keys);
    if content.is_empty() {
        None
    } else {
        Some(content)
    }
}

fn parse_number_string(raw: &str) -> Option<f64> {
    raw.trim().replace(',', ".").parse::<f64>().ok()
}

fn get_i64(value: &Value, key: &str) -> Option<i64> {
    match value.get(key) {
        Some(Value::Number(number)) => number.as_i64().or_else(|| {
            number
                .as_f64()
                .filter(|n| n.fract() == 0.0)
                .map(|n| n as i64)
        }),
        Some(Value::String(raw)) => parse_number_string(raw)
            .filter(|n| n.fract() == 0.0)
            .map(|n| n as i64),
        _ => None,
    }
}

fn get_f64(value: &Value, key: &str) -> Option<f64> {
    match value.get(key) {
        Some(Value::Number(number)) => number.as_f64(),
        Some(Value::String(raw)) => parse_number_string(raw),
        _ => None,
    }
}

fn line_error(line: usize, message: impl Into<String>) -> String {
    format!("Ligne {}: {}", line, message.into())
}

async fn resolve_unique_id(
    pool: &SqlitePool,
    query: &str,
    parameter: &str,
    label: &str,
) -> Result<i32, String> {
    let ids: Vec<i32> = sqlx::query_scalar(query)
        .bind(parameter)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    match ids.len() {
        0 => Err(format!("{} introuvable: {}", label, parameter)),
        1 => Ok(ids[0]),
        _ => Err(format!("{} ambigu: {}", label, parameter)),
    }
}

async fn resolve_cycle_id(pool: &SqlitePool, item: &Value) -> Result<i32, String> {
    if let Some(cycle_id) = get_i64(item, "cycle_id").filter(|value| *value > 0) {
        return Ok(cycle_id as i32);
    }

    let cycle = get_first_optional_str(item, &["cycle", "cycle_designation"])
        .ok_or_else(|| "cycle ou cycle_id requis".to_string())?;

    resolve_unique_id(
        pool,
        "SELECT id FROM cycles WHERE LOWER(TRIM(designation)) = LOWER(TRIM(?))",
        &cycle,
        "Cycle",
    )
    .await
}

async fn resolve_module_id(pool: &SqlitePool, item: &Value) -> Result<i32, String> {
    if let Some(module_id) = get_i64(item, "module_id").filter(|value| *value > 0) {
        return Ok(module_id as i32);
    }

    let module = get_first_optional_str(item, &["module", "module_designation"])
        .ok_or_else(|| "module ou module_id requis".to_string())?;

    if let Some(cycle_id) = get_i64(item, "cycle_id").filter(|value| *value > 0) {
        let ids: Vec<i32> = sqlx::query_scalar(
            "SELECT id FROM modules WHERE LOWER(TRIM(designation)) = LOWER(TRIM(?)) AND cycle_id = ?",
        )
        .bind(&module)
        .bind(cycle_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        return match ids.len() {
            0 => Err(format!(
                "Module introuvable dans le cycle id {}: {}",
                cycle_id, module
            )),
            1 => Ok(ids[0]),
            _ => Err(format!(
                "Module ambigu dans le cycle id {}: {}",
                cycle_id, module
            )),
        };
    }

    if let Some(cycle) = get_first_optional_str(item, &["cycle", "cycle_designation"]) {
        let ids: Vec<i32> = sqlx::query_scalar(
            r#"
            SELECT m.id
            FROM modules m
            JOIN cycles c ON c.id = m.cycle_id
            WHERE LOWER(TRIM(m.designation)) = LOWER(TRIM(?))
              AND LOWER(TRIM(c.designation)) = LOWER(TRIM(?))
            "#,
        )
        .bind(&module)
        .bind(&cycle)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        return match ids.len() {
            0 => Err(format!(
                "Module introuvable dans le cycle {}: {}",
                cycle, module
            )),
            1 => Ok(ids[0]),
            _ => Err(format!("Module ambigu dans le cycle {}: {}", cycle, module)),
        };
    }

    resolve_unique_id(
        pool,
        "SELECT id FROM modules WHERE LOWER(TRIM(designation)) = LOWER(TRIM(?))",
        &module,
        "Module",
    )
    .await
}

async fn resolve_banque_id(pool: &SqlitePool, designation: &str) -> Result<i32, String> {
    resolve_unique_id(
        pool,
        "SELECT id FROM banques WHERE LOWER(TRIM(designation)) = LOWER(TRIM(?))",
        designation,
        "Banque",
    )
    .await
}

#[tauri::command]
pub async fn import_cycles(
    state: State<'_, DbState>,
    data: Vec<Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = vec![];

    for (index, item) in data.iter().enumerate() {
        let line = index + 1;
        let designation = get_str(item, "designation");
        let nb_classe = get_i64(item, "nb_classe").unwrap_or(0);

        if designation.is_empty() {
            errors.push(line_error(line, "designation requise"));
            continue;
        }

        if nb_classe <= 0 {
            errors.push(line_error(line, "nb_classe doit etre superieur a 0"));
            continue;
        }

        match sqlx::query(
            "INSERT INTO cycles (designation, nb_classe) VALUES (?, ?) ON CONFLICT(designation) DO NOTHING",
        )
        .bind(&designation)
        .bind(nb_classe)
        .execute(&state.pool)
        .await
        {
            Ok(result) if result.rows_affected() > 0 => success += 1,
            Ok(_) => errors.push(line_error(
                line,
                format!("cycle deja existant: {}", designation),
            )),
            Err(error) => errors.push(line_error(line, error.to_string())),
        }
    }

    Ok(ImportResult { success, errors })
}

#[tauri::command]
pub async fn import_modules(
    state: State<'_, DbState>,
    data: Vec<Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = vec![];

    for (index, item) in data.iter().enumerate() {
        let line = index + 1;
        let designation = get_str(item, "designation");

        if designation.is_empty() {
            errors.push(line_error(line, "designation requise"));
            continue;
        }

        let cycle_id = match resolve_cycle_id(&state.pool, item).await {
            Ok(value) => value,
            Err(error) => {
                errors.push(line_error(line, error));
                continue;
            }
        };

        match sqlx::query(
            "INSERT INTO modules (designation, cycle_id) VALUES (?, ?) ON CONFLICT(designation, cycle_id) DO NOTHING",
        )
        .bind(&designation)
        .bind(cycle_id)
        .execute(&state.pool)
        .await
        {
            Ok(result) if result.rows_affected() > 0 => success += 1,
            Ok(_) => errors.push(line_error(
                line,
                format!("module deja existant dans ce cycle: {}", designation),
            )),
            Err(error) => errors.push(line_error(line, error.to_string())),
        }
    }

    Ok(ImportResult { success, errors })
}

#[tauri::command]
pub async fn import_matieres(
    state: State<'_, DbState>,
    data: Vec<Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = vec![];

    for (index, item) in data.iter().enumerate() {
        let line = index + 1;
        let designation = get_str(item, "designation");
        let vhoraire = get_f64(item, "vhoraire").unwrap_or(0.0);

        if designation.is_empty() {
            errors.push(line_error(line, "designation requise"));
            continue;
        }

        if vhoraire <= 0.0 {
            errors.push(line_error(line, "vhoraire doit etre superieur a 0"));
            continue;
        }

        let module_id = match resolve_module_id(&state.pool, item).await {
            Ok(value) => value,
            Err(error) => {
                errors.push(line_error(line, error));
                continue;
            }
        };

        match sqlx::query(
            "INSERT INTO matieres (designation, vhoraire, module_id) VALUES (?, ?, ?) ON CONFLICT(designation, module_id) DO NOTHING",
        )
        .bind(&designation)
        .bind(vhoraire)
        .bind(module_id)
        .execute(&state.pool)
        .await
        {
            Ok(result) if result.rows_affected() > 0 => success += 1,
            Ok(_) => errors.push(line_error(
                line,
                format!("matiere deja existante dans ce module: {}", designation),
            )),
            Err(error) => errors.push(line_error(line, error.to_string())),
        }
    }

    Ok(ImportResult { success, errors })
}

#[tauri::command]
pub async fn import_banques(
    state: State<'_, DbState>,
    data: Vec<Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = vec![];

    for (index, item) in data.iter().enumerate() {
        let line = index + 1;
        let designation = get_str(item, "designation");

        if designation.is_empty() {
            errors.push(line_error(line, "designation requise"));
            continue;
        }

        match sqlx::query(
            "INSERT INTO banques (designation) VALUES (?) ON CONFLICT(designation) DO NOTHING",
        )
        .bind(&designation)
        .execute(&state.pool)
        .await
        {
            Ok(result) if result.rows_affected() > 0 => success += 1,
            Ok(_) => errors.push(line_error(
                line,
                format!("banque deja existante: {}", designation),
            )),
            Err(error) => errors.push(line_error(line, error.to_string())),
        }
    }

    Ok(ImportResult { success, errors })
}

#[tauri::command]
pub async fn import_promotions(
    state: State<'_, DbState>,
    data: Vec<Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = vec![];

    for (index, item) in data.iter().enumerate() {
        let line = index + 1;
        let libelle = get_str(item, "libelle");

        if libelle.is_empty() {
            errors.push(line_error(line, "libelle requis"));
            continue;
        }

        match sqlx::query(
            "INSERT INTO promotions (libelle) VALUES (?) ON CONFLICT(libelle) DO NOTHING",
        )
        .bind(&libelle)
        .execute(&state.pool)
        .await
        {
            Ok(result) if result.rows_affected() > 0 => success += 1,
            Ok(_) => errors.push(line_error(
                line,
                format!("promotion deja existante: {}", libelle),
            )),
            Err(error) => errors.push(line_error(line, error.to_string())),
        }
    }

    Ok(ImportResult { success, errors })
}

#[tauri::command]
pub async fn import_plafonds(
    state: State<'_, DbState>,
    data: Vec<Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = vec![];

    for (index, item) in data.iter().enumerate() {
        let line = index + 1;
        let raw_titre = get_str(item, "titre");
        let raw_statut = get_str(item, "statut");
        let volume_horaire_max = get_i64(item, "volume_horaire_max").unwrap_or(0);

        if raw_titre.is_empty() {
            errors.push(line_error(line, "titre requis"));
            continue;
        }

        let Some(titre) = canonical_titre(&raw_titre) else {
            errors.push(line_error(line, format!("titre invalide: {}", raw_titre)));
            continue;
        };

        let Some(statut) = canonical_statut(&raw_statut) else {
            errors.push(line_error(
                line,
                "statut invalide (interne ou externe attendus)",
            ));
            continue;
        };

        if volume_horaire_max <= 0 {
            errors.push(line_error(
                line,
                "volume_horaire_max doit etre superieur a 0",
            ));
            continue;
        }

        match sqlx::query(
            "INSERT INTO plafonds (titre, statut, volume_horaire_max) VALUES (?, ?, ?) ON CONFLICT(titre, statut) DO UPDATE SET volume_horaire_max = excluded.volume_horaire_max",
        )
        .bind(titre)
        .bind(statut)
        .bind(volume_horaire_max)
        .execute(&state.pool)
        .await
        {
            Ok(_) => success += 1,
            Err(error) => errors.push(line_error(line, error.to_string())),
        }
    }

    Ok(ImportResult { success, errors })
}

#[tauri::command]
pub async fn import_enseignants(
    state: State<'_, DbState>,
    data: Vec<Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = vec![];

    for (index, item) in data.iter().enumerate() {
        let line = index + 1;
        let nom = get_str(item, "nom");
        let prenom = get_str(item, "prenom");
        let telephone = get_optional_str(item, "telephone");
        let raw_titre = get_optional_str(item, "titre").unwrap_or_else(|| "agent".to_string());
        let raw_statut = get_optional_str(item, "statut").unwrap_or_else(|| "interne".to_string());
        let banque = get_first_optional_str(item, &["banque", "banque_designation"]);
        let numero_compte = get_optional_str(item, "numero_compte");

        if nom.is_empty() || prenom.is_empty() {
            errors.push(line_error(line, "nom et prenom requis"));
            continue;
        }

        let Some(titre) = canonical_titre(&raw_titre) else {
            errors.push(line_error(line, format!("titre invalide: {}", raw_titre)));
            continue;
        };

        let Some(statut) = canonical_statut(&raw_statut) else {
            errors.push(line_error(line, format!("statut invalide: {}", raw_statut)));
            continue;
        };

        if banque.is_some() != numero_compte.is_some() {
            errors.push(line_error(
                line,
                "banque et numero_compte doivent etre fournis ensemble",
            ));
            continue;
        }

        let banque_id = match banque.as_deref() {
            Some(designation) => match resolve_banque_id(&state.pool, designation).await {
                Ok(value) => Some(value),
                Err(error) => {
                    errors.push(line_error(line, error));
                    continue;
                }
            },
            None => None,
        };

        let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

        let enseignant_id: i32 = match sqlx::query_scalar(
            "INSERT INTO enseignants (nom, prenom, telephone, titre, statut) VALUES (?, ?, ?, ?, ?) RETURNING id",
        )
        .bind(&nom)
        .bind(&prenom)
        .bind(&telephone)
        .bind(titre)
        .bind(statut)
        .fetch_one(&mut *tx)
        .await
        {
            Ok(id) => id,
            Err(error) => {
                errors.push(line_error(line, error.to_string()));
                continue;
            }
        };

        if let (Some(resolved_banque_id), Some(numero)) = (banque_id, numero_compte.as_deref()) {
            if let Err(error) = sqlx::query(
                "INSERT INTO comptes_bancaires (enseignant_id, banque_id, numero_compte, actif) VALUES (?, ?, ?, 1)",
            )
            .bind(enseignant_id)
            .bind(resolved_banque_id)
            .bind(numero)
            .execute(&mut *tx)
            .await
            {
                errors.push(line_error(line, error.to_string()));
                continue;
            }
        }

        match tx.commit().await {
            Ok(_) => success += 1,
            Err(error) => errors.push(line_error(line, error.to_string())),
        }
    }

    Ok(ImportResult { success, errors })
}

#[tauri::command]
pub async fn import_annees_scolaires(
    state: State<'_, DbState>,
    data: Vec<Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = vec![];

    for (index, item) in data.iter().enumerate() {
        let line = index + 1;
        let libelle = get_str(item, "libelle");

        if libelle.is_empty() {
            errors.push(line_error(line, "libelle requis"));
            continue;
        }

        match sqlx::query(
            "INSERT INTO annees_scolaires (libelle) VALUES (?) ON CONFLICT(libelle) DO NOTHING",
        )
        .bind(&libelle)
        .execute(&state.pool)
        .await
        {
            Ok(result) if result.rows_affected() > 0 => success += 1,
            Ok(_) => errors.push(line_error(
                line,
                format!("annee scolaire deja existante: {}", libelle),
            )),
            Err(e) => errors.push(line_error(line, e.to_string())),
        }
    }

    Ok(ImportResult { success, errors })
}

#[tauri::command]
pub async fn import_comptes_bancaires(
    state: State<'_, DbState>,
    data: Vec<Value>,
) -> Result<ImportResult, String> {
    let mut success = 0;
    let mut errors = vec![];

    for (index, item) in data.iter().enumerate() {
        let line = index + 1;

        let nom = get_first_str(item, &["nom", "enseignant_nom"]);
        let prenom = get_first_str(item, &["prenom", "enseignant_prenom"]);
        let numero_compte = get_str(item, "numero_compte");
        let banque = get_first_str(item, &["banque", "banque_designation"]);

        if nom.is_empty() || prenom.is_empty() || numero_compte.is_empty() || banque.is_empty() {
            errors.push(line_error(line, "nom, prenom, banque et numero_compte requis"));
            continue;
        }

        let enseignant_id: Result<i32, _> = sqlx::query_scalar(
            "SELECT id FROM enseignants WHERE LOWER(nom)=LOWER(?) AND LOWER(prenom)=LOWER(?)"
        )
        .bind(&nom)
        .bind(&prenom)
        .fetch_one(&state.pool)
        .await;

        let enseignant_id = match enseignant_id {
            Ok(id) => id,
            Err(_) => {
                errors.push(line_error(line, format!("enseignant introuvable: {} {}", nom, prenom)));
                continue;
            }
        };

        let banque_id = match resolve_banque_id(&state.pool, &banque).await {
            Ok(id) => id,
            Err(e) => {
                errors.push(line_error(line, e));
                continue;
            }
        };

        match sqlx::query(
            "INSERT INTO comptes_bancaires (enseignant_id, banque_id, numero_compte, actif) VALUES (?, ?, ?, 1)"
        )
        .bind(enseignant_id)
        .bind(banque_id)
        .bind(&numero_compte)
        .execute(&state.pool)
        .await
        {
            Ok(_) => success += 1,
            Err(e) => errors.push(line_error(line, e.to_string())),
        }
    }

    Ok(ImportResult { success, errors })
}