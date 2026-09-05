use aide::axum::ApiRouter;
use aide::axum::routing::get_with;
use aide::transform::TransformOperation;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use chrono::{DateTime, NaiveDate, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::{Validate, ValidationError};

use crate::api::auth::AuthUser;
use crate::api::error::{ApiError, Result, map_repository_error};
use crate::api::pagination::{PageResponse, PaginationQuery};
use crate::api::state::AppState;
use crate::domain::tasting::{
    NewTasting, PricePerKg, RatingLevel, Tasting, TastingFilter, TastingUpdate,
};

/// A price per kilogram. Integer minor units, because a price in a float is a
/// rounding bug with a delay fuse.
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct PricePerKgDto {
    #[validate(range(min = 1))]
    pub amount_cents: i64,
    /// ISO 4217 alphabetic code, upper case.
    #[validate(custom(function = validate_currency))]
    pub currency: String,
}

impl From<PricePerKgDto> for PricePerKg {
    fn from(dto: PricePerKgDto) -> Self {
        Self {
            cents: dto.amount_cents,
            currency: dto.currency,
        }
    }
}

impl From<PricePerKg> for PricePerKgDto {
    fn from(price: PricePerKg) -> Self {
        Self {
            amount_cents: price.cents,
            currency: price.currency,
        }
    }
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
#[schemars(extend("example" = serde_json::json!({
    "cheeseId": "018f3b2c-0000-7000-8000-000000000001",
    "shopId": "018f3b2c-0000-7000-8000-000000000002",
    "rating": "DELICIOUS",
    "pricePerKg": {"amountCents": 3450, "currency": "EUR"},
    "comment": "Bien fruité, une pointe de cristaux.",
    "tastedOn": "2026-09-05"
})))]
pub struct CreateTastingRequest {
    pub cheese_id: Uuid,
    pub shop_id: Uuid,
    pub rating: RatingLevel,
    #[validate(nested)]
    pub price_per_kg: Option<PricePerKgDto>,
    #[validate(length(min = 1, max = 2000))]
    pub comment: Option<String>,
    pub tasted_on: NaiveDate,
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTastingRequest {
    pub rating: RatingLevel,
    #[validate(nested)]
    pub price_per_kg: Option<PricePerKgDto>,
    #[validate(length(min = 1, max = 2000))]
    pub comment: Option<String>,
    pub tasted_on: NaiveDate,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TastingResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub cheese_id: Uuid,
    pub shop_id: Uuid,
    pub rating: RatingLevel,
    pub price_per_kg: Option<PricePerKgDto>,
    pub comment: Option<String>,
    pub tasted_on: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Tasting> for TastingResponse {
    fn from(tasting: Tasting) -> Self {
        Self {
            id: tasting.id,
            user_id: tasting.user_id,
            cheese_id: tasting.cheese_id,
            shop_id: tasting.shop_id,
            rating: tasting.rating,
            price_per_kg: tasting.price_per_kg.map(Into::into),
            comment: tasting.comment,
            tasted_on: tasting.tasted_on,
            created_at: tasting.created_at,
            updated_at: tasting.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct TastingPath {
    pub tasting_id: Uuid,
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ListTastingsQuery {
    pub cheese_id: Option<Uuid>,
    pub shop_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    #[serde(flatten)]
    #[validate(nested)]
    pub pagination: PaginationQuery,
}

fn validate_currency(code: &str) -> std::result::Result<(), ValidationError> {
    if code.len() == 3 && code.bytes().all(|byte| byte.is_ascii_uppercase()) {
        return Ok(());
    }
    Err(ValidationError::new("currency"))
}

pub fn routes() -> ApiRouter<AppState> {
    ApiRouter::new()
        .api_route(
            "/tastings",
            get_with(list, list_docs).post_with(create, create_docs),
        )
        .api_route(
            "/tastings/{tasting_id}",
            get_with(show, show_docs)
                .put_with(update, update_docs)
                .delete_with(remove, remove_docs),
        )
}

async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListTastingsQuery>,
) -> Result<Json<PageResponse<TastingResponse>>> {
    query.validate()?;
    let filter = TastingFilter {
        cheese_id: query.cheese_id,
        shop_id: query.shop_id,
        user_id: query.user_id,
    };
    let page = state
        .tastings
        .list(&filter, query.pagination.to_page())
        .await?;
    Ok(Json(PageResponse::new(&query.pagination, page, Into::into)))
}

async fn create(
    State(state): State<AppState>,
    caller: AuthUser,
    Json(body): Json<CreateTastingRequest>,
) -> Result<(StatusCode, Json<TastingResponse>)> {
    body.validate()?;
    let tasting = state
        .tastings
        .create(NewTasting {
            user_id: caller.id,
            cheese_id: body.cheese_id,
            shop_id: body.shop_id,
            rating: body.rating,
            price_per_kg: body.price_per_kg.map(Into::into),
            comment: body.comment,
            tasted_on: body.tasted_on,
        })
        .await
        .map_err(|error| map_repository_error(error, "tasting", "cheese or shop"))?;
    tracing::info!(tasting_id = %tasting.id, cheese_id = %tasting.cheese_id, "tasting recorded");
    Ok((StatusCode::CREATED, Json(tasting.into())))
}

async fn show(
    State(state): State<AppState>,
    Path(path): Path<TastingPath>,
) -> Result<Json<TastingResponse>> {
    let tasting = state
        .tastings
        .find(path.tasting_id)
        .await?
        .ok_or(ApiError::NotFound("tasting"))?;
    Ok(Json(tasting.into()))
}

async fn update(
    State(state): State<AppState>,
    caller: AuthUser,
    Path(path): Path<TastingPath>,
    Json(body): Json<UpdateTastingRequest>,
) -> Result<Json<TastingResponse>> {
    body.validate()?;
    let tasting = state
        .tastings
        .update(
            path.tasting_id,
            caller.scope(),
            TastingUpdate {
                rating: body.rating,
                price_per_kg: body.price_per_kg.map(Into::into),
                comment: body.comment,
                tasted_on: body.tasted_on,
            },
        )
        .await
        .map_err(|error| map_repository_error(error, "tasting", "tasting"))?;
    Ok(Json(tasting.into()))
}

async fn remove(
    State(state): State<AppState>,
    caller: AuthUser,
    Path(path): Path<TastingPath>,
) -> Result<StatusCode> {
    state
        .tastings
        .delete(path.tasting_id, caller.scope())
        .await
        .map_err(|error| map_repository_error(error, "tasting", "tasting"))?;
    Ok(StatusCode::NO_CONTENT)
}

fn list_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Tastings")
        .summary("List tastings, filtered by cheese, shop or author")
}

fn create_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Tastings")
        .summary("Record a tasting")
        .description(
            "A tasting is a dated log entry, not a mutable rating: tasting the same \
             cheese at the same shop again adds an entry rather than replacing one.",
        )
        .security_requirement("BearerAuth")
        .response::<201, Json<TastingResponse>>()
}

fn show_docs(operation: TransformOperation) -> TransformOperation {
    operation.tag("Tastings").summary("Describe one tasting")
}

fn update_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Tastings")
        .summary("Correct a tasting")
        .description("Restricted to the tasting's author; a moderator may correct anybody's.")
        .security_requirement("BearerAuth")
}

fn remove_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Tastings")
        .summary("Delete a tasting")
        .description("Restricted to the tasting's author; a moderator may delete anybody's.")
        .security_requirement("BearerAuth")
        .response::<204, ()>()
}
