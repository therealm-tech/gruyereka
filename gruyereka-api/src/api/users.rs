use aide::axum::ApiRouter;
use aide::axum::routing::{get_with, post_with, put_with};
use aide::transform::TransformOperation;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::api::auth::{AuthUser, hash_password, verify_password};
use crate::api::error::{ApiError, Result};
use crate::api::pagination::{PageResponse, PaginationQuery};
use crate::api::state::AppState;
use crate::domain::user::{NewUser, User, UserRole};

/// Shortest password accepted. Long over complex: a length floor is the only
/// composition rule that measurably helps, and Argon2 handles the rest.
const MIN_PASSWORD_LENGTH: u64 = 12;

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
#[schemars(extend("example" = serde_json::json!({
    "email": "camille@example.org",
    "displayName": "Camille",
    "password": "un-mot-de-passe-long"
})))]
pub struct RegisterRequest {
    #[validate(email, length(max = 254))]
    pub email: String,
    #[validate(length(min = 1, max = 80))]
    pub display_name: String,
    #[validate(length(min = "MIN_PASSWORD_LENGTH", max = 256))]
    pub password: String,
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 1))]
    pub password: String,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            role: user.role,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub access_token: String,
    pub expires_in_seconds: u32,
    pub user: UserResponse,
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
#[schemars(extend("example" = serde_json::json!({"role": "MODERATOR"})))]
pub struct UpdateUserRoleRequest {
    pub role: UserRole,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct UserPath {
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ListUsersQuery {
    #[serde(flatten)]
    #[validate(nested)]
    pub pagination: PaginationQuery,
}

pub fn routes() -> ApiRouter<AppState> {
    ApiRouter::new()
        .api_route("/auth/register", post_with(register, register_docs))
        .api_route("/auth/login", post_with(login, login_docs))
        .api_route("/auth/me", get_with(me, me_docs))
        .api_route("/users", get_with(list, list_docs))
        .api_route(
            "/users/{user_id}/role",
            put_with(update_role, update_role_docs),
        )
}

async fn list(
    State(state): State<AppState>,
    caller: AuthUser,
    Query(query): Query<ListUsersQuery>,
) -> Result<Json<PageResponse<UserResponse>>> {
    caller.require_admin()?;
    query.validate()?;
    let page = state.users.list(query.pagination.to_page()).await?;
    Ok(Json(PageResponse::new(&query.pagination, page, Into::into)))
}

async fn update_role(
    State(state): State<AppState>,
    caller: AuthUser,
    Path(path): Path<UserPath>,
    Json(body): Json<UpdateUserRoleRequest>,
) -> Result<Json<UserResponse>> {
    caller.require_admin()?;
    body.validate()?;
    // Refusing self-demotion keeps the "there is always an administrator"
    // property local to this handler, instead of resting on a count query that
    // two concurrent requests could both pass.
    if path.user_id == caller.id {
        return Err(ApiError::Forbidden(
            "an administrator cannot change their own role",
        ));
    }
    let user = state
        .users
        .set_role(path.user_id, body.role)
        .await
        .map_err(|error| crate::api::error::map_repository_error(error, "user", "user"))?;
    tracing::info!(user_id = %user.id, role = ?user.role, "role changed");
    Ok(Json(user.into()))
}

async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<SessionResponse>)> {
    body.validate()?;
    let user = state
        .users
        .create(NewUser {
            email: body.email,
            display_name: body.display_name,
            password_hash: hash_password(&body.password)?,
        })
        .await
        .map_err(|error| crate::api::error::map_repository_error(error, "user", "user"))?;
    tracing::info!(user_id = %user.id, "user registered");
    Ok((StatusCode::CREATED, Json(session(&state, user)?)))
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<SessionResponse>> {
    body.validate()?;
    let user = state.users.find_by_email(&body.email).await?;
    // Same rejection whether the address is unknown or the password is wrong:
    // telling them apart turns the login form into an account enumerator.
    let Some(user) = user.filter(|user| verify_password(&body.password, &user.password_hash))
    else {
        return Err(ApiError::Unauthenticated);
    };
    tracing::debug!(user_id = %user.id, "user signed in");
    Ok(Json(session(&state, user)?))
}

async fn me(State(state): State<AppState>, caller: AuthUser) -> Result<Json<UserResponse>> {
    let user = state
        .users
        .find_by_id(caller.id)
        .await?
        .ok_or(ApiError::NotFound("user"))?;
    Ok(Json(user.into()))
}

fn session(state: &AppState, user: User) -> Result<SessionResponse> {
    Ok(SessionResponse {
        access_token: state.tokens.issue(user.id)?,
        expires_in_seconds: state.tokens.ttl_minutes * 60,
        user: user.into(),
    })
}

fn list_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Users")
        .summary("List the accounts")
        .security_requirement("BearerAuth")
}

fn update_role_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Users")
        .summary("Move an account to another role")
        .description(
            "Administrators only. An administrator cannot change their own role, so an \
             instance is never left without one.",
        )
        .security_requirement("BearerAuth")
}

fn register_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Authentication")
        .summary("Create an account and open a session")
        .response::<201, Json<SessionResponse>>()
}

fn login_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Authentication")
        .summary("Exchange credentials for an access token")
}

fn me_docs(operation: TransformOperation) -> TransformOperation {
    operation
        .tag("Authentication")
        .summary("Describe the authenticated user")
        .security_requirement("BearerAuth")
}
