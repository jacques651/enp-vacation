// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;

// IMPORTER TOUTES LES FONCTIONS DES COMMANDES
use commands::*;

use db::DbState;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir().unwrap();
            let db_path = app_dir.join("vacations.db");

            let pool = tauri::async_runtime::block_on(async {
                db::init_db(&db_path)
                    .await
                    .expect("Erreur initialisation DB")
            });

            app.manage(DbState::new(pool));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ================= CYCLES =================
            get_cycles,
            get_cycle_by_id,
            create_cycle,
            update_cycle,
            delete_cycle,
            search_cycles,
            count_cycles,
            get_cycle_by_designation,
            // ================= MODULES =================
            get_modules,
            get_module_by_id,
            create_module,
            update_module,
            delete_module,
            search_modules,
            // ================= MATIERES =================
            get_matieres,
            get_matiere_by_id,
            create_matiere,
            update_matiere,
            delete_matiere,
            search_matieres,
            // ================= ENSEIGNANTS =================
            get_enseignants,
            get_enseignant_by_id,
            create_enseignant,
            update_enseignant,
            delete_enseignant,
            get_enseignants_with_cumul,
            // ================= BANQUES =================
            get_banques,
            get_banque_by_id,
            create_banque,
            update_banque,
            delete_banque,
            // ================= COMPTES BANCAIRES =================
            get_comptes_by_enseignant,
            create_compte_bancaire,
            get_comptes_bancaires,
            get_compte_bancaire_by_id,
            get_comptes_by_enseignant,
            create_compte_bancaire,
            update_compte_bancaire,
            delete_compte_bancaire,
            set_compte_bancaire_actif,
            // ================= PROMOTIONS =================
            get_promotions,
            get_promotion_by_id,
            create_promotion,
            update_promotion,
            delete_promotion,
            search_promotions,
            // ================= ANNEES SCOLAIRES =================
            get_annees_scolaires,
            get_annee_scolaire_by_id,
            create_annee_scolaire,
            update_annee_scolaire,
            delete_annee_scolaire,
            search_annees_scolaires,
            // ================= PLAFONDS =================
            get_plafonds,
            get_plafond_by_id,
            create_plafond,
            update_plafond,
            delete_plafond,
            get_volume_horaire_max,
            // ================= SIGNAIRES =================
            get_signataires,
            get_signataire_by_id,
            create_signataire,
            update_signataire,
            delete_signataire,
            search_signataires,
            get_signataires_actifs,
            // ================= ENTETE (PARAMETRES) =================
            create_entete,
            get_entetes,
            get_entete_by_key,
            get_entete_by_id,
            get_entete_values,
            set_entete_value,
            delete_entete,
            init_default_entetes,
            update_entete,
            // ================= GESTION DU LOGO =================
            upload_logo_base64,
            get_logo_base64,
            delete_logo_base64,
            // ================= VACATIONS =================
            create_vacation,
            get_vacations,
            update_vacation,
            delete_vacation,
            calculate_vacation,
            // ================= ORDRES DE VIREMENT =================
            generer_ordre_virement,
            get_ordres_virement,
            // ================= ETATS DE LIQUIDATION =================
            get_etat_liquidation,
            get_totaux_liquidation,
            // ================= DASHBOARD =================
            get_dashboard_stats,
            // ================= IMPORT =================
            import_cycles,
            import_modules,
            import_matieres,
            import_enseignants,
            import_banques,
            import_promotions,
            import_plafonds,
            import_annees_scolaires,
            import_comptes_bancaires,
            // ================= EXPORT =================
            export_all_data_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
