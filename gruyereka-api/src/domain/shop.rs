use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, sqlx::Type, Serialize, Deserialize, JsonSchema,
)]
#[sqlx(type_name = "shop_kind", rename_all = "snake_case")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ShopKind {
    Cheesemonger,
    Market,
    Supermarket,
    Farm,
    Other,
}

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, sqlx::Type, Serialize, Deserialize, JsonSchema,
)]
#[sqlx(type_name = "osm_element", rename_all = "snake_case")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OsmElement {
    Node,
    Way,
    Relation,
}

/// Identity of a shop, resolved by the client against OpenStreetMap. The API
/// never queries Nominatim itself: it trusts the reference and only enforces
/// that two shops cannot share one. See `docs/adr/0002-resolve-shop-identity-against-openstreetmap-in-the-client.md`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct OsmRef {
    pub element: OsmElement,
    pub id: i64,
}

#[derive(Debug, Clone)]
pub struct Shop {
    pub id: Uuid,
    pub name: String,
    pub kind: ShopKind,
    pub osm_ref: OsmRef,
    pub street: Option<String>,
    pub postal_code: Option<String>,
    pub city: String,
    pub country_code: String,
    pub latitude: f64,
    pub longitude: f64,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewShop {
    pub name: String,
    pub kind: ShopKind,
    pub osm_ref: OsmRef,
    pub street: Option<String>,
    pub postal_code: Option<String>,
    pub city: String,
    pub country_code: String,
    pub latitude: f64,
    pub longitude: f64,
    pub created_by: Uuid,
}

/// A shop and the reviews left on it.
#[derive(Debug, Clone)]
pub struct ShopSummary {
    pub shop: Shop,
    pub review_count: i64,
    pub average_score: Option<f64>,
}
