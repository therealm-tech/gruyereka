use aide::axum::ApiRouter;
use aide::axum::routing::{delete_with, get_with, put_with};
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
use crate::api::error::{Result, map_repository_error};
use crate::api::pagination::{PageResponse, PaginationQuery};
use crate::api::shops::ShopPath;
use crate::api::state::AppState;
use crate::domain::shop_review::{NewShopReview, ShopReview};

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
#[schemars(extend("example" = serde_json::json!({
    "score": 4,
    "comment": "Bon choix de chèvres, accueil au top."
})))]
pub struct UpsertShopReviewRequest {
    #[validate(range(min = 1, max = 5))]
    pub score: i16,
    #[validate(length(min = 1, max = 2000))]
    pub comment: Option<String>,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ShopReviewResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub shop_id: Uuid,
    pub score: i16,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ShopReview> for ShopReviewResponse {
    fn from(review: ShopReview) -> Self {
        Self {
            id: review.id,
            user_id: review.user_id,
            shop_id: review.shop_id,
            score: review.score,
            comment: review.comment,
            created_at: review.created_at,
            updated_at: review.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ShopReviewPath {
    pub shop_id: Uuid,
    pub review_id: Uuid,
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ListShopReviewsQuery {
    #[serde(flatten)]
    #[validate(nested)]
    pub pagination: PaginationQuery,
}

pub fn routes() -> ApiRouter<AppState> {
    ApiRouter::new()
        .api_route("/shops/{shop_id}/reviews", get_with(list, list_docs))
        .api_route(
            "/shops/{shop_id}/reviews/me",
            put_with(upsert, upsert_docs).merge(delete_with(remove, remove_docs)),
        )
        .api_route(
            "/shops/{shop_id}/reviews/{review_id}",
            delete_with(remove_by_id, remove_by_id_docs),
        )
}

async fn list(
    State(state): State<AppState>,
    Path(path): Path<ShopPath>,
    Query(query): Query<ListShopReviewsQuery>,
) -> Result<Json<PageResponse<ShopReviewResponse>>> {
    query.validate()?;
    let page = state
        .shop_reviews
        .list_by_shop(path.shop_id, query.pagination.to_page())
        .await?;
    Ok(Json(PageResponse::new(&query.pagination, page, Into::into)))
}

async fn upsert(
    State(state): State<AppState>,
    caller: AuthUser,
    Path(path): Path<ShopPath>,
    Json(body): Json<UpsertShopReviewRequest>,
) -> Result<Json<ShopReviewResponse>> {
    body.validate()?;
    let review = state
        .shop_reviews
        .upsert(NewShopReview {
            user_id: caller.id,
            shop_id: path.shop_id,
            score: body.score,
            comment: body.comment,
        })
        .await
        .map_err(|error| map_repository_error(error, "review", "shop"))?;
    Ok(Json(review.into()))
}

async fn remove(
    State(state): State<AppState>,
    caller: AuthUser,
    Path(path): Path<ShopPath>,
) -> Result<StatusCode> {
    state
        .shop_reviews
        .delete(path.shop_id, caller.id)
        .await
        .map_err(|error| map_repository_error(error, "review", "shop"))?;
    Ok(StatusCode::NO_CONTENT)
}

/// The id-addressed sibling of `remove`, which is how a moderator reaches a
/// review that is not theirs.
async fn remove_by_id(
    State(state): State<AppState>,
    caller: AuthUser,
    Path(path): Path<ShopReviewPath>,
) -> Result<StatusCode> {
    state
        .shop_reviews
        .delete_by_id(path.shop_id, path.review_id, caller.scope())
        .await
        .map_err(|error| map_repository_error(error, "review", "shop"))?;
    Ok(StatusCode::NO_CONTENT)
}

fn list_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Shop reviews")
        .summary("List the reviews left on a shop")
}

fn upsert_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Shop reviews")
        .summary("Leave or rewrite the caller's review of a shop")
        .description("One review per author and shop: posting again replaces the previous one.")
        .security_requirement("BearerAuth")
}

fn remove_by_id_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Shop reviews")
        .summary("Delete one review by its id")
        .description("Restricted to the review's author; a moderator may delete anybody's.")
        .security_requirement("BearerAuth")
        .response::<204, ()>()
}

fn remove_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Shop reviews")
        .summary("Withdraw the caller's review of a shop")
        .security_requirement("BearerAuth")
        .response::<204, ()>()
}
