use aide::OperationOutput;
use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use schemars::JsonSchema;
use serde::Serialize;
use std::collections::BTreeMap;
use validator::ValidationErrors;

use crate::repository::RepositoryError;

/// Machine-readable failure. `code` is the stable contract clients translate;
/// `message` is English prose for whoever reads the response by hand and is
/// never meant to be shown to an end user.
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub code: &'static str,
    pub message: String,
    /// Offending fields, keyed by name, when the request failed validation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<BTreeMap<String, Vec<String>>>,
}

/// Failures that have no business reaching the client. Boxing the source keeps
/// its details available to the log line and out of the response body.
#[derive(Debug, thiserror::Error)]
#[error("internal error")]
pub struct InternalError(#[source] Box<dyn std::error::Error + Send + Sync>);

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("no credentials, or credentials that do not check out")]
    Unauthenticated,
    /// The caller is known but not allowed. Used where hiding the resource
    /// would be pointless; a write on somebody else's row stays a `NotFound`
    /// instead, so it does not confirm the row exists.
    #[error("{0}")]
    Forbidden(&'static str),
    #[error("{0} not found")]
    NotFound(&'static str),
    #[error("{0} already exists")]
    Conflict(&'static str),
    /// Something the body referenced does not exist. Distinct from `NotFound`,
    /// which is about the resource named in the URL.
    #[error("referenced {0} does not exist")]
    UnknownReference(&'static str),
    #[error("the request did not validate")]
    Validation(#[from] ValidationErrors),
    #[error("{0}")]
    BadRequest(String),
    #[error(transparent)]
    Internal(#[from] InternalError),
}

impl ApiError {
    fn parts(&self) -> (StatusCode, &'static str) {
        match self {
            Self::Unauthenticated => (StatusCode::UNAUTHORIZED, "UNAUTHENTICATED"),
            Self::Forbidden(_) => (StatusCode::FORBIDDEN, "FORBIDDEN"),
            Self::NotFound(_) => (StatusCode::NOT_FOUND, "NOT_FOUND"),
            Self::Conflict(_) => (StatusCode::CONFLICT, "CONFLICT"),
            Self::UnknownReference(_) => (StatusCode::UNPROCESSABLE_ENTITY, "UNKNOWN_REFERENCE"),
            Self::Validation(_) => (StatusCode::UNPROCESSABLE_ENTITY, "VALIDATION_FAILED"),
            Self::BadRequest(_) => (StatusCode::BAD_REQUEST, "BAD_REQUEST"),
            Self::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR"),
        }
    }

    pub fn internal(error: impl std::error::Error + Send + Sync + 'static) -> Self {
        Self::Internal(InternalError(Box::new(error)))
    }
}

/// Fallback for the read paths, where only a database failure is reachable.
/// Handlers that can hit a conflict or a broken reference name the resource
/// through [`map_repository_error`] instead of relying on this.
impl From<RepositoryError> for ApiError {
    fn from(error: RepositoryError) -> Self {
        map_repository_error(error, "resource", "resource")
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        Self::internal(error)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = self.parts();
        if let Self::Internal(ref inner) = self {
            tracing::error!(error = ?inner, "request failed");
        } else {
            tracing::debug!(%code, error = %self, "request rejected");
        }

        let fields = match &self {
            Self::Validation(errors) => Some(field_messages(errors)),
            _ => None,
        };
        let body = ErrorResponse {
            code,
            message: self.to_string(),
            fields,
        };
        (status, Json(body)).into_response()
    }
}

impl OperationOutput for ApiError {
    type Inner = ();
}

/// Flattens `validator`'s error tree into `field -> [code, ...]`. The codes are
/// `validator`'s own (`length`, `range`, `email`, …) and are part of the
/// contract, so a client can phrase the message in its own language.
fn field_messages(errors: &ValidationErrors) -> BTreeMap<String, Vec<String>> {
    errors
        .field_errors()
        .iter()
        .map(|(field, errors)| {
            let codes = errors.iter().map(|error| error.code.to_string()).collect();
            (camel_case(field), codes)
        })
        .collect()
}

/// `validator` reports the Rust field name, which is snake case, while every
/// body field on the wire is camel case. Without this the client is handed a key
/// that matches nothing it sent.
fn camel_case(field: &str) -> String {
    let mut out = String::with_capacity(field.len());
    let mut capitalise = false;
    for character in field.chars() {
        if character == '_' {
            capitalise = true;
        } else if capitalise {
            out.extend(character.to_uppercase());
            capitalise = false;
        } else {
            out.push(character);
        }
    }
    out
}

/// Maps a repository outcome onto the API vocabulary. `resource` names what the
/// URL pointed at, `reference` what the body pointed at.
pub fn map_repository_error(
    error: RepositoryError,
    resource: &'static str,
    reference: &'static str,
) -> ApiError {
    match error {
        RepositoryError::NotFound => ApiError::NotFound(resource),
        RepositoryError::Conflict => ApiError::Conflict(resource),
        RepositoryError::ForeignKeyViolation => ApiError::UnknownReference(reference),
        RepositoryError::Database(error) => error.into(),
    }
}

pub type Result<T> = std::result::Result<T, ApiError>;

#[cfg(test)]
mod tests {
    use super::camel_case;

    #[test]
    fn matches_the_names_used_on_the_wire() {
        assert_eq!(camel_case("display_name"), "displayName");
        assert_eq!(camel_case("price_per_kg"), "pricePerKg");
        assert_eq!(camel_case("email"), "email");
    }
}
