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
    NewTasting, NewTastingItem, PricePerKg, RatingLevel, Tasting, TastingFilter, TastingItem,
    TastingUpdate,
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

/// Nobody walks out of a fromagerie with fifty cheeses, and a bound keeps one
/// request from writing an unbounded number of rows.
const MAX_CHEESES_PER_VISIT: usize = 50;

/// One cheese inside a visit, on the way in.
///
/// `Serialize` is here only because `validator` needs it to attach a failing
/// value to a custom rule on a `Vec` field. Nothing serialises this type: the
/// error body carries codes and never the payload it was handed.
#[derive(Debug, Deserialize, Serialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct TastingItemRequest {
    pub cheese_id: Uuid,
    pub rating: RatingLevel,
    #[validate(nested)]
    pub price_per_kg: Option<PricePerKgDto>,
    #[validate(length(min = 1, max = 2000))]
    pub comment: Option<String>,
}

impl From<TastingItemRequest> for NewTastingItem {
    fn from(dto: TastingItemRequest) -> Self {
        Self {
            cheese_id: dto.cheese_id,
            rating: dto.rating,
            price_per_kg: dto.price_per_kg.map(Into::into),
            comment: dto.comment,
        }
    }
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
#[schemars(extend("example" = serde_json::json!({
    "shopId": "018f3b2c-0000-7000-8000-000000000002",
    "tastedOn": "2026-09-05",
    "items": [
        {
            "cheeseId": "018f3b2c-0000-7000-8000-000000000001",
            "rating": "DELICIOUS",
            "pricePerKg": {"amountCents": 3450, "currency": "EUR"},
            "comment": "Bien fruité, une pointe de cristaux."
        },
        {
            "cheeseId": "018f3b2c-0000-7000-8000-000000000003",
            "rating": "MEH"
        }
    ]
})))]
pub struct CreateTastingRequest {
    pub shop_id: Uuid,
    pub tasted_on: NaiveDate,
    #[validate(nested, custom(function = validate_basket))]
    pub items: Vec<TastingItemRequest>,
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTastingRequest {
    pub tasted_on: NaiveDate,
    #[validate(nested, custom(function = validate_basket))]
    pub items: Vec<TastingItemRequest>,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TastingItemResponse {
    pub id: Uuid,
    pub cheese_id: Uuid,
    pub rating: RatingLevel,
    pub price_per_kg: Option<PricePerKgDto>,
    pub comment: Option<String>,
}

impl From<TastingItem> for TastingItemResponse {
    fn from(item: TastingItem) -> Self {
        Self {
            id: item.id,
            cheese_id: item.cheese_id,
            rating: item.rating,
            price_per_kg: item.price_per_kg.map(Into::into),
            comment: item.comment,
        }
    }
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TastingResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub shop_id: Uuid,
    pub tasted_on: NaiveDate,
    /// Never empty, and one entry per cheese: the rating and the price are the
    /// item's, not the visit's.
    pub items: Vec<TastingItemResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Tasting> for TastingResponse {
    fn from(tasting: Tasting) -> Self {
        Self {
            id: tasting.id,
            user_id: tasting.user_id,
            shop_id: tasting.shop_id,
            tasted_on: tasting.tasted_on,
            items: tasting.items.into_iter().map(Into::into).collect(),
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

/// A basket holds a handful of cheeses at most, and never the same one twice.
///
/// Written by hand rather than with `length` plus a second rule, because
/// `validator`'s length check on a `Vec` demands `Serialize` on the element —
/// a trait a request DTO has no business deriving. Doing it here also lets each
/// rule answer with its own code, so a client can say which one broke.
fn validate_basket(items: &[TastingItemRequest]) -> std::result::Result<(), ValidationError> {
    if items.is_empty() {
        return Err(ValidationError::new("basket_empty"));
    }
    if items.len() > MAX_CHEESES_PER_VISIT {
        return Err(ValidationError::new("basket_too_large"));
    }
    let mut seen = std::collections::HashSet::with_capacity(items.len());
    if !items.iter().all(|item| seen.insert(item.cheese_id)) {
        // The unique index refuses it anyway; saying so here beats answering
        // "already exists" to somebody who listed a cheese twice by accident.
        return Err(ValidationError::new("basket_repeats_a_cheese"));
    }
    Ok(())
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
            shop_id: body.shop_id,
            tasted_on: body.tasted_on,
            items: body.items.into_iter().map(Into::into).collect(),
        })
        .await
        .map_err(|error| map_repository_error(error, "tasting", "cheese or shop"))?;
    tracing::info!(
        tasting_id = %tasting.id,
        cheeses = tasting.items.len(),
        "tasting recorded"
    );
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
                tasted_on: body.tasted_on,
                items: body.items.into_iter().map(Into::into).collect(),
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
        .description(
            "The cheese filter matches a visit containing it, and returns the whole visit.",
        )
}

fn create_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Tastings")
        .summary("Record a tasting")
        .description(
            "One visit: a shop, a day, and one entry per cheese tasted there. A rating \
             and a price belong to a cheese, never to the basket. Coming back another \
             day is another visit rather than a correction, which is what keeps the \
             price history.",
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
        .description(
            "Replaces the whole list of cheeses: removing one from a visit is sending \
             the list without it. Restricted to the tasting's author; a moderator may \
             correct anybody's.",
        )
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
