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

/// One cheese inside a visit. The rating and the price live here rather than on
/// the tasting: a basket holds several cheeses and averaging them together
/// would let a good one carry a mediocre one.
#[derive(Debug, Clone)]
pub struct TastingItem {
    pub id: Uuid,
    pub cheese_id: Uuid,
    pub rating: RatingLevel,
    pub price_per_kg: Option<PricePerKg>,
    pub comment: Option<String>,
}

/// A picture taken during a visit. The image lives in the object store under
/// `object_key`; the row only says which visit it belongs to.
#[derive(Debug, Clone)]
pub struct TastingPhoto {
    pub id: Uuid,
    pub tasting_id: Uuid,
    pub object_key: String,
}

/// One visit: one person, one shop, one day, and everything tasted then.
#[derive(Debug, Clone)]
pub struct Tasting {
    pub id: Uuid,
    pub user_id: Uuid,
    pub shop_id: Uuid,
    pub tasted_on: NaiveDate,
    /// Never empty — a visit with nothing tasted is not a record of anything.
    pub items: Vec<TastingItem>,
    /// Oldest first.
    pub photos: Vec<TastingPhoto>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewTastingItem {
    pub cheese_id: Uuid,
    pub rating: RatingLevel,
    pub price_per_kg: Option<PricePerKg>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone)]
pub struct NewTasting {
    pub user_id: Uuid,
    pub shop_id: Uuid,
    pub tasted_on: NaiveDate,
    pub items: Vec<NewTastingItem>,
}

/// A correction replaces the whole set of items: the shop and the author are
/// fixed at creation, everything else is rewritten in one go.
#[derive(Debug, Clone)]
pub struct TastingUpdate {
    pub tasted_on: NaiveDate,
    pub items: Vec<NewTastingItem>,
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
