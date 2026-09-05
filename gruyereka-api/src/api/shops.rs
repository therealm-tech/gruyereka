use aide::axum::ApiRouter;
use aide::axum::routing::get_with;
use aide::transform::TransformOperation;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::api::auth::AuthUser;
use crate::api::error::{ApiError, Result, map_repository_error};
use crate::api::pagination::{PageResponse, PaginationQuery};
use crate::api::state::AppState;
use crate::domain::shop::{NewShop, OsmElement, OsmRef, Shop, ShopKind, ShopSummary};

/// Where the shop is on OpenStreetMap. The client resolves it against Nominatim
/// before posting; the API treats it as an opaque identity key.
#[derive(Debug, Clone, Copy, Deserialize, Serialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct OsmReferenceDto {
    pub element: OsmElement,
    #[validate(range(min = 1))]
    pub id: i64,
}

impl From<OsmReferenceDto> for OsmRef {
    fn from(dto: OsmReferenceDto) -> Self {
        Self {
            element: dto.element,
            id: dto.id,
        }
    }
}

impl From<OsmRef> for OsmReferenceDto {
    fn from(reference: OsmRef) -> Self {
        Self {
            element: reference.element,
            id: reference.id,
        }
    }
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
#[schemars(extend("example" = serde_json::json!({
    "name": "Fromagerie Beaufils",
    "kind": "CHEESEMONGER",
    "osm": {"element": "NODE", "id": 1_234_567_890_i64},
    "street": "118 rue Vieille du Temple",
    "postalCode": "75003",
    "city": "Paris",
    "countryCode": "FR",
    "latitude": 48.8617,
    "longitude": 2.3626
})))]
pub struct CreateShopRequest {
    #[validate(length(min = 1, max = 160))]
    pub name: String,
    pub kind: ShopKind,
    #[validate(nested)]
    pub osm: OsmReferenceDto,
    #[validate(length(min = 1, max = 200))]
    pub street: Option<String>,
    #[validate(length(min = 1, max = 20))]
    pub postal_code: Option<String>,
    #[validate(length(min = 1, max = 120))]
    pub city: String,
    /// ISO 3166-1 alpha-2, upper case.
    #[validate(custom(function = validate_country_code))]
    pub country_code: String,
    #[validate(range(min = -90.0, max = 90.0))]
    pub latitude: f64,
    #[validate(range(min = -180.0, max = 180.0))]
    pub longitude: f64,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ShopResponse {
    pub id: Uuid,
    pub name: String,
    pub kind: ShopKind,
    pub osm: OsmReferenceDto,
    pub street: Option<String>,
    pub postal_code: Option<String>,
    pub city: String,
    pub country_code: String,
    pub latitude: f64,
    pub longitude: f64,
    pub review_count: i64,
    /// Mean of the reviews, out of 5.
    pub average_score: Option<f64>,
    pub created_by_user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ShopResponse {
    fn from_parts(shop: Shop, review_count: i64, average_score: Option<f64>) -> Self {
        Self {
            id: shop.id,
            name: shop.name,
            kind: shop.kind,
            osm: shop.osm_ref.into(),
            street: shop.street,
            postal_code: shop.postal_code,
            city: shop.city,
            country_code: shop.country_code,
            latitude: shop.latitude,
            longitude: shop.longitude,
            review_count,
            average_score,
            created_by_user_id: shop.created_by,
            created_at: shop.created_at,
            updated_at: shop.updated_at,
        }
    }
}

impl From<ShopSummary> for ShopResponse {
    fn from(summary: ShopSummary) -> Self {
        Self::from_parts(summary.shop, summary.review_count, summary.average_score)
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ShopPath {
    pub shop_id: Uuid,
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ListShopsQuery {
    #[validate(length(min = 1, max = 160))]
    pub search: Option<String>,
    #[validate(length(min = 1, max = 120))]
    pub city: Option<String>,
    #[serde(flatten)]
    #[validate(nested)]
    pub pagination: PaginationQuery,
}

fn validate_country_code(code: &str) -> std::result::Result<(), validator::ValidationError> {
    if code.len() == 2 && code.bytes().all(|byte| byte.is_ascii_uppercase()) {
        return Ok(());
    }
    Err(validator::ValidationError::new("country_code"))
}

pub fn routes() -> ApiRouter<AppState> {
    ApiRouter::new()
        .api_route(
            "/shops",
            get_with(list, list_docs).post_with(create, create_docs),
        )
        .api_route("/shops/{shop_id}", get_with(show, show_docs))
}

async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListShopsQuery>,
) -> Result<Json<PageResponse<ShopResponse>>> {
    query.validate()?;
    let page = state
        .shops
        .list(
            query.search.as_deref(),
            query.city.as_deref(),
            query.pagination.to_page(),
        )
        .await?;
    Ok(Json(PageResponse::new(&query.pagination, page, Into::into)))
}

async fn create(
    State(state): State<AppState>,
    caller: AuthUser,
    Json(body): Json<CreateShopRequest>,
) -> Result<(StatusCode, Json<ShopResponse>)> {
    body.validate()?;
    let shop = state
        .shops
        .create(NewShop {
            name: body.name,
            kind: body.kind,
            osm_ref: body.osm.into(),
            street: body.street,
            postal_code: body.postal_code,
            city: body.city,
            country_code: body.country_code,
            latitude: body.latitude,
            longitude: body.longitude,
            created_by: caller.id,
        })
        .await
        .map_err(|error| map_repository_error(error, "shop", "user"))?;
    tracing::info!(shop_id = %shop.id, name = %shop.name, "shop created");
    Ok((
        StatusCode::CREATED,
        Json(ShopResponse::from_parts(shop, 0, None)),
    ))
}

async fn show(
    State(state): State<AppState>,
    Path(path): Path<ShopPath>,
) -> Result<Json<ShopResponse>> {
    let summary = state
        .shops
        .summary(path.shop_id)
        .await?
        .ok_or(ApiError::NotFound("shop"))?;
    Ok(Json(summary.into()))
}

fn list_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Shops")
        .summary("List shops with their aggregated review score")
}

fn create_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Shops")
        .summary("Create a shop")
        .description(
            "A shop is identified by its OpenStreetMap reference, which the client \
             resolves beforehand; posting a reference that already exists is a conflict.",
        )
        .security_requirement("BearerAuth")
        .response::<201, Json<ShopResponse>>()
}

fn show_docs(operation: TransformOperation) -> TransformOperation {
    operation.tag("Shops").summary("Describe one shop")
}
