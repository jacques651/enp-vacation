// src-tauri/src/commands/mod.rs

// =========================
// 📦 DOMAINES MÉTIER (PÉDAGOGIE)
// =========================

pub mod cycles;
pub mod modules;
pub mod matieres;

// =========================
// 👨‍🏫 RESSOURCES HUMAINES
// =========================

pub mod enseignants;
pub mod banques;

// =========================
// 🎓 STRUCTURE ACADÉMIQUE
// =========================

pub mod promotions;
pub mod annees_scolaires; // ✅ AJOUT IMPORTANT
pub mod plafonds;

// =========================
// 🧾 VACATIONS (COEUR MÉTIER)
// =========================

pub mod vacation_secure;

// =========================
// 💰 FINANCE & DOCUMENTS
// =========================

pub mod ordres_virement;
pub mod etat_liquidation;

// =========================
// 📊 ANALYTICS
// =========================

pub mod dashboard;

// =========================
// ⚙️ CONFIGURATION
// =========================

pub mod signataires;
pub mod entete;

// =========================
// 🔧 OUTILS
// =========================

pub mod imports;
pub mod utils;

pub mod comptes_bancaires;
// =========================
// 🔁 EXPORT GLOBAL DES COMMANDES
// =========================

// pédagogie
pub use cycles::*;
pub use modules::*;
pub use matieres::*;

// RH
pub use enseignants::*;
pub use banques::*;

// académique
pub use promotions::*;
pub use annees_scolaires::*; // ✅ AJOUT IMPORTANT
pub use plafonds::*;

// coeur métier
pub use vacation_secure::*;

// finance
pub use ordres_virement::*;
pub use etat_liquidation::*;

// analytics
pub use dashboard::*;

// config
pub use signataires::*;
pub use entete::*;

// outils
pub use imports::*;
pub use utils::*;

pub use comptes_bancaires::*;