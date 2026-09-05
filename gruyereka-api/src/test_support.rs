use std::sync::Arc;
use std::time::Duration;

use aws_config::BehaviorVersion;
use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use jsonwebtoken::{DecodingKey, EncodingKey};
use serde_json::Value;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use crate::api::state::{AppState, TokenConfig};
use crate::domain::cheese::{MilkType, NewCheese, PasteType};
use crate::domain::shop::{NewShop, OsmElement, OsmRef, ShopKind};
use crate::domain::user::{NewUser, UserRole};
use crate::photo::PhotoStore;
use crate::repository::cheese::CheeseRepository;
use crate::repository::shop::ShopRepository;
use crate::repository::shop_review::ShopReviewRepository;
use crate::repository::tasting::TastingRepository;
use crate::repository::user::UserRepository;

pub fn state(pool: PgPool) -> AppState {
    // The S3 client is built but never reached: no test exercises the photo
    // routes, so no bucket has to exist for the rest of the API to be testable.
    let config = aws_sdk_s3::config::Builder::default()
        .behavior_version(BehaviorVersion::latest())
        .region(aws_config::Region::new("us-east-1"))
        .build();
    AppState {
        users: UserRepository::new(pool.clone()),
        cheeses: CheeseRepository::new(pool.clone()),
        shops: ShopRepository::new(pool.clone()),
        tastings: TastingRepository::new(pool.clone()),
        shop_reviews: ShopReviewRepository::new(pool),
        photos: PhotoStore::new(
            aws_sdk_s3::Client::from_conf(config),
            "test-bucket".to_owned(),
            Duration::from_secs(60),
        ),
        tokens: Arc::new(TokenConfig {
            encoding: EncodingKey::from_secret(b"test-secret"),
            decoding: DecodingKey::from_secret(b"test-secret"),
            ttl_minutes: 60,
        }),
    }
}

pub fn router(pool: PgPool) -> Router {
    crate::api::build(state(pool), &[]).expect("router builds")
}

pub struct Response {
    pub status: StatusCode,
    pub body: Value,
}

pub async fn call(router: &Router, request: Request<Body>) -> Response {
    let response = router
        .clone()
        .oneshot(request)
        .await
        .expect("the router answers");
    let status = response.status();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("the body reads")
        .to_bytes();
    let body = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(Value::Null)
    };
    Response { status, body }
}

pub fn json_request(method: &str, uri: &str, token: Option<&str>, body: &Value) -> Request<Body> {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json");
    if let Some(token) = token {
        builder = builder.header("authorization", format!("Bearer {token}"));
    }
    builder
        .body(Body::from(body.to_string()))
        .expect("the request builds")
}

pub fn get_request(uri: &str) -> Request<Body> {
    Request::builder()
        .method("GET")
        .uri(uri)
        .body(Body::empty())
        .expect("the request builds")
}

pub async fn a_user(pool: &PgPool) -> Uuid {
    let email = format!("{}@example.org", Uuid::now_v7());
    UserRepository::new(pool.clone())
        .create(NewUser {
            email,
            display_name: "Camille".to_owned(),
            password_hash: "not-a-real-hash".to_owned(),
        })
        .await
        .expect("the user is created")
        .id
}

pub async fn promote(pool: &PgPool, user_id: Uuid, role: UserRole) {
    UserRepository::new(pool.clone())
        .set_role(user_id, role)
        .await
        .expect("the role is set");
}

pub async fn a_cheese(pool: &PgPool, author: Uuid, name: &str) -> Uuid {
    CheeseRepository::new(pool.clone())
        .create(NewCheese {
            name: name.to_owned(),
            milk_types: vec![MilkType::Cow],
            paste_type: PasteType::PressedCooked,
            designation: None,
            aging_months: None,
            created_by: author,
        })
        .await
        .expect("the cheese is created")
        .id
}

pub async fn a_shop(pool: &PgPool, author: Uuid, osm_id: i64) -> Uuid {
    ShopRepository::new(pool.clone())
        .create(NewShop {
            name: "Fromagerie d'essai".to_owned(),
            kind: ShopKind::Cheesemonger,
            osm_ref: OsmRef {
                element: OsmElement::Node,
                id: osm_id,
            },
            street: None,
            postal_code: None,
            city: "Paris".to_owned(),
            country_code: "FR".to_owned(),
            latitude: 48.86,
            longitude: 2.36,
            created_by: author,
        })
        .await
        .expect("the shop is created")
        .id
}
