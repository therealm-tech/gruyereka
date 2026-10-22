use std::collections::HashMap;

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::{PgExecutor, PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::domain::tasting::{
    NewTasting, NewTastingItem, PricePerKg, RatingLevel, Tasting, TastingFilter, TastingItem,
    TastingPhoto, TastingUpdate,
};
use crate::repository::{AuthorScope, Page, Paginated, RepositoryError, Result, classify};

#[derive(Debug, sqlx::FromRow)]
struct TastingRow {
    id: Uuid,
    user_id: Uuid,
    shop_id: Uuid,
    tasted_on: NaiveDate,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct ItemRow {
    id: Uuid,
    tasting_id: Uuid,
    cheese_id: Uuid,
    rating: RatingLevel,
    price_per_kg_cents: Option<i64>,
    currency: Option<String>,
    comment: Option<String>,
}

impl From<ItemRow> for TastingItem {
    fn from(row: ItemRow) -> Self {
        // The `tasting_items_price_needs_currency` check keeps the two columns
        // in step, so zipping them can only drop a pair the database rejected.
        let price_per_kg = row
            .price_per_kg_cents
            .zip(row.currency)
            .map(|(cents, currency)| PricePerKg { cents, currency });
        Self {
            id: row.id,
            cheese_id: row.cheese_id,
            rating: row.rating,
            price_per_kg,
            comment: row.comment,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct PhotoRow {
    id: Uuid,
    tasting_id: Uuid,
    object_key: String,
}

impl From<PhotoRow> for TastingPhoto {
    fn from(row: PhotoRow) -> Self {
        Self {
            id: row.id,
            tasting_id: row.tasting_id,
            object_key: row.object_key,
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
        let mut transaction = self.pool.begin().await.map_err(classify)?;
        let id = Uuid::now_v7();
        let row = sqlx::query_as::<_, TastingRow>(
            "INSERT INTO tastings (id, user_id, shop_id, tasted_on)
             VALUES ($1, $2, $3, $4)
             RETURNING id, user_id, shop_id, tasted_on, created_at, updated_at",
        )
        .bind(id)
        .bind(tasting.user_id)
        .bind(tasting.shop_id)
        .bind(tasting.tasted_on)
        .fetch_one(&mut *transaction)
        .await
        .map_err(classify)?;

        let items = insert_items(&mut transaction, id, &tasting.items).await?;
        transaction.commit().await.map_err(classify)?;
        Ok(assemble(&row, items, Vec::new()))
    }

    pub async fn find(&self, id: Uuid) -> Result<Option<Tasting>> {
        let row = sqlx::query_as::<_, TastingRow>(
            "SELECT id, user_id, shop_id, tasted_on, created_at, updated_at
             FROM tastings WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?;

        let Some(row) = row else {
            return Ok(None);
        };
        let items = sqlx::query_as::<_, ItemRow>(
            "SELECT id, tasting_id, cheese_id, rating, price_per_kg_cents, currency, comment
             FROM tasting_items WHERE tasting_id = $1 ORDER BY id",
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await
        .map_err(classify)?;
        let photos = photos_by_tasting(&self.pool, &[id])
            .await?
            .remove(&id)
            .unwrap_or_default();

        Ok(Some(assemble(
            &row,
            items.into_iter().map(Into::into).collect(),
            photos,
        )))
    }

    /// The cheese filter matches a visit that *contains* that cheese, so a
    /// cheese's fiche lists the visits it appeared in rather than whole baskets
    /// it was absent from.
    pub async fn list(&self, filter: &TastingFilter, page: Page) -> Result<Paginated<Tasting>> {
        let total = sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM tastings t
             WHERE ($1::uuid IS NULL OR EXISTS (
                        SELECT 1 FROM tasting_items i
                        WHERE i.tasting_id = t.id AND i.cheese_id = $1))
                   AND ($2::uuid IS NULL OR t.shop_id = $2)
                   AND ($3::uuid IS NULL OR t.user_id = $3)",
        )
        .bind(filter.cheese_id)
        .bind(filter.shop_id)
        .bind(filter.user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(classify)?;

        let rows = sqlx::query_as::<_, TastingRow>(
            "SELECT t.id, t.user_id, t.shop_id, t.tasted_on, t.created_at, t.updated_at
             FROM tastings t
             WHERE ($1::uuid IS NULL OR EXISTS (
                        SELECT 1 FROM tasting_items i
                        WHERE i.tasting_id = t.id AND i.cheese_id = $1))
                   AND ($2::uuid IS NULL OR t.shop_id = $2)
                   AND ($3::uuid IS NULL OR t.user_id = $3)
             ORDER BY t.tasted_on DESC, t.created_at DESC
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

        // One query for the whole page's items rather than one per tasting: a
        // listing of thirty visits would otherwise be thirty-one round trips.
        let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
        let items = sqlx::query_as::<_, ItemRow>(
            "SELECT id, tasting_id, cheese_id, rating, price_per_kg_cents, currency, comment
             FROM tasting_items WHERE tasting_id = ANY($1) ORDER BY tasting_id, id",
        )
        .bind(&ids)
        .fetch_all(&self.pool)
        .await
        .map_err(classify)?;

        let mut photos = photos_by_tasting(&self.pool, &ids).await?;

        let mut by_tasting: HashMap<Uuid, Vec<TastingItem>> = HashMap::new();
        for item in items {
            by_tasting
                .entry(item.tasting_id)
                .or_default()
                .push(item.into());
        }

        Ok(Paginated {
            items: rows
                .into_iter()
                .map(|row| {
                    let items = by_tasting.remove(&row.id).unwrap_or_default();
                    let photos = photos.remove(&row.id).unwrap_or_default();
                    assemble(&row, items, photos)
                })
                .collect(),
            total,
        })
    }

    /// A tasting is somebody's own record, so `scope` normally pins it to its
    /// author and another author's row reads as not found rather than
    /// forbidden. Moderators pass `AnyAuthor`.
    ///
    /// The items are replaced wholesale: a correction is a new list, not a
    /// diff, so removing a cheese from a visit needs no separate operation.
    pub async fn update(
        &self,
        id: Uuid,
        scope: AuthorScope,
        update: TastingUpdate,
    ) -> Result<Tasting> {
        let mut transaction = self.pool.begin().await.map_err(classify)?;
        let row = sqlx::query_as::<_, TastingRow>(
            "UPDATE tastings SET tasted_on = $3, updated_at = now()
             WHERE id = $1 AND ($2::uuid IS NULL OR user_id = $2)
             RETURNING id, user_id, shop_id, tasted_on, created_at, updated_at",
        )
        .bind(id)
        .bind(scope.author_id())
        .bind(update.tasted_on)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(classify)?;

        // Checked before the items are touched, so somebody else's tasting is
        // left exactly as it was rather than emptied and refilled.
        let Some(row) = row else {
            return Err(RepositoryError::NotFound);
        };

        sqlx::query("DELETE FROM tasting_items WHERE tasting_id = $1")
            .bind(id)
            .execute(&mut *transaction)
            .await
            .map_err(classify)?;
        let items = insert_items(&mut transaction, id, &update.items).await?;
        let photos = photos_by_tasting(&mut *transaction, &[id])
            .await?
            .remove(&id)
            .unwrap_or_default();
        transaction.commit().await.map_err(classify)?;
        Ok(assemble(&row, items, photos))
    }

    /// Returns the photos the cascade took with it, whose objects the caller
    /// still has to remove from the store.
    pub async fn delete(&self, id: Uuid, scope: AuthorScope) -> Result<Vec<TastingPhoto>> {
        let mut transaction = self.pool.begin().await.map_err(classify)?;
        let photos = photos_by_tasting(&mut *transaction, &[id])
            .await?
            .remove(&id)
            .unwrap_or_default();
        let deleted = sqlx::query(
            "DELETE FROM tastings WHERE id = $1 AND ($2::uuid IS NULL OR user_id = $2)",
        )
        .bind(id)
        .bind(scope.author_id())
        .execute(&mut *transaction)
        .await
        .map_err(classify)?;
        if deleted.rows_affected() == 0 {
            return Err(RepositoryError::NotFound);
        }
        transaction.commit().await.map_err(classify)?;
        Ok(photos)
    }

    /// Fails with `NotFound` when the tasting is not within `scope`, and with
    /// `LimitReached` when it already holds `max` photos. Meant to be asked
    /// before the object is stored, so a refused upload costs no storage.
    pub async fn ensure_photo_room(&self, id: Uuid, scope: AuthorScope, max: i64) -> Result<()> {
        ensure_photo_room(&self.pool, id, scope, max).await
    }

    /// Re-checks the room under a lock on the tasting row: two uploads racing
    /// past `ensure_photo_room` must not take a full tasting over `max`.
    pub async fn add_photo(
        &self,
        photo: &TastingPhoto,
        scope: AuthorScope,
        max: i64,
    ) -> Result<()> {
        let mut transaction = self.pool.begin().await.map_err(classify)?;
        ensure_photo_room(&mut *transaction, photo.tasting_id, scope, max).await?;
        sqlx::query("INSERT INTO tasting_photos (id, tasting_id, object_key) VALUES ($1, $2, $3)")
            .bind(photo.id)
            .bind(photo.tasting_id)
            .bind(&photo.object_key)
            .execute(&mut *transaction)
            .await
            .map_err(classify)?;
        transaction.commit().await.map_err(classify)
    }

    pub async fn find_photo(
        &self,
        tasting_id: Uuid,
        photo_id: Uuid,
    ) -> Result<Option<TastingPhoto>> {
        let row = sqlx::query_as::<_, PhotoRow>(
            "SELECT id, tasting_id, object_key FROM tasting_photos
             WHERE id = $2 AND tasting_id = $1",
        )
        .bind(tasting_id)
        .bind(photo_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?;
        Ok(row.map(Into::into))
    }

    /// Same scope rule as deleting the tasting itself. Returns the removed
    /// photo so the caller can drop its object.
    pub async fn delete_photo(
        &self,
        tasting_id: Uuid,
        photo_id: Uuid,
        scope: AuthorScope,
    ) -> Result<TastingPhoto> {
        let row = sqlx::query_as::<_, PhotoRow>(
            "DELETE FROM tasting_photos p USING tastings t
             WHERE p.id = $2 AND p.tasting_id = $1 AND t.id = p.tasting_id
                   AND ($3::uuid IS NULL OR t.user_id = $3)
             RETURNING p.id, p.tasting_id, p.object_key",
        )
        .bind(tasting_id)
        .bind(photo_id)
        .bind(scope.author_id())
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?;
        row.map(Into::into).ok_or(RepositoryError::NotFound)
    }
}

async fn ensure_photo_room(
    executor: impl PgExecutor<'_>,
    tasting_id: Uuid,
    scope: AuthorScope,
    max: i64,
) -> Result<()> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT (SELECT count(*) FROM tasting_photos p WHERE p.tasting_id = t.id)
         FROM tastings t
         WHERE t.id = $1 AND ($2::uuid IS NULL OR t.user_id = $2)
         FOR UPDATE",
    )
    .bind(tasting_id)
    .bind(scope.author_id())
    .fetch_optional(executor)
    .await
    .map_err(classify)?
    .ok_or(RepositoryError::NotFound)?;
    if count >= max {
        return Err(RepositoryError::LimitReached);
    }
    Ok(())
}

/// One query for any number of tastings, oldest photo first in each.
async fn photos_by_tasting(
    executor: impl PgExecutor<'_>,
    ids: &[Uuid],
) -> Result<HashMap<Uuid, Vec<TastingPhoto>>> {
    let rows = sqlx::query_as::<_, PhotoRow>(
        "SELECT id, tasting_id, object_key FROM tasting_photos
         WHERE tasting_id = ANY($1) ORDER BY tasting_id, id",
    )
    .bind(ids)
    .fetch_all(executor)
    .await
    .map_err(classify)?;
    let mut by_tasting: HashMap<Uuid, Vec<TastingPhoto>> = HashMap::new();
    for row in rows {
        by_tasting
            .entry(row.tasting_id)
            .or_default()
            .push(row.into());
    }
    Ok(by_tasting)
}

fn assemble(row: &TastingRow, items: Vec<TastingItem>, photos: Vec<TastingPhoto>) -> Tasting {
    Tasting {
        id: row.id,
        user_id: row.user_id,
        shop_id: row.shop_id,
        tasted_on: row.tasted_on,
        items,
        photos,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

/// One statement per cheese rather than an `unnest` of seven arrays: a basket
/// holds a handful of cheeses, and the array form would need a `PgHasArrayType`
/// on the rating enum to buy back a round trip nobody is waiting on.
async fn insert_items(
    transaction: &mut Transaction<'_, Postgres>,
    tasting_id: Uuid,
    items: &[NewTastingItem],
) -> Result<Vec<TastingItem>> {
    let mut written = Vec::with_capacity(items.len());
    for item in items {
        let (cents, currency) = split_price(item.price_per_kg.as_ref());
        let row = sqlx::query_as::<_, ItemRow>(
            "INSERT INTO tasting_items
                 (id, tasting_id, cheese_id, rating, price_per_kg_cents, currency, comment)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, tasting_id, cheese_id, rating, price_per_kg_cents, currency, comment",
        )
        .bind(Uuid::now_v7())
        .bind(tasting_id)
        .bind(item.cheese_id)
        .bind(item.rating)
        .bind(cents)
        .bind(currency)
        .bind(&item.comment)
        .fetch_one(&mut **transaction)
        .await
        .map_err(classify)?;
        written.push(row.into());
    }
    Ok(written)
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
        NewTasting, NewTastingItem, PricePerKg, RatingLevel, TastingFilter, TastingUpdate,
    };
    use crate::repository::{AuthorScope, Page, RepositoryError};
    use crate::test_support::{a_cheese, a_shop, a_user};

    fn day(day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 9, day).expect("a valid date")
    }

    fn page() -> Page {
        Page {
            limit: 10,
            offset: 0,
        }
    }

    fn item(cheese: uuid::Uuid, rating: RatingLevel) -> NewTastingItem {
        NewTastingItem {
            cheese_id: cheese,
            rating,
            price_per_kg: Some(PricePerKg {
                cents: 3450,
                currency: "EUR".to_owned(),
            }),
            comment: None,
        }
    }

    #[sqlx::test]
    async fn keeps_every_visit_to_the_same_shop(pool: PgPool) {
        let author = a_user(&pool).await;
        let cheese = a_cheese(&pool, author, "Comté").await;
        let shop = a_shop(&pool, author, 1).await;
        let repository = TastingRepository::new(pool);
        let visit = |rating, on| NewTasting {
            user_id: author,
            shop_id: shop,
            tasted_on: on,
            items: vec![item(cheese, rating)],
        };

        repository
            .create(visit(RatingLevel::Good, day(1)))
            .await
            .unwrap();
        repository
            .create(visit(RatingLevel::Delicious, day(2)))
            .await
            .unwrap();

        let listed = repository
            .list(
                &TastingFilter {
                    cheese_id: Some(cheese),
                    ..TastingFilter::default()
                },
                page(),
            )
            .await
            .unwrap();

        assert_eq!(listed.total, 2, "a tasting is a log entry, not a rating");
        assert_eq!(listed.items[0].items[0].rating, RatingLevel::Delicious);
    }

    #[sqlx::test]
    async fn carries_several_cheeses_through_one_visit(pool: PgPool) {
        let author = a_user(&pool).await;
        let comte = a_cheese(&pool, author, "Comté").await;
        let brie = a_cheese(&pool, author, "Brie").await;
        let shop = a_shop(&pool, author, 4).await;
        let repository = TastingRepository::new(pool);

        let created = repository
            .create(NewTasting {
                user_id: author,
                shop_id: shop,
                tasted_on: day(1),
                items: vec![
                    item(comte, RatingLevel::Delicious),
                    item(brie, RatingLevel::Meh),
                ],
            })
            .await
            .unwrap();

        assert_eq!(created.items.len(), 2);
        // Each cheese keeps its own score: this is the whole reason the rating
        // hangs off the item and not off the visit.
        let scored: Vec<_> = created
            .items
            .iter()
            .map(|one| (one.cheese_id, one.rating))
            .collect();
        assert!(scored.contains(&(comte, RatingLevel::Delicious)));
        assert!(scored.contains(&(brie, RatingLevel::Meh)));

        // And each cheese finds the visit from its own side.
        for cheese in [comte, brie] {
            let listed = repository
                .list(
                    &TastingFilter {
                        cheese_id: Some(cheese),
                        ..TastingFilter::default()
                    },
                    page(),
                )
                .await
                .unwrap();
            assert_eq!(listed.total, 1);
            assert_eq!(
                listed.items[0].items.len(),
                2,
                "the whole basket comes back"
            );
        }
    }

    #[sqlx::test]
    async fn replaces_the_whole_basket_on_a_correction(pool: PgPool) {
        let author = a_user(&pool).await;
        let comte = a_cheese(&pool, author, "Comté").await;
        let brie = a_cheese(&pool, author, "Brie").await;
        let shop = a_shop(&pool, author, 5).await;
        let repository = TastingRepository::new(pool);
        let created = repository
            .create(NewTasting {
                user_id: author,
                shop_id: shop,
                tasted_on: day(1),
                items: vec![
                    item(comte, RatingLevel::Good),
                    item(brie, RatingLevel::Poor),
                ],
            })
            .await
            .unwrap();

        let corrected = repository
            .update(
                created.id,
                AuthorScope::Author(author),
                TastingUpdate {
                    tasted_on: day(2),
                    items: vec![item(comte, RatingLevel::Delicious)],
                },
            )
            .await
            .unwrap();

        assert_eq!(corrected.items.len(), 1, "the brie was dropped, not merged");
        assert_eq!(corrected.items[0].cheese_id, comte);
        assert_eq!(corrected.items[0].rating, RatingLevel::Delicious);
        assert_eq!(corrected.tasted_on, day(2));

        let dropped = repository
            .list(
                &TastingFilter {
                    cheese_id: Some(brie),
                    ..TastingFilter::default()
                },
                page(),
            )
            .await
            .unwrap();
        assert_eq!(dropped.total, 0, "the brie's own fiche loses the visit too");
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
                shop_id: shop,
                tasted_on: day(1),
                items: vec![item(cheese, RatingLevel::Meh)],
            })
            .await
            .unwrap();

        let hijacked = repository
            .update(
                tasting.id,
                AuthorScope::Author(stranger),
                TastingUpdate {
                    tasted_on: day(1),
                    items: vec![item(cheese, RatingLevel::Inedible)],
                },
            )
            .await;

        assert!(matches!(hijacked, Err(RepositoryError::NotFound)));
        // The refused correction must not have emptied the basket on its way
        // out: the scope is checked before a single item is deleted.
        let untouched = repository.find(tasting.id).await.unwrap().unwrap();
        assert_eq!(untouched.items.len(), 1);
        assert_eq!(untouched.items[0].rating, RatingLevel::Meh);

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
                shop_id: shop,
                tasted_on: day(1),
                items: vec![item(uuid::Uuid::now_v7(), RatingLevel::Good)],
            })
            .await;

        assert!(matches!(orphan, Err(RepositoryError::ForeignKeyViolation)));
        // The visit rolled back with the item that broke it.
        let nothing = repository
            .list(&TastingFilter::default(), page())
            .await
            .unwrap();
        assert_eq!(nothing.total, 0);
    }

    #[sqlx::test]
    async fn refuses_the_same_cheese_twice_in_one_visit(pool: PgPool) {
        let author = a_user(&pool).await;
        let cheese = a_cheese(&pool, author, "Comté").await;
        let shop = a_shop(&pool, author, 6).await;
        let repository = TastingRepository::new(pool);

        let doubled = repository
            .create(NewTasting {
                user_id: author,
                shop_id: shop,
                tasted_on: day(1),
                items: vec![
                    item(cheese, RatingLevel::Good),
                    item(cheese, RatingLevel::Poor),
                ],
            })
            .await;

        assert!(matches!(doubled, Err(RepositoryError::Conflict)));
    }
}
