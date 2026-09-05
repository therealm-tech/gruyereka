use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ShopReview {
    pub id: Uuid,
    pub user_id: Uuid,
    pub shop_id: Uuid,
    pub score: i16,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A review is unique per (user, shop): submitting again replaces the previous
/// one rather than stacking, unlike a tasting which is a dated log entry.
#[derive(Debug, Clone)]
pub struct NewShopReview {
    pub user_id: Uuid,
    pub shop_id: Uuid,
    pub score: i16,
    pub comment: Option<String>,
}
