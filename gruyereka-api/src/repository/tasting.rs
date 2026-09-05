use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::tasting::{
    NewTasting, PricePerKg, RatingLevel, Tasting, TastingFilter, TastingUpdate,
};
use crate::repository::{AuthorScope, Page, Paginated, RepositoryError, Result, classify};

#[derive(Debug, sqlx::FromRow)]
struct TastingRow {
    id: Uuid,
    user_id: Uuid,
    cheese_id: Uuid,
    shop_id: Uuid,
    rating: RatingLevel,
    price_per_kg_cents: Option<i64>,
    currency: Option<String>,
    comment: Option<String>,
    tasted_on: NaiveDate,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<TastingRow> for Tasting {
    fn from(row: TastingRow) -> Self {
        // The `tastings_price_needs_currency` check keeps the two columns in
        // step, so zipping them can only drop a pair the database rejected.
        let price_per_kg = row
            .price_per_kg_cents
            .zip(row.currency)
            .map(|(cents, currency)| PricePerKg { cents, currency });
        Self {
            id: row.id,
            user_id: row.user_id,
            cheese_id: row.cheese_id,
            shop_id: row.shop_id,
            rating: row.rating,
            price_per_kg,
            comment: row.comment,
            tasted_on: row.tasted_on,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, Clone)]
pub struct TastingRepository {
    pool: PgPool,
}

impl TastingRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, tasting: NewTasting) -> Result<Tasting> {
        let id = Uuid::now_v7();
        let (cents, currency) = split_price(tasting.price_per_kg.as_ref());
        let row = sqlx::query_as::<_, TastingRow>(
            "INSERT INTO tastings
                 (id, user_id, cheese_id, shop_id, rating, price_per_kg_cents, currency,
                  comment, tasted_on)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, user_id, cheese_id, shop_id, rating, price_per_kg_cents,
                    currency, comment, tasted_on, created_at, updated_at",
        )
        .bind(id)
        .bind(tasting.user_id)
        .bind(tasting.cheese_id)
        .bind(tasting.shop_id)
        .bind(tasting.rating)
        .bind(cents)
        .bind(currency)
        .bind(&tasting.comment)
        .bind(tasting.tasted_on)
        .fetch_one(&self.pool)
        .await
        .map_err(classify)?;
        Ok(row.into())
    }

    pub async fn find(&self, id: Uuid) -> Result<Option<Tasting>> {
        let row = sqlx::query_as::<_, TastingRow>("SELECT id, user_id, cheese_id, shop_id, rating, price_per_kg_cents,
                    currency, comment, tasted_on, created_at, updated_at FROM tastings WHERE id = $1")
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?;
        Ok(row.map(Into::into))
    }

    pub async fn list(&self, filter: &TastingFilter, page: Page) -> Result<Paginated<Tasting>> {
        let total = sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM tastings WHERE ($1::uuid IS NULL OR cheese_id = $1)
                   AND ($2::uuid IS NULL OR shop_id = $2)
                   AND ($3::uuid IS NULL OR user_id = $3)",
        )
        .bind(filter.cheese_id)
        .bind(filter.shop_id)
        .bind(filter.user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(classify)?;

        let rows = sqlx::query_as::<_, TastingRow>(
            "SELECT id, user_id, cheese_id, shop_id, rating, price_per_kg_cents,
                    currency, comment, tasted_on, created_at, updated_at FROM tastings
             WHERE ($1::uuid IS NULL OR cheese_id = $1)
                   AND ($2::uuid IS NULL OR shop_id = $2)
                   AND ($3::uuid IS NULL OR user_id = $3)
             ORDER BY tasted_on DESC, created_at DESC
             LIMIT $4 OFFSET $5",
        )
        .bind(filter.cheese_id)
        .bind(filter.shop_id)
        .bind(filter.user_id)
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

    /// A tasting is somebody's own record, so `scope` normally pins it to its
    /// author and another author's row reads as not found rather than
    /// forbidden. Moderators pass `AnyAuthor`.
    pub async fn update(
        &self,
        id: Uuid,
        scope: AuthorScope,
        update: TastingUpdate,
    ) -> Result<Tasting> {
        let (cents, currency) = split_price(update.price_per_kg.as_ref());
        let row = sqlx::query_as::<_, TastingRow>(
            "UPDATE tastings
             SET rating = $3, price_per_kg_cents = $4, currency = $5, comment = $6,
                 tasted_on = $7, updated_at = now()
             WHERE id = $1 AND ($2::uuid IS NULL OR user_id = $2)
             RETURNING id, user_id, cheese_id, shop_id, rating, price_per_kg_cents,
                    currency, comment, tasted_on, created_at, updated_at",
        )
        .bind(id)
        .bind(scope.author_id())
        .bind(update.rating)
        .bind(cents)
        .bind(currency)
        .bind(&update.comment)
        .bind(update.tasted_on)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?;
        row.map(Into::into).ok_or(RepositoryError::NotFound)
    }

    pub async fn delete(&self, id: Uuid, scope: AuthorScope) -> Result<()> {
        let deleted = sqlx::query(
            "DELETE FROM tastings WHERE id = $1 AND ($2::uuid IS NULL OR user_id = $2)",
        )
        .bind(id)
        .bind(scope.author_id())
        .execute(&self.pool)
        .await
        .map_err(classify)?;
        if deleted.rows_affected() == 0 {
            return Err(RepositoryError::NotFound);
        }
        Ok(())
    }
}

fn split_price(price: Option<&PricePerKg>) -> (Option<i64>, Option<&str>) {
    match price {
        Some(price) => (Some(price.cents), Some(price.currency.as_str())),
        None => (None, None),
    }
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use sqlx::PgPool;

    use super::TastingRepository;
    use crate::domain::tasting::{
        NewTasting, PricePerKg, RatingLevel, TastingFilter, TastingUpdate,
    };
    use crate::repository::{AuthorScope, Page, RepositoryError};
    use crate::test_support::{a_cheese, a_shop, a_user};

    fn day(day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 9, day).expect("a valid date")
    }

    #[sqlx::test]
    async fn keeps_every_tasting_of_the_same_cheese_at_the_same_shop(pool: PgPool) {
        let author = a_user(&pool).await;
        let cheese = a_cheese(&pool, author, "Comté").await;
        let shop = a_shop(&pool, author, 1).await;
        let repository = TastingRepository::new(pool);
        let entry = |rating, on| NewTasting {
            user_id: author,
            cheese_id: cheese,
            shop_id: shop,
            rating,
            price_per_kg: Some(PricePerKg {
                cents: 3450,
                currency: "EUR".to_owned(),
            }),
            comment: None,
            tasted_on: on,
        };

        repository
            .create(entry(RatingLevel::Good, day(1)))
            .await
            .unwrap();
        repository
            .create(entry(RatingLevel::Delicious, day(2)))
            .await
            .unwrap();

        let listed = repository
            .list(
                &TastingFilter {
                    cheese_id: Some(cheese),
                    ..TastingFilter::default()
                },
                Page {
                    limit: 10,
                    offset: 0,
                },
            )
            .await
            .unwrap();

        assert_eq!(listed.total, 2, "a tasting is a log entry, not a rating");
        assert_eq!(listed.items[0].rating, RatingLevel::Delicious);
    }

    #[sqlx::test]
    async fn refuses_to_rewrite_somebody_elses_tasting(pool: PgPool) {
        let author = a_user(&pool).await;
        let stranger = a_user(&pool).await;
        let cheese = a_cheese(&pool, author, "Comté").await;
        let shop = a_shop(&pool, author, 2).await;
        let repository = TastingRepository::new(pool);
        let tasting = repository
            .create(NewTasting {
                user_id: author,
                cheese_id: cheese,
                shop_id: shop,
                rating: RatingLevel::Meh,
                price_per_kg: None,
                comment: None,
                tasted_on: day(1),
            })
            .await
            .unwrap();

        let hijacked = repository
            .update(
                tasting.id,
                AuthorScope::Author(stranger),
                TastingUpdate {
                    rating: RatingLevel::Inedible,
                    price_per_kg: None,
                    comment: None,
                    tasted_on: day(1),
                },
            )
            .await;

        assert!(matches!(hijacked, Err(RepositoryError::NotFound)));
        // Attempted while the row is still there, so a failure means the scope
        // held rather than that the row had already gone.
        assert!(matches!(
            repository
                .delete(tasting.id, AuthorScope::Author(stranger))
                .await,
            Err(RepositoryError::NotFound)
        ));
        assert!(
            repository
                .delete(tasting.id, AuthorScope::AnyAuthor)
                .await
                .is_ok(),
            "a moderator reaches the same row"
        );
    }

    #[sqlx::test]
    async fn reports_an_unknown_cheese_as_a_broken_reference(pool: PgPool) {
        let author = a_user(&pool).await;
        let shop = a_shop(&pool, author, 3).await;
        let repository = TastingRepository::new(pool);

        let orphan = repository
            .create(NewTasting {
                user_id: author,
                cheese_id: uuid::Uuid::now_v7(),
                shop_id: shop,
                rating: RatingLevel::Good,
                price_per_kg: None,
                comment: None,
                tasted_on: day(1),
            })
            .await;

        assert!(matches!(orphan, Err(RepositoryError::ForeignKeyViolation)));
    }
}
