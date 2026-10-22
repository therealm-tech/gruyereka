pub mod cheese;
pub mod shop;
pub mod shop_review;
pub mod tasting;
pub mod user;

use sqlx::postgres::PgDatabaseError;

/// Outcomes a caller has to tell apart to pick an HTTP status. Everything the
/// boundary cannot act on collapses into `Database`.
#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    #[error("resource not found")]
    NotFound,
    #[error("resource already exists")]
    Conflict,
    #[error("resource is full")]
    LimitReached,
    #[error("referenced resource does not exist")]
    ForeignKeyViolation,
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

pub type Result<T> = std::result::Result<T, RepositoryError>;

/// Maps the two PostgreSQL integrity errors the API has an answer for. The codes
/// are the SQLSTATE classes: 23505 unique violation, 23503 foreign key
/// violation.
pub(crate) fn classify(error: sqlx::Error) -> RepositoryError {
    let sqlx::Error::Database(ref db_error) = error else {
        return RepositoryError::Database(error);
    };
    let Some(pg_error) = db_error.try_downcast_ref::<PgDatabaseError>() else {
        return RepositoryError::Database(error);
    };
    match pg_error.code() {
        "23505" => RepositoryError::Conflict,
        "23503" => RepositoryError::ForeignKeyViolation,
        _ => RepositoryError::Database(error),
    }
}

/// Whose rows a write is allowed to touch. A distinct type rather than an
/// `Option<Uuid>`, so widening a query to everybody's rows has to be spelled out
/// at the call site instead of being one forgotten argument away.
#[derive(Debug, Clone, Copy)]
pub enum AuthorScope {
    Author(uuid::Uuid),
    AnyAuthor,
}

impl AuthorScope {
    /// `None` disables the author predicate in the SQL below.
    pub(crate) fn author_id(self) -> Option<uuid::Uuid> {
        match self {
            Self::Author(id) => Some(id),
            Self::AnyAuthor => None,
        }
    }
}

/// A slice of a listing, already clamped by the boundary.
#[derive(Debug, Clone, Copy)]
pub struct Page {
    pub limit: i64,
    pub offset: i64,
}

/// A page of results together with the size of the whole filtered set, which is
/// what lets a client compute the number of pages.
#[derive(Debug, Clone)]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub total: i64,
}
