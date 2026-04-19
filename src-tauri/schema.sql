-- =====================================================
-- ACTIVATION
-- =====================================================
PRAGMA foreign_keys = ON;

-- =====================================================
-- 1. TABLES DE BASE
-- =====================================================

-- -----------------------------
-- 1.1 ANNEES SCOLAIRES
-- -----------------------------
CREATE TABLE IF NOT EXISTS annees_scolaires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    libelle TEXT NOT NULL UNIQUE
);

-- -----------------------------
-- 1.2 PROMOTIONS
-- -----------------------------
CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    libelle TEXT NOT NULL UNIQUE
);

-- -----------------------------
-- 1.3 CYCLES
-- -----------------------------
CREATE TABLE IF NOT EXISTS cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    designation TEXT NOT NULL,
    nb_classe INTEGER NOT NULL CHECK(nb_classe > 0)
);

-- -----------------------------
-- 1.4 MODULES
-- -----------------------------
CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    designation TEXT NOT NULL,
    cycle_id INTEGER NOT NULL,
    FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
);

-- -----------------------------
-- 1.5 MATIERES
-- -----------------------------
CREATE TABLE IF NOT EXISTS matieres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    designation TEXT NOT NULL,
    vhoraire REAL NOT NULL CHECK(vhoraire > 0),
    module_id INTEGER NOT NULL,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- =====================================================
-- 2. ENSEIGNANTS & BANQUES
-- =====================================================

-- -----------------------------
-- 2.1 ENSEIGNANTS
-- -----------------------------
CREATE TABLE IF NOT EXISTS enseignants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    telephone TEXT,
    titre TEXT NOT NULL,
    statut TEXT NOT NULL,
    CHECK (titre IN ('directeur','chef de service','chef de division/service','agent','retraité','autre')),
    CHECK (statut IN ('interne','externe'))
);

-- -----------------------------
-- 2.2 BANQUES
-- -----------------------------
CREATE TABLE IF NOT EXISTS banques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    designation TEXT NOT NULL UNIQUE
);

-- -----------------------------
-- 2.3 COMPTES BANCAIRES
-- -----------------------------
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
);

-- =====================================================
-- 3. PLAFONDS
-- =====================================================
CREATE TABLE IF NOT EXISTS plafonds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    statut TEXT NOT NULL,
    volume_horaire_max INTEGER NOT NULL,
    UNIQUE (titre, statut),
    CHECK (titre IN ('directeur','chef de service','chef de division/service','agent','retraité','autre')),
    CHECK (statut IN ('interne','externe'))
);

-- =====================================================
-- 4. VACATIONS (TABLE CENTRALE)
-- =====================================================
CREATE TABLE IF NOT EXISTS vacations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enseignant_id INTEGER NOT NULL,
    matiere_id INTEGER NOT NULL,
    promotion_id INTEGER NOT NULL,
    annee_scolaire_id INTEGER NOT NULL,

    nb_classe INTEGER NOT NULL CHECK(nb_classe > 0),

    -- Snapshot pour stabilité des calculs
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
);

-- =====================================================
-- 5. ORDRES DE VIREMENT
-- =====================================================

-- -----------------------------
-- 5.1 ORDRE
-- -----------------------------
CREATE TABLE IF NOT EXISTS ordres_virement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    banque_id INTEGER NOT NULL,
    numero_ordre TEXT NOT NULL UNIQUE,
    date_edition DATE NOT NULL,
    objet TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (banque_id) REFERENCES banques(id)
);

-- -----------------------------
-- 5.2 LIGNES
-- -----------------------------
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
);

-- =====================================================
-- 6. SIGNAIRES (CORRIGÉ)
-- =====================================================
CREATE TABLE IF NOT EXISTS signataires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    grade TEXT NOT NULL,
    fonction TEXT NOT NULL,
    titre TEXT NOT NULL,
    ordre_signature INTEGER NOT NULL DEFAULT 1,
    actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (ordre_signature > 0),
    CHECK (actif IN (0, 1))
);

-- =====================================================
-- 7. ENTETE (PARAMETRES GENERAUX) - AVEC BASE64
-- =====================================================
CREATE TABLE IF NOT EXISTS entete (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cle TEXT NOT NULL UNIQUE,
    valeur TEXT,  -- Stocke le base64 pour le logo
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. INDEX (PERFORMANCES)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_modules_cycle ON modules(cycle_id);
CREATE INDEX IF NOT EXISTS idx_matieres_module ON matieres(module_id);
CREATE INDEX IF NOT EXISTS idx_vacations_enseignant ON vacations(enseignant_id);
CREATE INDEX IF NOT EXISTS idx_vacations_matiere ON vacations(matiere_id);
CREATE INDEX IF NOT EXISTS idx_vacations_promotion ON vacations(promotion_id);
CREATE INDEX IF NOT EXISTS idx_vacations_annee_scolaire ON vacations(annee_scolaire_id);
CREATE INDEX IF NOT EXISTS idx_signataires_actif ON signataires(actif);
CREATE INDEX IF NOT EXISTS idx_signataires_ordre ON signataires(ordre_signature);
CREATE INDEX IF NOT EXISTS idx_entete_cle ON entete(cle);

-- =====================================================
-- 9. VUE UTILE (ETAT DE LIQUIDATION)
-- =====================================================
DROP VIEW IF EXISTS v_etat_liquidation;

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

    v.mois,
    v.annee,
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
JOIN promotions p ON p.id = v.promotion_id;

-- =====================================================
-- 10. DONNEES INITIALES (CORRIGÉES)
-- =====================================================

-- Plafonds
INSERT OR IGNORE INTO plafonds (titre, statut, volume_horaire_max) VALUES
    ('directeur', 'interne', 140),
    ('chef de service', 'interne', 160),
    ('autre', 'interne', 180),
    ('directeur', 'externe', 140),
    ('chef de division/service', 'externe', 160),
    ('agent', 'externe', 180),
    ('retraité', 'externe', 200);

-- Signataires (CORRIGÉ)
INSERT OR IGNORE INTO signataires (nom, prenom, grade, fonction, titre, ordre_signature, actif) VALUES
    ('BELEM', 'Abdoulaye', 'Commissaire Divisionnaire de Police', 'Directeur Général', 'Directeur Général', 1, 1),
    ('SINDE', 'Salif', 'Commissaire Divisionnaire de Police', 'Directeur de l''Administration des Finances', 'Directeur Administratif et Financier', 2, 1);

-- Entête (paramètres généraux) - logo en base64 vide au départ
INSERT OR IGNORE INTO entete (cle, valeur) VALUES
    ('nom_etablissement', 'ECOLE NATIONALE DE POLICE'),
    ('sigle', 'ENP'),
    ('logo', ''),  -- Base64 du logo (vide au départ)
    ('adresse', '01 BP 1234 OUAGADOUGOU 01'),
    ('telephone', '25 36 11 11'),
    ('email', 'enp@police.bf'),
    ('directeur_nom', ''),
    ('directeur_titre', ''),
    ('directeur_fonction', ''),
    ('comptable_nom', ''),
    ('comptable_titre', ''),
    ('comptable_fonction', ''),
    ('signataire_defaut', '');

-- =====================================================
-- FIN
-- =====================================================
PRAGMA integrity_check;
ANALYZE;