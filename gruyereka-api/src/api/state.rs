use std::sync::Arc;

use jsonwebtoken::{DecodingKey, EncodingKey};

use crate::photo::PhotoStore;
use crate::repository::cheese::CheeseRepository;
use crate::repository::shop::ShopRepository;
use crate::repository::shop_review::ShopReviewRepository;
use crate::repository::tasting::TastingRepository;
use crate::repository::user::UserRepository;

/// Signing material for the access tokens. Held behind an `Arc` because
/// `jsonwebtoken`'s keys are not `Clone` and the state is cloned per request.
#[derive(Debug)]
pub struct TokenConfig {
    pub encoding: EncodingKey,
    pub decoding: DecodingKey,
    pub ttl_minutes: u32,
}

#[derive(Clone)]
pub struct AppState {
    pub users: UserRepository,
    pub cheeses: CheeseRepository,
    pub shops: ShopRepository,
    pub tastings: TastingRepository,
    pub shop_reviews: ShopReviewRepository,
    pub photos: PhotoStore,
    pub tokens: Arc<TokenConfig>,
}
