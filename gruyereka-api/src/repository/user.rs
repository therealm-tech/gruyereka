use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::user::{NewUser, User, UserRole};
use crate::repository::{Page, Paginated, RepositoryError, Result, classify};

#[derive(Debug, Clone)]
pub struct UserRepository {
    pool: PgPool,
}

impl UserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, user: NewUser) -> Result<User> {
        let id = Uuid::now_v7();
        sqlx::query_as::<_, User>(
            "INSERT INTO users (id, email, display_name, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, display_name, password_hash, role, created_at, updated_at",
        )
        .bind(id)
        .bind(&user.email)
        .bind(&user.display_name)
        .bind(&user.password_hash)
        .fetch_one(&self.pool)
        .await
        .map_err(classify)
    }

    pub async fn find_by_email(&self, email: &str) -> Result<Option<User>> {
        sqlx::query_as::<_, User>(
            "SELECT id, email, display_name, password_hash, role, created_at, updated_at
             FROM users WHERE lower(email) = lower($1)",
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)
    }

    /// Moves an account between roles. The only write path that touches the
    /// column, so privilege can never be granted as a side effect of another
    /// operation.
    pub async fn set_role(&self, id: Uuid, role: UserRole) -> Result<User> {
        sqlx::query_as::<_, User>(
            "UPDATE users SET role = $2, updated_at = now()
             WHERE id = $1
             RETURNING id, email, display_name, password_hash, role, created_at, updated_at",
        )
        .bind(id)
        .bind(role)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?
        .ok_or(RepositoryError::NotFound)
    }

    pub async fn set_password_hash(&self, id: Uuid, password_hash: &str) -> Result<User> {
        sqlx::query_as::<_, User>(
            "UPDATE users SET password_hash = $2, updated_at = now()
             WHERE id = $1
             RETURNING id, email, display_name, password_hash, role, created_at, updated_at",
        )
        .bind(id)
        .bind(password_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?
        .ok_or(RepositoryError::NotFound)
    }

    pub async fn list(&self, page: Page) -> Result<Paginated<User>> {
        let total = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM users")
            .fetch_one(&self.pool)
            .await
            .map_err(classify)?;

        let items = sqlx::query_as::<_, User>(
            "SELECT id, email, display_name, password_hash, role, created_at, updated_at
             FROM users
             ORDER BY created_at, id
             LIMIT $1 OFFSET $2",
        )
        .bind(page.limit)
        .bind(page.offset)
        .fetch_all(&self.pool)
        .await
        .map_err(classify)?;

        Ok(Paginated { items, total })
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<User>> {
        sqlx::query_as::<_, User>(
            "SELECT id, email, display_name, password_hash, role, created_at, updated_at
             FROM users WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)
    }
}
