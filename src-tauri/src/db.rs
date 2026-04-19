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
        std::fs::create_dir_all(parent).map_err(|e| format!("Erreur dossier DB: {}", e))?;
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
    // 1. TABLES DE BASE
    // =========================

    // Annees scolaires
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS annees_scolaires (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            libelle TEXT NOT NULL UNIQUE
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Promotions
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            libelle TEXT NOT NULL UNIQUE
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Cycles
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            designation TEXT NOT NULL,
            nb_classe INTEGER NOT NULL CHECK(nb_classe > 0)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Modules
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            designation TEXT NOT NULL,
            cycle_id INTEGER NOT NULL,
            FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Matieres
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS matieres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            designation TEXT NOT NULL,
            vhoraire REAL NOT NULL CHECK(vhoraire > 0),
            module_id INTEGER NOT NULL,
            FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Enseignants
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS enseignants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            prenom TEXT NOT NULL,
            telephone TEXT,
            titre TEXT NOT NULL,
            statut TEXT NOT NULL,
            CHECK (titre IN ('directeur','chef de service','chef de division/service','agent','retraité','autre')),
            CHECK (statut IN ('interne','externe'))
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
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Comptes bancaires
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS comptes_bancaires (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            enseignant_id INTEGER NOT NULL,
            banque_id INTEGER NOT NULL,
            numero_compte TEXT NOT NULL,
            actif INTEGER DEFAULT 1,
            date_debut DATE,
            date_fin DATE,
            FOREIGN KEY (enseignant_id) REFERENCES enseignants(id),
            FOREIGN KEY (banque_id) REFERENCES banques(id)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Index pour compte actif unique
    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS idx_compte_actif
        ON comptes_bancaires(enseignant_id)
        WHERE actif = 1
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Plafonds
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS plafonds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titre TEXT NOT NULL,
            statut TEXT NOT NULL,
            volume_horaire_max INTEGER NOT NULL,
            UNIQUE(titre, statut),
            CHECK (titre IN ('directeur','chef de service','chef de division/service','agent','retraité','autre')),
            CHECK (statut IN ('interne','externe'))
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
            vht REAL NOT NULL,
            taux_horaire REAL NOT NULL DEFAULT 5000,
            taux_retenue REAL DEFAULT 2,
            mois INTEGER NOT NULL CHECK(mois BETWEEN 1 AND 12),
            annee INTEGER NOT NULL,
            date_traitement DATE DEFAULT CURRENT_DATE,
            FOREIGN KEY (enseignant_id) REFERENCES enseignants(id),
            FOREIGN KEY (matiere_id) REFERENCES matieres(id),
            FOREIGN KEY (promotion_id) REFERENCES promotions(id),
            FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Ordres de virement
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS ordres_virement (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            banque_id INTEGER NOT NULL,
            numero_ordre TEXT NOT NULL UNIQUE,
            date_edition DATE NOT NULL,
            objet TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (banque_id) REFERENCES banques(id)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Lignes ordre
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS ordre_virement_lignes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ordre_id INTEGER NOT NULL,
            enseignant_id INTEGER NOT NULL,
            compte_bancaire_id INTEGER NOT NULL,
            montant_brut REAL NOT NULL,
            retenue REAL NOT NULL,
            montant_net REAL NOT NULL,
            FOREIGN KEY (ordre_id) REFERENCES ordres_virement(id) ON DELETE CASCADE,
            FOREIGN KEY (enseignant_id) REFERENCES enseignants(id),
            FOREIGN KEY (compte_bancaire_id) REFERENCES comptes_bancaires(id)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Signataires - CORRECTION : grade devient nullable
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS signataires (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            prenom TEXT NOT NULL,
            grade TEXT,  -- Changé de NOT NULL à nullable
            fonction TEXT NOT NULL,
            titre TEXT NOT NULL,
            ordre_signature INTEGER NOT NULL DEFAULT 1,
            actif INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            CHECK (ordre_signature > 0),
            CHECK (actif IN (0, 1))
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Entete (paramètres généraux) - Stockage du logo en base64
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS entete (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cle TEXT NOT NULL UNIQUE,
            valeur TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // =========================
    // INDEX
    // =========================
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_modules_cycle ON modules(cycle_id)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_matieres_module ON matieres(module_id)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_vacations_enseignant ON vacations(enseignant_id)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_vacations_matiere ON vacations(matiere_id)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_vacations_promotion ON vacations(promotion_id)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_vacations_annee_scolaire ON vacations(annee_scolaire_id)",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_signataires_actif ON signataires(actif)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_signataires_ordre ON signataires(ordre_signature)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_entete_cle ON entete(cle)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    // =========================
    // VUE (ETAT DE LIQUIDATION)
    // =========================
    sqlx::query("DROP VIEW IF EXISTS v_etat_liquidation")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
    CREATE VIEW v_etat_liquidation AS
    SELECT 
        v.id AS numero_ordre,
        e.nom,
        e.prenom,
        e.titre,
        e.statut,
        c.designation AS cycle,
        mod.designation AS module,
        m.designation AS matiere,
        b.designation AS banque,
        m.vhoraire AS vhoraire,
        v.nb_classe,
        v.vht,
        v.taux_horaire,
        v.taux_retenue,
        (v.vht * v.taux_horaire) AS montant_brut,
        (v.vht * v.taux_horaire * v.taux_retenue / 100) AS montant_retenu,
        (v.vht * v.taux_horaire * (1 - v.taux_retenue / 100)) AS montant_net,
        CAST(v.mois AS INTEGER) AS mois,
        CAST(v.annee AS INTEGER) AS annee,
        a.libelle AS annee_scolaire,
        p.libelle AS promotion
    FROM vacations v
    JOIN enseignants e ON e.id = v.enseignant_id
    JOIN matieres m ON m.id = v.matiere_id
    JOIN modules mod ON mod.id = m.module_id
    JOIN cycles c ON c.id = mod.cycle_id
    LEFT JOIN comptes_bancaires cb ON cb.enseignant_id = e.id AND cb.actif = 1
    LEFT JOIN banques b ON b.id = cb.banque_id
    JOIN annees_scolaires a ON a.id = v.annee_scolaire_id
    JOIN promotions p ON p.id = v.promotion_id
    "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    
    // =========================
    // DONNEES INITIALES
    // =========================

    // Plafonds
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
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Signataires - CORRECTION : ajout des valeurs avec grade nullable
    sqlx::query(
        r#"
        INSERT OR IGNORE INTO signataires (nom, prenom, grade, fonction, titre, ordre_signature, actif) VALUES
            ('BELEM', 'Abdoulaye', 'Commissaire Divisionnaire de Police', 'Directeur Général', 'Directeur Général', 1, 1),
            ('SINDE', 'Salif', 'Commissaire Divisionnaire de Police', 'Directeur de l''Administration des Finances', 'Directeur Administratif et Financier', 2, 1)
        "#,
    ).execute(pool).await.map_err(|e| e.to_string())?;

    // Entete (paramètres généraux) - logo en base64 vide au départ
    sqlx::query(
        r#"
        INSERT OR IGNORE INTO entete (cle, valeur) VALUES
            ('nom_etablissement', 'ECOLE NATIONALE DE POLICE'),
            ('sigle', 'ENP'),
            ('logo', ''),
            ('adresse', '01 BP 1234 OUAGADOUGOU 01'),
            ('telephone', '25 36 11 11'),
            ('email', 'enp@police.bf'),
            ('directeur_nom', ''),
            ('directeur_titre', ''),
            ('directeur_fonction', ''),
            ('comptable_nom', ''),
            ('comptable_titre', ''),
            ('comptable_fonction', ''),
            ('signataire_defaut', '')
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // =========================
    // VERIFICATION FINALE
    // =========================
    sqlx::query("PRAGMA integrity_check")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("ANALYZE")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("✅ Base de données initialisée avec succès");

    Ok(())
}