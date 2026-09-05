use aide::axum::ApiRouter;
use aide::axum::routing::{get_with, put_with};
use aide::transform::TransformOperation;
use axum::Json;
use axum::extract::{DefaultBodyLimit, Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::response::Redirect;
use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::api::auth::AuthUser;
use crate::api::error::{ApiError, Result, map_repository_error};
use crate::api::pagination::{PageResponse, PaginationQuery};
use crate::api::state::AppState;
use crate::domain::cheese::{
    Cheese, CheeseSummary, MilkType, NewCheese, PasteType, ProtectedDesignation,
};

/// Photos come straight off a phone camera, so the 2 MiB axum default is far too
/// small. Scoped to the upload route only.
const MAX_PHOTO_BYTES: usize = 10 * 1024 * 1024;

const ACCEPTED_PHOTO_TYPES: [&str; 3] = ["image/jpeg", "image/png", "image/webp"];

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
#[schemars(extend("example" = serde_json::json!({
    "name": "Comté",
    "milkTypes": ["COW"],
    "pasteType": "PRESSED_COOKED",
    "designation": "AOP",
    "agingMonths": 18
})))]
pub struct CreateCheeseRequest {
    #[validate(length(min = 1, max = 120))]
    pub name: String,
    #[validate(length(min = 1, max = 4))]
    pub milk_types: Vec<MilkType>,
    pub paste_type: PasteType,
    pub designation: Option<ProtectedDesignation>,
    #[validate(range(min = 0, max = 600))]
    pub aging_months: Option<i32>,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CheeseResponse {
    pub id: Uuid,
    pub name: String,
    pub milk_types: Vec<MilkType>,
    pub paste_type: PasteType,
    pub designation: Option<ProtectedDesignation>,
    pub aging_months: Option<i32>,
    /// Path to the photo, or `null` when none has been uploaded. Follow it with
    /// the caller's credentials; it redirects to a short-lived storage URL.
    pub photo_url: Option<String>,
    pub tasting_count: i64,
    /// Mean of the tastings on the 1 (inedible) to 5 (delicious) scale.
    pub average_score: Option<f64>,
    pub created_by_user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl CheeseResponse {
    fn from_parts(cheese: Cheese, tasting_count: i64, average_score: Option<f64>) -> Self {
        let photo_url = cheese
            .photo_key
            .as_ref()
            .map(|_| format!("/api/v1/cheeses/{}/photo", cheese.id));
        Self {
            id: cheese.id,
            name: cheese.name,
            milk_types: cheese.milk_types,
            paste_type: cheese.paste_type,
            designation: cheese.designation,
            aging_months: cheese.aging_months,
            photo_url,
            tasting_count,
            average_score,
            created_by_user_id: cheese.created_by,
            created_at: cheese.created_at,
            updated_at: cheese.updated_at,
        }
    }
}

impl From<CheeseSummary> for CheeseResponse {
    fn from(summary: CheeseSummary) -> Self {
        Self::from_parts(summary.cheese, summary.tasting_count, summary.average_score)
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct CheesePath {
    pub cheese_id: Uuid,
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ListCheesesQuery {
    /// Matches the name, accents and case folded away.
    #[validate(length(min = 1, max = 120))]
    pub search: Option<String>,
    #[serde(flatten)]
    #[validate(nested)]
    pub pagination: PaginationQuery,
}

pub fn routes() -> ApiRouter<AppState> {
    ApiRouter::new()
        .api_route(
            "/cheeses",
            get_with(list, list_docs).post_with(create, create_docs),
        )
        .api_route("/cheeses/{cheese_id}", get_with(show, show_docs))
        .api_route(
            "/cheeses/{cheese_id}/photo",
            put_with(upload_photo, upload_photo_docs)
                .get_with(show_photo, show_photo_docs)
                .layer(DefaultBodyLimit::max(MAX_PHOTO_BYTES)),
        )
}

async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListCheesesQuery>,
) -> Result<Json<PageResponse<CheeseResponse>>> {
    query.validate()?;
    let page = state
        .cheeses
        .list(query.search.as_deref(), query.pagination.to_page())
        .await?;
    Ok(Json(PageResponse::new(&query.pagination, page, Into::into)))
}

async fn create(
    State(state): State<AppState>,
    caller: AuthUser,
    Json(body): Json<CreateCheeseRequest>,
) -> Result<(StatusCode, Json<CheeseResponse>)> {
    body.validate()?;
    let cheese = state
        .cheeses
        .create(NewCheese {
            name: body.name,
            milk_types: body.milk_types,
            paste_type: body.paste_type,
            designation: body.designation,
            aging_months: body.aging_months,
            created_by: caller.id,
        })
        .await
        .map_err(|error| map_repository_error(error, "cheese", "user"))?;
    tracing::info!(cheese_id = %cheese.id, name = %cheese.name, "cheese created");
    Ok((
        StatusCode::CREATED,
        Json(CheeseResponse::from_parts(cheese, 0, None)),
    ))
}

async fn show(
    State(state): State<AppState>,
    Path(path): Path<CheesePath>,
) -> Result<Json<CheeseResponse>> {
    let summary = state
        .cheeses
        .summary(path.cheese_id)
        .await?
        .ok_or(ApiError::NotFound("cheese"))?;
    Ok(Json(summary.into()))
}

async fn upload_photo(
    State(state): State<AppState>,
    _caller: AuthUser,
    Path(path): Path<CheesePath>,
    mut multipart: Multipart,
) -> Result<Json<CheeseResponse>> {
    let field = multipart
        .next_field()
        .await
        .map_err(|error| ApiError::BadRequest(error.body_text()))?
        .ok_or_else(|| ApiError::BadRequest("the request carries no file".to_owned()))?;

    let content_type = field
        .content_type()
        .ok_or_else(|| ApiError::BadRequest("the file has no content type".to_owned()))?
        .to_owned();
    if !ACCEPTED_PHOTO_TYPES.contains(&content_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "unsupported photo type {content_type}"
        )));
    }
    let bytes = field
        .bytes()
        .await
        .map_err(|error| ApiError::BadRequest(error.body_text()))?;

    let key = format!("cheeses/{}", path.cheese_id);
    state
        .photos
        .put(&key, &content_type, bytes.to_vec())
        .await
        .map_err(ApiError::internal)?;
    let cheese = state
        .cheeses
        .set_photo_key(path.cheese_id, &key)
        .await
        .map_err(|error| map_repository_error(error, "cheese", "cheese"))?;
    let summary = state
        .cheeses
        .summary(cheese.id)
        .await?
        .ok_or(ApiError::NotFound("cheese"))?;
    Ok(Json(summary.into()))
}

async fn show_photo(
    State(state): State<AppState>,
    Path(path): Path<CheesePath>,
) -> Result<Redirect> {
    let cheese = state
        .cheeses
        .find(path.cheese_id)
        .await?
        .ok_or(ApiError::NotFound("cheese"))?;
    let key = cheese.photo_key.ok_or(ApiError::NotFound("photo"))?;
    let url = state
        .photos
        .presigned_url(&key)
        .await
        .map_err(ApiError::internal)?;
    Ok(Redirect::temporary(&url))
}

fn list_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Cheeses")
        .summary("List cheeses with their aggregated tasting score")
}

fn create_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Cheeses")
        .summary("Create a cheese")
        .description(
            "A cheese is identified by its name, milk types, paste and aging: \
             re-creating the same combination is a conflict.",
        )
        .security_requirement("BearerAuth")
        .response::<201, Json<CheeseResponse>>()
}

fn show_docs(operation: TransformOperation) -> TransformOperation {
    operation.tag("Cheeses").summary("Describe one cheese")
}

fn upload_photo_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Cheeses")
        .summary("Replace the photo of a cheese")
        .description("Send one `multipart/form-data` field holding a JPEG, PNG or WebP image.")
        .security_requirement("BearerAuth")
}

fn show_photo_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Cheeses")
        .summary("Redirect to the photo of a cheese")
        .response::<307, ()>()
}
