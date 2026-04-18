// src-tauri/src/db.rs

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use std::path::Path;
use std::str::FromStr;

#[derive(Clone)]
pub struct DbState {
    pub pool: SqlitePool,
}

impl DbState {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

// =========================
// INITIALISATION DB
// =========================
pub async fn init_db(db_path: &Path) -> Result<SqlitePool, String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Erreur dossier DB: {}", e))?;
    }

    let db_url = format!("sqlite:{}", db_path.to_string_lossy());

    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| e.to_string())?
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|e| e.to_string())?;

    init_schema(&pool).await?;

    Ok(pool)
}

// =========================
// SCHEMA
// =========================
async fn init_schema(pool: &SqlitePool) -> Result<(), String> {

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    // =========================
    // TABLES
    // =========================

    // Années scolaires
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS annees_scolaires (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            libelle TEXT NOT NULL UNIQUE
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Promotions
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            libelle TEXT NOT NULL UNIQUE
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Cycles
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            designation TEXT NOT NULL UNIQUE,
            nb_classe INTEGER NOT NULL CHECK(nb_classe > 0)
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Modules
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            designation TEXT NOT NULL,
            cycle_id INTEGER NOT NULL,
            UNIQUE(designation, cycle_id),
            FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Matières
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS matieres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            designation TEXT NOT NULL,
            vhoraire REAL NOT NULL CHECK(vhoraire > 0),
            module_id INTEGER NOT NULL,
            UNIQUE(designation, module_id),
            FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Enseignants
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS enseignants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            prenom TEXT NOT NULL,
            telephone TEXT,
            titre TEXT NOT NULL,
            statut TEXT NOT NULL
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Banques
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS banques (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            designation TEXT NOT NULL UNIQUE
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Comptes bancaires
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS comptes_bancaires (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            enseignant_id INTEGER NOT NULL,
            banque_id INTEGER NOT NULL,
            numero_compte TEXT NOT NULL,
            actif INTEGER NOT NULL DEFAULT 1,

            FOREIGN KEY (enseignant_id) REFERENCES enseignants(id) ON DELETE CASCADE,
            FOREIGN KEY (banque_id) REFERENCES banques(id) ON DELETE CASCADE
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // 🔥 1 seul compte actif par enseignant
    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS idx_compte_actif
        ON comptes_bancaires(enseignant_id)
        WHERE actif = 1
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Plafonds
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS plafonds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titre TEXT NOT NULL,
            statut TEXT NOT NULL,
            volume_horaire_max INTEGER NOT NULL,
            UNIQUE(titre, statut)
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Vacations
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS vacations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            enseignant_id INTEGER NOT NULL,
            matiere_id INTEGER NOT NULL,
            promotion_id INTEGER NOT NULL,
            annee_scolaire_id INTEGER NOT NULL,
            nb_classe INTEGER NOT NULL CHECK(nb_classe > 0),
            vhoraire REAL NOT NULL,
            taux_horaire REAL DEFAULT 5000,
            taux_retenue REAL DEFAULT 2,
            mois INTEGER NOT NULL,
            annee INTEGER NOT NULL,

            FOREIGN KEY (enseignant_id) REFERENCES enseignants(id),
            FOREIGN KEY (matiere_id) REFERENCES matieres(id),
            FOREIGN KEY (promotion_id) REFERENCES promotions(id),
            FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id)
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Ordres de virement
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS ordres_virement (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            banque_id INTEGER NOT NULL,
            numero_ordre TEXT NOT NULL UNIQUE,
            date_edition TEXT NOT NULL,
            FOREIGN KEY (banque_id) REFERENCES banques(id)
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Lignes ordre
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS ordre_virement_lignes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ordre_id INTEGER NOT NULL,
            enseignant_id INTEGER NOT NULL,
            compte_bancaire_id INTEGER NOT NULL,
            montant_net REAL NOT NULL,

            FOREIGN KEY (ordre_id) REFERENCES ordres_virement(id) ON DELETE CASCADE,
            FOREIGN KEY (enseignant_id) REFERENCES enseignants(id),
            FOREIGN KEY (compte_bancaire_id) REFERENCES comptes_bancaires(id)
        )
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // =========================
    // DONNÉES INITIALES
    // =========================

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO plafonds (titre, statut, volume_horaire_max) VALUES
            ('directeur', 'interne', 140),
            ('chef de service', 'interne', 160),
            ('autre', 'interne', 180),
            ('directeur', 'externe', 140),
            ('chef de division/service', 'externe', 160),
            ('agent', 'externe', 180),
            ('retraité', 'externe', 200)
        "#
    ).execute(pool).await.map_err(|e| e.to_string())?;

    println!("✅ DB initialisée proprement");

    Ok(())
}