use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Wire representation of the closed vocabularies is a stable `SCREAMING_SNAKE`
/// code, never a label: the French wording lives in the clients' translation
/// bundles. See `ARCHITECTURE.md`.
#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
    sqlx::Type,
    Serialize,
    Deserialize,
    JsonSchema,
)]
#[sqlx(type_name = "milk_type", rename_all = "snake_case")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MilkType {
    Cow,
    Goat,
    Sheep,
    Buffalo,
}

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, sqlx::Type, Serialize, Deserialize, JsonSchema,
)]
#[sqlx(type_name = "paste_type", rename_all = "snake_case")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PasteType {
    Fresh,
    SoftBloomyRind,
    SoftWashedRind,
    PressedUncooked,
    PressedCooked,
    BlueVeined,
    StretchedCurd,
    Processed,
}

/// European quality scheme. `Aoc` is kept alongside `Aop` because the Swiss AOC
/// still exists and the pre-2012 French AOC still shows up on labels.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, sqlx::Type, Serialize, Deserialize, JsonSchema,
)]
#[sqlx(type_name = "protected_designation", rename_all = "snake_case")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProtectedDesignation {
    Aop,
    Aoc,
    Igp,
    Stg,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Cheese {
    pub id: Uuid,
    pub name: String,
    pub milk_types: Vec<MilkType>,
    pub paste_type: PasteType,
    pub designation: Option<ProtectedDesignation>,
    pub aging_months: Option<i32>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewCheese {
    pub name: String,
    pub milk_types: Vec<MilkType>,
    pub paste_type: PasteType,
    pub designation: Option<ProtectedDesignation>,
    pub aging_months: Option<i32>,
    pub created_by: Uuid,
}

/// A cheese and the tastings recorded against it, all shops taken together.
#[derive(Debug, Clone)]
pub struct CheeseSummary {
    pub cheese: Cheese,
    pub tasting_count: i64,
    pub average_score: Option<f64>,
}

/// Identity key of a cheese: the name stripped of everything that makes two
/// spellings of the same word differ. Paired with the milk set, the paste and
/// the aging, this is what the `cheeses_identity_key` unique index enforces, so
/// every write path must go through it or the index stops meaning anything.
pub fn normalize_name(name: &str) -> String {
    let ascii = deunicode::deunicode(name).to_lowercase();
    ascii
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::normalize_name;

    #[test]
    fn folds_accents_case_and_separators() {
        assert_eq!(normalize_name("Comté"), "comte");
        assert_eq!(normalize_name("  SAINT-NECTAIRE  "), "saint nectaire");
        assert_eq!(normalize_name("Saint Nectaire"), "saint nectaire");
        assert_eq!(normalize_name("Brie de Meaux"), "brie de meaux");
    }

    #[test]
    fn collapses_punctuation_and_repeated_separators() {
        assert_eq!(normalize_name("Bleu d'Auvergne"), "bleu d auvergne");
        assert_eq!(normalize_name("Tomme   de   Savoie"), "tomme de savoie");
    }
}
