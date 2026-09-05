use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// What an account is allowed to do. Ordered from least to most privileged, so
/// `>=` expresses "at least a moderator" without a lookup table.
#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
    sqlx::Type,
    Serialize,
    Deserialize,
    JsonSchema,
)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserRole {
    User,
    Moderator,
    Admin,
}

impl UserRole {
    /// A moderator may rewrite and delete content that is not theirs; an admin
    /// inherits that on top of managing roles.
    pub fn moderates(self) -> bool {
        self >= Self::Moderator
    }

    pub fn administrates(self) -> bool {
        self == Self::Admin
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    pub password_hash: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Deliberately carries no role: `UserRepository::create` never names the
/// column, so the database default applies and no registration path can grant
/// a privilege. Roles move only through `UserRepository::set_role`.
#[derive(Debug, Clone)]
pub struct NewUser {
    pub email: String,
    pub display_name: String,
    pub password_hash: String,
}
