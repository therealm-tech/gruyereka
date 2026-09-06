pub mod auth;
pub mod cheeses;
pub mod docs;
pub mod error;
pub mod pagination;
pub mod shop_reviews;
pub mod shops;
pub mod state;
pub mod tastings;
pub mod users;

use std::sync::Arc;

use aide::axum::ApiRouter;
use aide::openapi::{OpenApi, SecurityScheme, Tag};
use aide::transform::TransformOpenApi;
use axum::http::{HeaderValue, Method, StatusCode, header};
use axum::routing::get;
use axum::{Extension, Router};
use indexmap::IndexMap;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::api::state::AppState;

/// Everything the product exposes lives under this prefix; the probe and the
/// documentation sit outside it and outside the `OpenAPI` document.
const API_PREFIX: &str = "/api/v1";

pub fn build(state: AppState, allowed_origins: &[String]) -> Result<Router, BuildError> {
    aide::generate::extract_schemas(true);

    let api_routes = ApiRouter::new()
        .merge(users::routes())
        .merge(cheeses::routes())
        .merge(shops::routes())
        .merge(shop_reviews::routes())
        .merge(tastings::routes());

    let mut api = OpenApi::default();
    let router = ApiRouter::new()
        .nest(API_PREFIX, api_routes)
        .finish_api_with(&mut api, describe)
        .route("/healthz", get(healthz))
        .route("/openapi.json", get(docs::openapi))
        .route("/docs", get(docs::scalar))
        .layer(Extension(Arc::new(api)))
        .layer(TraceLayer::new_for_http())
        .layer(cors(allowed_origins)?)
        .with_state(state);

    Ok(router)
}

#[derive(Debug, thiserror::Error)]
pub enum BuildError {
    #[error("{0} is not a usable CORS origin")]
    InvalidOrigin(String),
}

async fn healthz() -> StatusCode {
    StatusCode::NO_CONTENT
}

fn cors(allowed_origins: &[String]) -> Result<CorsLayer, BuildError> {
    let origins = allowed_origins
        .iter()
        .map(|origin| {
            HeaderValue::from_str(origin).map_err(|_| BuildError::InvalidOrigin(origin.clone()))
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]))
}

fn describe(api: TransformOpenApi) -> TransformOpenApi {
    api.title("Gruyereka")
        .version(env!("CARGO_PKG_VERSION"))
        .description(
            "Cheese tastings and the shops they were bought from.\n\n\
             Closed vocabularies (rating levels, milk types, paste types, quality \
             schemes) travel as stable codes such as `DELICIOUS` or `PRESSED_COOKED`. \
             They are never localised on the wire: clients hold the translations. \
             User-written content — cheese names, shop names, comments — is stored and \
             returned exactly as typed, in whichever language it was typed.",
        )
        .security_scheme(
            "BearerAuth",
            SecurityScheme::Http {
                scheme: "bearer".to_owned(),
                bearer_format: Some("JWT".to_owned()),
                description: Some("Access token returned by the authentication routes.".to_owned()),
                extensions: IndexMap::default(),
            },
        )
        .tag(Tag {
            name: "Authentication".to_owned(),
            description: Some("Accounts and access tokens.".to_owned()),
            ..Tag::default()
        })
        .tag(Tag {
            name: "Users".to_owned(),
            description: Some("Accounts and the roles they hold. Administrators only.".to_owned()),
            ..Tag::default()
        })
        .tag(Tag {
            name: "Cheeses".to_owned(),
            description: Some("The cheeses themselves, independent of any shop.".to_owned()),
            ..Tag::default()
        })
        .tag(Tag {
            name: "Shops".to_owned(),
            description: Some("Where cheese is bought, keyed on OpenStreetMap.".to_owned()),
            ..Tag::default()
        })
        .tag(Tag {
            name: "Tastings".to_owned(),
            description: Some("Dated records of tasting one cheese bought at one shop.".to_owned()),
            ..Tag::default()
        })
        .tag(Tag {
            name: "Shop reviews".to_owned(),
            description: Some("What people think of a shop, out of five.".to_owned()),
            ..Tag::default()
        })
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use serde_json::json;
    use sqlx::PgPool;

    use crate::test_support::{call, get_request, json_request, router};

    async fn register(router: &axum::Router, email: &str) -> String {
        let response = call(
            router,
            json_request(
                "POST",
                "/api/v1/auth/register",
                None,
                &json!({
                    "email": email,
                    "displayName": "Camille",
                    "password": "un-mot-de-passe-long",
                }),
            ),
        )
        .await;
        assert_eq!(response.status, StatusCode::CREATED);
        response.body["accessToken"]
            .as_str()
            .expect("a token comes back")
            .to_owned()
    }

    #[sqlx::test]
    async fn walks_a_cheese_from_creation_to_its_average_score(pool: PgPool) {
        let router = router(pool);
        let token = register(&router, "camille@example.org").await;

        let cheese = call(
            &router,
            json_request(
                "POST",
                "/api/v1/cheeses",
                Some(&token),
                &json!({
                    "name": "Comté",
                    "milkTypes": ["COW"],
                    "pasteType": "PRESSED_COOKED",
                    "designation": "AOP",
                    "agingMonths": 18,
                }),
            ),
        )
        .await;
        assert_eq!(cheese.status, StatusCode::CREATED);
        let cheese_id = cheese.body["id"].as_str().unwrap().to_owned();

        let shop = call(
            &router,
            json_request(
                "POST",
                "/api/v1/shops",
                Some(&token),
                &json!({
                    "name": "Fromagerie Beaufils",
                    "kind": "CHEESEMONGER",
                    "osm": {"element": "NODE", "id": 1_234_567_890_i64},
                    "city": "Paris",
                    "countryCode": "FR",
                    "latitude": 48.8617,
                    "longitude": 2.3626,
                }),
            ),
        )
        .await;
        assert_eq!(shop.status, StatusCode::CREATED);
        let shop_id = shop.body["id"].as_str().unwrap().to_owned();

        let tasting = call(
            &router,
            json_request(
                "POST",
                "/api/v1/tastings",
                Some(&token),
                &json!({
                    "shopId": shop_id,
                    "tastedOn": "2026-09-05",
                    "items": [{
                        "cheeseId": cheese_id,
                        "rating": "DELICIOUS",
                        "pricePerKg": {"amountCents": 3450, "currency": "EUR"},
                    }],
                }),
            ),
        )
        .await;
        assert_eq!(tasting.status, StatusCode::CREATED);

        let refreshed = call(
            &router,
            get_request(&format!("/api/v1/cheeses/{cheese_id}")),
        )
        .await;
        assert_eq!(refreshed.status, StatusCode::OK);
        assert_eq!(refreshed.body["tastingCount"], 1);
        assert_eq!(refreshed.body["averageScore"], 5.0);
        assert!(refreshed.body["photoUrl"].is_null());
    }

    #[sqlx::test]
    async fn scores_each_cheese_of_one_visit_on_its_own(pool: PgPool) {
        let router = router(pool);
        let token = register(&router, "camille@example.org").await;

        let cheese = |name: &str, paste: &str| json!({"name": name, "milkTypes": ["COW"], "pasteType": paste});
        let make = async |body| {
            let response = call(
                &router,
                json_request("POST", "/api/v1/cheeses", Some(&token), &body),
            )
            .await;
            assert_eq!(response.status, StatusCode::CREATED);
            response.body["id"].as_str().unwrap().to_owned()
        };
        let comte = make(cheese("Comté", "PRESSED_COOKED")).await;
        let brie = make(cheese("Brie", "SOFT_BLOOMY_RIND")).await;

        let shop = call(
            &router,
            json_request(
                "POST",
                "/api/v1/shops",
                Some(&token),
                &json!({"name": "Fromagerie Beaufils", "kind": "CHEESEMONGER",
                        "osm": {"element": "NODE", "id": 4_242_424_242_i64},
                        "city": "Paris", "countryCode": "FR",
                        "latitude": 48.8617, "longitude": 2.3626}),
            ),
        )
        .await;
        assert_eq!(shop.status, StatusCode::CREATED);

        let visit = call(
            &router,
            json_request(
                "POST",
                "/api/v1/tastings",
                Some(&token),
                &json!({
                    "shopId": shop.body["id"],
                    "tastedOn": "2026-09-05",
                    "items": [
                        {"cheeseId": comte, "rating": "DELICIOUS",
                         "pricePerKg": {"amountCents": 3450, "currency": "EUR"}},
                        {"cheeseId": brie, "rating": "MEH"},
                    ],
                }),
            ),
        )
        .await;
        assert_eq!(visit.status, StatusCode::CREATED);
        assert_eq!(visit.body["items"].as_array().unwrap().len(), 2);

        // The whole point of the split: one basket, two averages, and the brie
        // does not ride on the comté's score.
        for (id, expected) in [(&comte, 5.0), (&brie, 3.0)] {
            let fiche = call(&router, get_request(&format!("/api/v1/cheeses/{id}"))).await;
            assert_eq!(fiche.status, StatusCode::OK);
            assert_eq!(fiche.body["tastingCount"], 1);
            assert_eq!(fiche.body["averageScore"], expected);
        }

        // And each cheese finds the visit, whole, from its own side.
        let listed = call(
            &router,
            get_request(&format!("/api/v1/tastings?cheeseId={brie}")),
        )
        .await;
        assert_eq!(listed.body["total"], 1);
        assert_eq!(
            listed.body["items"][0]["items"].as_array().unwrap().len(),
            2
        );
    }

    #[sqlx::test]
    async fn refuses_a_visit_that_tasted_nothing(pool: PgPool) {
        let router = router(pool);
        let token = register(&router, "camille@example.org").await;
        let shop = call(
            &router,
            json_request(
                "POST",
                "/api/v1/shops",
                Some(&token),
                &json!({"name": "Fromagerie", "kind": "CHEESEMONGER",
                        "osm": {"element": "NODE", "id": 5_151_515_151_i64},
                        "city": "Paris", "countryCode": "FR",
                        "latitude": 48.86, "longitude": 2.36}),
            ),
        )
        .await;

        let empty = call(
            &router,
            json_request(
                "POST",
                "/api/v1/tastings",
                Some(&token),
                &json!({"shopId": shop.body["id"], "tastedOn": "2026-09-05", "items": []}),
            ),
        )
        .await;

        assert_eq!(empty.status, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(empty.body["fields"]["items"][0], "basket_empty");
    }

    #[sqlx::test]
    async fn turns_the_cheese_identity_index_into_a_conflict(pool: PgPool) {
        let router = router(pool);
        let token = register(&router, "camille@example.org").await;
        let body = json!({
            "name": "Comté",
            "milkTypes": ["COW"],
            "pasteType": "PRESSED_COOKED",
        });

        call(
            &router,
            json_request("POST", "/api/v1/cheeses", Some(&token), &body),
        )
        .await;
        let again = call(
            &router,
            json_request("POST", "/api/v1/cheeses", Some(&token), &body),
        )
        .await;

        assert_eq!(again.status, StatusCode::CONFLICT);
        assert_eq!(again.body["code"], "CONFLICT");
    }

    #[sqlx::test]
    async fn walks_the_pages_of_a_listing(pool: PgPool) {
        let router = router(pool);
        let token = register(&router, "camille@example.org").await;
        for name in ["Comté", "Beaufort", "Morbier"] {
            let created = call(
                &router,
                json_request(
                    "POST",
                    "/api/v1/cheeses",
                    Some(&token),
                    &json!({"name": name, "milkTypes": ["COW"], "pasteType": "PRESSED_COOKED"}),
                ),
            )
            .await;
            assert_eq!(created.status, StatusCode::CREATED);
        }

        let first = call(&router, get_request("/api/v1/cheeses?page=1&perPage=2")).await;
        let second = call(&router, get_request("/api/v1/cheeses?page=2&perPage=2")).await;
        let refused = call(&router, get_request("/api/v1/cheeses?perPage=101")).await;

        assert_eq!(first.status, StatusCode::OK);
        assert_eq!(first.body["total"], 3);
        assert_eq!(first.body["perPage"], 2);
        assert_eq!(first.body["items"].as_array().unwrap().len(), 2);
        assert_eq!(second.status, StatusCode::OK);
        assert_eq!(second.body["page"], 2);
        assert_eq!(second.body["items"].as_array().unwrap().len(), 1);
        assert_eq!(
            refused.status,
            StatusCode::UNPROCESSABLE_ENTITY,
            "a page size above the ceiling is rejected, not clamped"
        );
    }

    #[sqlx::test]
    async fn refuses_an_unauthenticated_write(pool: PgPool) {
        let router = router(pool);

        let response = call(
            &router,
            json_request(
                "POST",
                "/api/v1/cheeses",
                None,
                &json!({"name": "Comté", "milkTypes": ["COW"], "pasteType": "PRESSED_COOKED"}),
            ),
        )
        .await;

        assert_eq!(response.status, StatusCode::UNAUTHORIZED);
        assert_eq!(response.body["code"], "UNAUTHENTICATED");
    }

    #[sqlx::test]
    async fn names_the_fields_that_failed_validation(pool: PgPool) {
        let router = router(pool);

        let response = call(
            &router,
            json_request(
                "POST",
                "/api/v1/auth/register",
                None,
                &json!({"email": "pas-une-adresse", "displayName": "", "password": "court"}),
            ),
        )
        .await;

        assert_eq!(response.status, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(response.body["code"], "VALIDATION_FAILED");
        let fields = response.body["fields"].as_object().unwrap();
        assert!(fields.contains_key("email"));
        assert!(fields.contains_key("password"));
        assert!(fields.contains_key("displayName"));
    }

    #[sqlx::test]
    async fn tells_an_unknown_login_from_a_wrong_password_in_no_way(pool: PgPool) {
        let router = router(pool);
        register(&router, "camille@example.org").await;

        let wrong_password = call(
            &router,
            json_request(
                "POST",
                "/api/v1/auth/login",
                None,
                &json!({"email": "camille@example.org", "password": "un-autre-mot-de-passe"}),
            ),
        )
        .await;
        let unknown_email = call(
            &router,
            json_request(
                "POST",
                "/api/v1/auth/login",
                None,
                &json!({"email": "inconnu@example.org", "password": "un-mot-de-passe-long"}),
            ),
        )
        .await;

        assert_eq!(wrong_password.status, StatusCode::UNAUTHORIZED);
        assert_eq!(wrong_password.body, unknown_email.body);
    }

    #[sqlx::test]
    async fn keeps_the_probe_out_of_the_documented_surface(pool: PgPool) {
        let router = router(pool);

        let probe = call(&router, get_request("/healthz")).await;
        let document = call(&router, get_request("/openapi.json")).await;

        assert_eq!(probe.status, StatusCode::NO_CONTENT);
        let paths = document.body["paths"].as_object().unwrap();
        assert!(paths.contains_key("/api/v1/cheeses"));
        assert!(!paths.contains_key("/healthz"));
        assert!(
            document.body["components"]["securitySchemes"]["BearerAuth"]["scheme"] == "bearer",
            "protected operations must show a lock in the reference"
        );
    }
}

#[cfg(test)]
mod role_tests {
    use axum::http::StatusCode;
    use serde_json::{Value, json};
    use sqlx::PgPool;
    use uuid::Uuid;

    use crate::domain::user::UserRole;
    use crate::test_support::{call, json_request, promote, router};

    async fn account(router: &axum::Router, email: &str) -> (Uuid, String) {
        let response = call(
            router,
            json_request(
                "POST",
                "/api/v1/auth/register",
                None,
                &json!({"email": email, "displayName": "Camille",
                        "password": "un-mot-de-passe-long"}),
            ),
        )
        .await;
        assert_eq!(response.status, StatusCode::CREATED);
        (
            response.body["user"]["id"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap(),
            response.body["accessToken"].as_str().unwrap().to_owned(),
        )
    }

    async fn a_tasting(router: &axum::Router, token: &str, osm_id: i64) -> String {
        let cheese = call(
            router,
            json_request(
                "POST",
                "/api/v1/cheeses",
                Some(token),
                &json!({"name": format!("Comté {osm_id}"), "milkTypes": ["COW"],
                        "pasteType": "PRESSED_COOKED"}),
            ),
        )
        .await;
        let shop = call(
            router,
            json_request(
                "POST",
                "/api/v1/shops",
                Some(token),
                &json!({"name": "Fromagerie", "kind": "CHEESEMONGER",
                        "osm": {"element": "NODE", "id": osm_id}, "city": "Paris",
                        "countryCode": "FR", "latitude": 48.86, "longitude": 2.36}),
            ),
        )
        .await;
        let tasting = call(
            router,
            json_request(
                "POST",
                "/api/v1/tastings",
                Some(token),
                &json!({"shopId": shop.body["id"], "tastedOn": "2026-09-05",
                        "items": [{"cheeseId": cheese.body["id"], "rating": "GOOD"}]}),
            ),
        )
        .await;
        assert_eq!(tasting.status, StatusCode::CREATED);
        tasting.body["id"].as_str().unwrap().to_owned()
    }

    #[sqlx::test]
    async fn registers_everybody_as_a_plain_user(pool: PgPool) {
        let router = router(pool);

        let response = call(
            &router,
            json_request(
                "POST",
                "/api/v1/auth/register",
                None,
                &json!({"email": "camille@example.org", "displayName": "Camille",
                        "password": "un-mot-de-passe-long", "role": "ADMIN"}),
            ),
        )
        .await;

        assert_eq!(response.status, StatusCode::CREATED);
        assert_eq!(
            response.body["user"]["role"], "USER",
            "a role in the body must never be honoured"
        );
    }

    #[sqlx::test]
    async fn lets_a_moderator_delete_somebody_elses_tasting(pool: PgPool) {
        let router = router(pool.clone());
        let (_, author) = account(&router, "camille@example.org").await;
        let (stranger_id, stranger) = account(&router, "dominique@example.org").await;
        let tasting = a_tasting(&router, &author, 11).await;
        let path = format!("/api/v1/tastings/{tasting}");

        let as_user = call(
            &router,
            json_request("DELETE", &path, Some(&stranger), &Value::Null),
        )
        .await;
        promote(&pool, stranger_id, UserRole::Moderator).await;
        let as_moderator = call(
            &router,
            json_request("DELETE", &path, Some(&stranger), &Value::Null),
        )
        .await;

        assert_eq!(
            as_user.status,
            StatusCode::NOT_FOUND,
            "a plain user must not even learn the row exists"
        );
        assert_eq!(as_moderator.status, StatusCode::NO_CONTENT);
    }

    #[sqlx::test]
    async fn applies_a_role_change_to_an_already_issued_token(pool: PgPool) {
        let router = router(pool.clone());
        let (author_id, author) = account(&router, "camille@example.org").await;
        let (_, other) = account(&router, "dominique@example.org").await;
        let tasting = a_tasting(&router, &other, 12).await;
        let path = format!("/api/v1/tastings/{tasting}");

        promote(&pool, author_id, UserRole::Moderator).await;
        let granted = call(
            &router,
            json_request("DELETE", &path, Some(&author), &Value::Null),
        )
        .await;
        promote(&pool, author_id, UserRole::User).await;
        let revoked = call(
            &router,
            json_request("DELETE", &path, Some(&author), &Value::Null),
        )
        .await;

        // The token never changed: the role is resolved per request, so both the
        // grant and the demotion land immediately.
        assert_eq!(granted.status, StatusCode::NO_CONTENT);
        assert_eq!(revoked.status, StatusCode::NOT_FOUND);
    }

    #[sqlx::test]
    async fn keeps_role_management_for_administrators(pool: PgPool) {
        let router = router(pool.clone());
        let (admin_id, admin) = account(&router, "camille@example.org").await;
        let (target_id, plain) = account(&router, "dominique@example.org").await;
        let target = format!("/api/v1/users/{target_id}/role");

        let refused = call(
            &router,
            json_request("PUT", &target, Some(&plain), &json!({"role": "ADMIN"})),
        )
        .await;
        promote(&pool, admin_id, UserRole::Admin).await;
        let granted = call(
            &router,
            json_request("PUT", &target, Some(&admin), &json!({"role": "MODERATOR"})),
        )
        .await;
        let own = call(
            &router,
            json_request(
                "PUT",
                &format!("/api/v1/users/{admin_id}/role"),
                Some(&admin),
                &json!({"role": "USER"}),
            ),
        )
        .await;

        assert_eq!(refused.status, StatusCode::FORBIDDEN);
        assert_eq!(refused.body["code"], "FORBIDDEN");
        assert_eq!(granted.status, StatusCode::OK);
        assert_eq!(granted.body["role"], "MODERATOR");
        assert_eq!(
            own.status,
            StatusCode::FORBIDDEN,
            "an instance must not be left without an administrator"
        );
    }

    #[sqlx::test]
    async fn stops_serving_a_token_whose_account_is_gone(pool: PgPool) {
        let router = router(pool.clone());
        let (id, token) = account(&router, "camille@example.org").await;

        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        let response = call(
            &router,
            json_request("GET", "/api/v1/auth/me", Some(&token), &Value::Null),
        )
        .await;

        assert_eq!(response.status, StatusCode::UNAUTHORIZED);
    }
}
