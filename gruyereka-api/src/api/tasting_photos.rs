use aide::axum::ApiRouter;
use aide::axum::routing::{get_with, post_with};
use aide::transform::TransformOperation;
use axum::Json;
use axum::extract::{DefaultBodyLimit, Multipart, Path, State};
use axum::http::StatusCode;
use axum::http::header::LOCATION;
use axum::response::Redirect;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::auth::AuthUser;
use crate::api::error::{ApiError, Result, map_repository_error};
use crate::api::state::AppState;
use crate::api::tastings::TastingPath;
use crate::domain::tasting::TastingPhoto;
use crate::photo::PhotoStore;

/// Photos come straight off a phone camera, so the 2 MiB axum default is far too
/// small. Scoped to the upload route only.
const MAX_PHOTO_BYTES: usize = 10 * 1024 * 1024;

const ACCEPTED_PHOTO_TYPES: [&str; 3] = ["image/jpeg", "image/png", "image/webp"];

/// A visit is a handful of shots of the counter and the basket, not an album.
const MAX_PHOTOS_PER_TASTING: i64 = 10;

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TastingPhotoResponse {
    pub id: Uuid,
    /// Path to the image. Follow it; it redirects to a short-lived storage URL.
    pub url: String,
}

impl From<TastingPhoto> for TastingPhotoResponse {
    fn from(photo: TastingPhoto) -> Self {
        Self {
            id: photo.id,
            url: format!("/api/v1/tastings/{}/photos/{}", photo.tasting_id, photo.id),
        }
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct TastingPhotoPath {
    pub tasting_id: Uuid,
    pub photo_id: Uuid,
}

pub fn routes() -> ApiRouter<AppState> {
    ApiRouter::new()
        .api_route(
            "/tastings/{tasting_id}/photos",
            post_with(upload, upload_docs).layer(DefaultBodyLimit::max(MAX_PHOTO_BYTES)),
        )
        .api_route(
            "/tastings/{tasting_id}/photos/{photo_id}",
            get_with(show, show_docs).delete_with(remove, remove_docs),
        )
}

/// Removes a photo's object once its row is gone. Best effort: the row was the
/// only way to reach the object, so a failure leaves an orphan in the bucket
/// rather than anything a client can see, and is not worth failing the request.
pub async fn discard(photos: &PhotoStore, key: &str) {
    if let Err(error) = photos.delete(key).await {
        tracing::warn!(key, error = ?error, "photo object left behind in the store");
    }
}

async fn upload(
    State(state): State<AppState>,
    caller: AuthUser,
    Path(path): Path<TastingPath>,
    mut multipart: Multipart,
) -> Result<(
    StatusCode,
    [(axum::http::HeaderName, String); 1],
    Json<TastingPhotoResponse>,
)> {
    let scope = caller.scope();
    state
        .tastings
        .ensure_photo_room(path.tasting_id, scope, MAX_PHOTOS_PER_TASTING)
        .await
        .map_err(|error| map_repository_error(error, "tasting", "tasting"))?;

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

    let id = Uuid::now_v7();
    let photo = TastingPhoto {
        id,
        tasting_id: path.tasting_id,
        object_key: format!("tastings/{}/{id}", path.tasting_id),
    };
    state
        .photos
        .put(&photo.object_key, &content_type, bytes.to_vec())
        .await
        .map_err(ApiError::internal)?;
    if let Err(error) = state
        .tastings
        .add_photo(&photo, scope, MAX_PHOTOS_PER_TASTING)
        .await
    {
        tracing::debug!(key = %photo.object_key, "photo row refused, dropping its object");
        discard(&state.photos, &photo.object_key).await;
        return Err(map_repository_error(error, "tasting", "tasting"));
    }
    tracing::info!(tasting_id = %photo.tasting_id, photo_id = %photo.id, "tasting photo added");

    let body = TastingPhotoResponse::from(photo);
    Ok((
        StatusCode::CREATED,
        [(LOCATION, body.url.clone())],
        Json(body),
    ))
}

async fn show(
    State(state): State<AppState>,
    Path(path): Path<TastingPhotoPath>,
) -> Result<Redirect> {
    let photo = state
        .tastings
        .find_photo(path.tasting_id, path.photo_id)
        .await?
        .ok_or(ApiError::NotFound("photo"))?;
    let url = state
        .photos
        .presigned_url(&photo.object_key)
        .await
        .map_err(ApiError::internal)?;
    Ok(Redirect::temporary(&url))
}

async fn remove(
    State(state): State<AppState>,
    caller: AuthUser,
    Path(path): Path<TastingPhotoPath>,
) -> Result<StatusCode> {
    let photo = state
        .tastings
        .delete_photo(path.tasting_id, path.photo_id, caller.scope())
        .await
        .map_err(|error| map_repository_error(error, "photo", "photo"))?;
    tracing::info!(tasting_id = %photo.tasting_id, photo_id = %photo.id, "tasting photo deleted");
    discard(&state.photos, &photo.object_key).await;
    Ok(StatusCode::NO_CONTENT)
}

fn upload_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Tastings")
        .summary("Add a photo to a tasting")
        .description(
            "Send one `multipart/form-data` field holding a JPEG, PNG or WebP image of at \
             most 10 MiB. A tasting holds at most 10 photos; one more is refused with \
             `LIMIT_REACHED`. Restricted to the tasting's author; a moderator may add to \
             anybody's. The `Location` header points at the new photo.",
        )
        .security_requirement("BearerAuth")
        .response::<201, Json<TastingPhotoResponse>>()
}

fn show_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Tastings")
        .summary("Redirect to a photo of a tasting")
        .description("Answers with a short-lived storage URL to fetch the image from.")
        .response::<307, ()>()
}

fn remove_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Tastings")
        .summary("Delete a photo of a tasting")
        .description("Restricted to the tasting's author; a moderator may delete anybody's.")
        .security_requirement("BearerAuth")
        .response::<204, ()>()
}
