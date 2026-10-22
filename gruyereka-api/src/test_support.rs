use std::sync::{Arc, Mutex};
use std::time::Duration;

use aws_config::BehaviorVersion;
use aws_sdk_s3::config::Credentials;
use aws_smithy_http_client::test_util::infallible_client_fn;
use axum::Router;
use axum::body::Body;
use axum::http::{HeaderMap, Request, StatusCode};
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

/// Every call the S3 client made, as `METHOD key`, in order.
#[derive(Debug, Clone, Default)]
pub struct StorageLog(Arc<Mutex<Vec<String>>>);

impl StorageLog {
    pub fn requests(&self) -> Vec<String> {
        self.0.lock().expect("the log is not poisoned").clone()
    }
}

/// The real S3 client, with its HTTP layer swapped for one that answers every
/// call with an empty `200` and notes it: the photo routes run end to end with
/// no bucket behind them. Pre-signing is local and needs no answer at all.
fn photo_store(log: StorageLog) -> PhotoStore {
    let http_client = infallible_client_fn(move |request| {
        log.0.lock().expect("the log is not poisoned").push(format!(
            "{} {}",
            request.method(),
            request.uri().path().trim_start_matches('/')
        ));
        axum::http::Response::builder()
            .status(200)
            .body("")
            .expect("the response builds")
    });
    let config = aws_sdk_s3::config::Builder::default()
        .behavior_version(BehaviorVersion::latest())
        .region(aws_config::Region::new("us-east-1"))
        .credentials_provider(Credentials::new("test", "test", None, None, "tests"))
        .http_client(http_client)
        .build();
    PhotoStore::new(
        aws_sdk_s3::Client::from_conf(config),
        "test-bucket".to_owned(),
        Duration::from_secs(60),
    )
}

pub fn state(pool: PgPool, storage: StorageLog) -> AppState {
    AppState {
        users: UserRepository::new(pool.clone()),
        cheeses: CheeseRepository::new(pool.clone()),
        shops: ShopRepository::new(pool.clone()),
        tastings: TastingRepository::new(pool.clone()),
        shop_reviews: ShopReviewRepository::new(pool),
        photos: photo_store(storage),
        tokens: Arc::new(TokenConfig {
            encoding: EncodingKey::from_secret(b"test-secret"),
            decoding: DecodingKey::from_secret(b"test-secret"),
            ttl_minutes: 60,
        }),
    }
}

pub fn router(pool: PgPool) -> Router {
    router_with_storage(pool).0
}

pub fn router_with_storage(pool: PgPool) -> (Router, StorageLog) {
    let storage = StorageLog::default();
    let router = crate::api::build(state(pool, storage.clone()), &[]).expect("router builds");
    (router, storage)
}

pub struct Response {
    pub status: StatusCode,
    pub headers: HeaderMap,
    pub body: Value,
}

pub async fn call(router: &Router, request: Request<Body>) -> Response {
    let response = router
        .clone()
        .oneshot(request)
        .await
        .expect("the router answers");
    let status = response.status();
    let headers = response.headers().clone();
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
    Response {
        status,
        headers,
        body,
    }
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

/// One `multipart/form-data` file field, the shape the photo upload takes.
pub fn file_request(
    uri: &str,
    token: Option<&str>,
    content_type: &str,
    bytes: &[u8],
) -> Request<Body> {
    const BOUNDARY: &str = "gruyereka-test-boundary";
    let mut body = format!(
        "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"photo\"; \
         filename=\"photo\"\r\nContent-Type: {content_type}\r\n\r\n"
    )
    .into_bytes();
    body.extend_from_slice(bytes);
    body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());

    let mut builder = Request::builder().method("POST").uri(uri).header(
        "content-type",
        format!("multipart/form-data; boundary={BOUNDARY}"),
    );
    if let Some(token) = token {
        builder = builder.header("authorization", format!("Bearer {token}"));
    }
    builder.body(Body::from(body)).expect("the request builds")
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
