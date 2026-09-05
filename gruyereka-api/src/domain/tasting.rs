use chrono::{DateTime, NaiveDate, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The five levels, ordered from worst to best. The ordinal used for averages is
/// `rating_score()` in the database, so ordering is defined in one place only.
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
#[sqlx(type_name = "rating_level", rename_all = "snake_case")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RatingLevel {
    Inedible,
    Poor,
    Meh,
    Good,
    Delicious,
}

/// A price per kilogram, in the minor unit of `currency` (ISO 4217 alphabetic).
/// Integer on purpose: money in a float is a rounding bug waiting for a report.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PricePerKg {
    pub cents: i64,
    pub currency: String,
}

#[derive(Debug, Clone)]
pub struct Tasting {
    pub id: Uuid,
    pub user_id: Uuid,
    pub cheese_id: Uuid,
    pub shop_id: Uuid,
    pub rating: RatingLevel,
    pub price_per_kg: Option<PricePerKg>,
    pub comment: Option<String>,
    pub tasted_on: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewTasting {
    pub user_id: Uuid,
    pub cheese_id: Uuid,
    pub shop_id: Uuid,
    pub rating: RatingLevel,
    pub price_per_kg: Option<PricePerKg>,
    pub comment: Option<String>,
    pub tasted_on: NaiveDate,
}

#[derive(Debug, Clone)]
pub struct TastingUpdate {
    pub rating: RatingLevel,
    pub price_per_kg: Option<PricePerKg>,
    pub comment: Option<String>,
    pub tasted_on: NaiveDate,
}

/// Filters a tasting listing can be narrowed with. All optional and combinable.
// Every field really is a foreign key here; a shorter name would say less.
#[allow(clippy::struct_field_names)]
#[derive(Debug, Clone, Default)]
pub struct TastingFilter {
    pub cheese_id: Option<Uuid>,
    pub shop_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
}
