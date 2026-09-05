use aide::OperationInput;
use argon2::Argon2;
use argon2::password_hash::phc::PasswordHash;
use argon2::password_hash::{PasswordHasher, PasswordVerifier};
use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use chrono::Utc;
use jsonwebtoken::{Algorithm, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::error::ApiError;
use crate::api::state::{AppState, TokenConfig};
use crate::domain::user::UserRole;
use crate::repository::AuthorScope;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Identifier of the authenticated user.
    pub sub: Uuid,
    pub iat: i64,
    pub exp: i64,
}

/// The authenticated caller. Extracting it is what makes an endpoint protected;
/// a handler that does not take it is public by construction.
#[derive(Debug, Clone, Copy)]
pub struct AuthUser {
    pub id: Uuid,
    pub role: UserRole,
}

impl AuthUser {
    /// Widens a write past its author when the caller moderates.
    pub fn scope(self) -> AuthorScope {
        if self.role.moderates() {
            AuthorScope::AnyAuthor
        } else {
            AuthorScope::Author(self.id)
        }
    }

    pub fn require_admin(self) -> Result<(), ApiError> {
        if self.role.administrates() {
            return Ok(());
        }
        Err(ApiError::Forbidden("this needs an administrator"))
    }
}

impl TokenConfig {
    pub fn issue(&self, user_id: Uuid) -> Result<String, ApiError> {
        let issued_at = Utc::now();
        let claims = Claims {
            sub: user_id,
            iat: issued_at.timestamp(),
            exp: (issued_at + chrono::Duration::minutes(i64::from(self.ttl_minutes))).timestamp(),
        };
        encode(&Header::new(Algorithm::HS256), &claims, &self.encoding).map_err(ApiError::internal)
    }

    fn verify(&self, token: &str) -> Option<Claims> {
        decode::<Claims>(token, &self.decoding, &Validation::new(Algorithm::HS256))
            .ok()
            .map(|data| data.claims)
    }
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    /// The role is read from the database on every request rather than carried
    /// in the token. Tokens are not revocable, so a role baked into one would
    /// keep granting privileges for its whole lifetime after a demotion. The
    /// cost is one primary-key lookup per authenticated request, which also
    /// makes deleting an account cut its sessions immediately.
    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .ok_or(ApiError::Unauthenticated)?;
        let claims = state
            .tokens
            .verify(token.trim())
            .ok_or(ApiError::Unauthenticated)?;
        let user = state
            .users
            .find_by_id(claims.sub)
            .await?
            .ok_or(ApiError::Unauthenticated)?;
        Ok(Self {
            id: user.id,
            role: user.role,
        })
    }
}

// `aide` needs every extractor to describe itself; the bearer token is declared
// once as a security scheme on the operation instead, so there is nothing to add
// to the request schema here.
impl OperationInput for AuthUser {}

pub fn hash_password(password: &str) -> Result<String, ApiError> {
    let hash: PasswordHash = Argon2::default()
        .hash_password(password.as_bytes())
        .map_err(ApiError::internal)?;
    Ok(hash.to_string())
}

/// Returns `false` on a malformed stored hash rather than erroring: a corrupted
/// row must not tell an attacker it exists.
pub fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

#[cfg(test)]
mod tests {
    use jsonwebtoken::{DecodingKey, EncodingKey};
    use uuid::Uuid;

    use super::{TokenConfig, hash_password, verify_password};

    fn tokens() -> TokenConfig {
        TokenConfig {
            encoding: EncodingKey::from_secret(b"test-secret"),
            decoding: DecodingKey::from_secret(b"test-secret"),
            ttl_minutes: 60,
        }
    }

    #[test]
    fn accepts_the_password_it_hashed_and_nothing_else() {
        let hash = hash_password("un-mot-de-passe-long").unwrap();

        assert!(verify_password("un-mot-de-passe-long", &hash));
        assert!(!verify_password("un-mot-de-passe-faux", &hash));
    }

    #[test]
    fn treats_a_corrupted_hash_as_a_failed_login() {
        assert!(!verify_password("un-mot-de-passe-long", "not-a-phc-string"));
    }

    #[test]
    fn round_trips_the_user_through_a_token() {
        let tokens = tokens();
        let user = Uuid::now_v7();

        let claims = tokens.verify(&tokens.issue(user).unwrap()).unwrap();

        assert_eq!(claims.sub, user);
    }

    #[test]
    fn rejects_a_token_signed_with_another_key() {
        let issued = TokenConfig {
            encoding: EncodingKey::from_secret(b"another-secret"),
            decoding: DecodingKey::from_secret(b"another-secret"),
            ttl_minutes: 60,
        }
        .issue(Uuid::now_v7())
        .unwrap();

        assert!(tokens().verify(&issued).is_none());
    }
}
