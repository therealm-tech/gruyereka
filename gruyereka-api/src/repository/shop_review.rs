use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::shop_review::{NewShopReview, ShopReview};
use crate::repository::{AuthorScope, Page, Paginated, RepositoryError, Result, classify};

#[derive(Debug, sqlx::FromRow)]
struct ShopReviewRow {
    id: Uuid,
    user_id: Uuid,
    shop_id: Uuid,
    score: i16,
    comment: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<ShopReviewRow> for ShopReview {
    fn from(row: ShopReviewRow) -> Self {
        Self {
            id: row.id,
            user_id: row.user_id,
            shop_id: row.shop_id,
            score: row.score,
            comment: row.comment,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ShopReviewRepository {
    pool: PgPool,
}

impl ShopReviewRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// One review per author and shop: posting again rewrites the previous one.
    pub async fn upsert(&self, review: NewShopReview) -> Result<ShopReview> {
        let id = Uuid::now_v7();
        let row = sqlx::query_as::<_, ShopReviewRow>(
            "INSERT INTO shop_reviews (id, user_id, shop_id, score, comment)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT ON CONSTRAINT shop_reviews_author_key DO UPDATE
                 SET score = excluded.score,
                     comment = excluded.comment,
                     updated_at = now()
             RETURNING id, user_id, shop_id, score, comment, created_at, updated_at",
        )
        .bind(id)
        .bind(review.user_id)
        .bind(review.shop_id)
        .bind(review.score)
        .bind(&review.comment)
        .fetch_one(&self.pool)
        .await
        .map_err(classify)?;
        Ok(row.into())
    }

    pub async fn list_by_shop(&self, shop_id: Uuid, page: Page) -> Result<Paginated<ShopReview>> {
        let total =
            sqlx::query_scalar::<_, i64>("SELECT count(*) FROM shop_reviews WHERE shop_id = $1")
                .bind(shop_id)
                .fetch_one(&self.pool)
                .await
                .map_err(classify)?;

        let rows = sqlx::query_as::<_, ShopReviewRow>(
            "SELECT id, user_id, shop_id, score, comment, created_at, updated_at FROM shop_reviews
             WHERE shop_id = $1
             ORDER BY updated_at DESC
             LIMIT $2 OFFSET $3",
        )
        .bind(shop_id)
        .bind(page.limit)
        .bind(page.offset)
        .fetch_all(&self.pool)
        .await
        .map_err(classify)?;

        Ok(Paginated {
            items: rows.into_iter().map(Into::into).collect(),
            total,
        })
    }

    /// Deletes one review by its own id. `scope` pins it to its author unless a
    /// moderator widens it.
    pub async fn delete_by_id(
        &self,
        shop_id: Uuid,
        review_id: Uuid,
        scope: AuthorScope,
    ) -> Result<()> {
        let deleted = sqlx::query(
            "DELETE FROM shop_reviews
             WHERE id = $1 AND shop_id = $2 AND ($3::uuid IS NULL OR user_id = $3)",
        )
        .bind(review_id)
        .bind(shop_id)
        .bind(scope.author_id())
        .execute(&self.pool)
        .await
        .map_err(classify)?;
        if deleted.rows_affected() == 0 {
            return Err(RepositoryError::NotFound);
        }
        Ok(())
    }

    pub async fn delete(&self, shop_id: Uuid, user_id: Uuid) -> Result<()> {
        let deleted = sqlx::query("DELETE FROM shop_reviews WHERE shop_id = $1 AND user_id = $2")
            .bind(shop_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(classify)?;
        if deleted.rows_affected() == 0 {
            return Err(RepositoryError::NotFound);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use sqlx::PgPool;

    use super::ShopReviewRepository;
    use crate::domain::shop_review::NewShopReview;
    use crate::repository::Page;
    use crate::test_support::{a_shop, a_user};

    #[sqlx::test]
    async fn replaces_the_previous_review_of_the_same_author(pool: PgPool) {
        let author = a_user(&pool).await;
        let shop = a_shop(&pool, author, 10).await;
        let repository = ShopReviewRepository::new(pool);
        let review = |score| NewShopReview {
            user_id: author,
            shop_id: shop,
            score,
            comment: None,
        };

        let first = repository.upsert(review(3)).await.unwrap();
        let second = repository.upsert(review(5)).await.unwrap();

        assert_eq!(first.id, second.id);
        assert_eq!(second.score, 5);
        let listed = repository
            .list_by_shop(
                shop,
                Page {
                    limit: 10,
                    offset: 0,
                },
            )
            .await
            .unwrap();
        assert_eq!(listed.total, 1);
    }
}
