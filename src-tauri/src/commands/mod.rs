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
pub mod comptes_bancaires;

// =========================
// 🎓 STRUCTURE ACADÉMIQUE
// =========================

pub mod promotions;
pub mod annees_scolaires;
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

// =========================
// 🔁 EXPORT GLOBAL DES COMMANDES
// =========================

// Pédagogie
pub use cycles::*;
pub use modules::*;
pub use matieres::*;

// RH
pub use enseignants::*;
pub use banques::*;
pub use comptes_bancaires::*;

// Académique
pub use promotions::*;
pub use annees_scolaires::*;
pub use plafonds::*;

// Cœur métier
pub use vacation_secure::*;

// Finance
pub use ordres_virement::*;
pub use etat_liquidation::*;

// Analytics
pub use dashboard::*;

// Configuration
pub use signataires::*;
pub use entete::*;

// Outils
pub use imports::*;
pub use utils::*;