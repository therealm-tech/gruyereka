use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::cheese::{
    Cheese, CheeseSummary, MilkType, NewCheese, PasteType, ProtectedDesignation, normalize_name,
};
use crate::repository::{Page, Paginated, Result, classify};

#[derive(Debug, sqlx::FromRow)]
struct CheeseRow {
    id: Uuid,
    name: String,
    milk_types: Vec<MilkType>,
    paste_type: PasteType,
    designation: Option<ProtectedDesignation>,
    aging_months: Option<i32>,
    photo_key: Option<String>,
    created_by: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<CheeseRow> for Cheese {
    fn from(row: CheeseRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            milk_types: row.milk_types,
            paste_type: row.paste_type,
            designation: row.designation,
            aging_months: row.aging_months,
            photo_key: row.photo_key,
            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct CheeseSummaryRow {
    #[sqlx(flatten)]
    cheese: CheeseRow,
    tasting_count: i64,
    average_score: Option<f64>,
}

impl From<CheeseSummaryRow> for CheeseSummary {
    fn from(row: CheeseSummaryRow) -> Self {
        Self {
            cheese: row.cheese.into(),
            tasting_count: row.tasting_count,
            average_score: row.average_score,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CheeseRepository {
    pool: PgPool,
}

impl CheeseRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, cheese: NewCheese) -> Result<Cheese> {
        let id = Uuid::now_v7();
        let row = sqlx::query_as::<_, CheeseRow>(
            "INSERT INTO cheeses
                 (id, name, normalized_name, milk_types, paste_type, designation,
                  aging_months, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, name, milk_types, paste_type, designation, aging_months,
                    photo_key, created_by, created_at, updated_at",
        )
        .bind(id)
        .bind(&cheese.name)
        .bind(normalize_name(&cheese.name))
        .bind(&cheese.milk_types)
        .bind(cheese.paste_type)
        .bind(cheese.designation)
        .bind(cheese.aging_months)
        .bind(cheese.created_by)
        .fetch_one(&self.pool)
        .await
        .map_err(classify)?;
        Ok(row.into())
    }

    pub async fn find(&self, id: Uuid) -> Result<Option<Cheese>> {
        let row = sqlx::query_as::<_, CheeseRow>(
            "SELECT id, name, milk_types, paste_type, designation, aging_months,
                    photo_key, created_by, created_at, updated_at FROM cheeses WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?;
        Ok(row.map(Into::into))
    }

    pub async fn summary(&self, id: Uuid) -> Result<Option<CheeseSummary>> {
        let row = sqlx::query_as::<_, CheeseSummaryRow>(
            "SELECT id, name, milk_types, paste_type, designation, aging_months,
                    photo_key, created_by, created_at, updated_at,
                    (SELECT count(*) FROM tasting_items i WHERE i.cheese_id = c.id)
                        AS tasting_count,
                    (SELECT avg(rating_score(i.rating))::double precision
                     FROM tasting_items i WHERE i.cheese_id = c.id)
                        AS average_score
             FROM cheeses c WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?;
        Ok(row.map(Into::into))
    }

    /// `search` matches the normalized name, so "comte" finds "Comté".
    pub async fn list(&self, search: Option<&str>, page: Page) -> Result<Paginated<CheeseSummary>> {
        let pattern = search.map(|term| format!("%{}%", normalize_name(term)));

        let total = sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM cheeses
             WHERE $1::text IS NULL OR normalized_name LIKE $1",
        )
        .bind(pattern.as_deref())
        .fetch_one(&self.pool)
        .await
        .map_err(classify)?;

        let rows = sqlx::query_as::<_, CheeseSummaryRow>(
            "SELECT id, name, milk_types, paste_type, designation, aging_months,
                    photo_key, created_by, created_at, updated_at,
                    (SELECT count(*) FROM tasting_items i WHERE i.cheese_id = c.id)
                        AS tasting_count,
                    (SELECT avg(rating_score(i.rating))::double precision
                     FROM tasting_items i WHERE i.cheese_id = c.id)
                        AS average_score
             FROM cheeses c
             WHERE $1::text IS NULL OR normalized_name LIKE $1
             ORDER BY normalized_name, aging_months NULLS FIRST
             LIMIT $2 OFFSET $3",
        )
        .bind(pattern.as_deref())
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

    pub async fn set_photo_key(&self, id: Uuid, photo_key: &str) -> Result<Cheese> {
        let row = sqlx::query_as::<_, CheeseRow>(
            "UPDATE cheeses SET photo_key = $2, updated_at = now()
             WHERE id = $1
             RETURNING id, name, milk_types, paste_type, designation, aging_months,
                    photo_key, created_by, created_at, updated_at",
        )
        .bind(id)
        .bind(photo_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?;
        row.map(Into::into).ok_or(super::RepositoryError::NotFound)
    }
}

#[cfg(test)]
mod tests {
    use sqlx::PgPool;

    use super::CheeseRepository;
    use crate::domain::cheese::{MilkType, NewCheese, PasteType};
    use crate::repository::{Page, RepositoryError};
    use crate::test_support::a_user;

    fn comte(author: uuid::Uuid, name: &str, aging_months: Option<i32>) -> NewCheese {
        NewCheese {
            name: name.to_owned(),
            milk_types: vec![MilkType::Cow],
            paste_type: PasteType::PressedCooked,
            designation: None,
            aging_months,
            created_by: author,
        }
    }

    #[sqlx::test]
    async fn rejects_a_cheese_that_only_differs_by_spelling(pool: PgPool) {
        let author = a_user(&pool).await;
        let repository = CheeseRepository::new(pool);

        repository
            .create(comte(author, "Comté", None))
            .await
            .unwrap();
        let again = repository.create(comte(author, "  comte  ", None)).await;

        assert!(matches!(again, Err(RepositoryError::Conflict)));
    }

    #[sqlx::test]
    async fn treats_two_agings_as_two_cheeses(pool: PgPool) {
        let author = a_user(&pool).await;
        let repository = CheeseRepository::new(pool);

        repository
            .create(comte(author, "Comté", Some(18)))
            .await
            .unwrap();
        repository
            .create(comte(author, "Comté", Some(36)))
            .await
            .unwrap();
        let unspecified = repository.create(comte(author, "Comté", None)).await;

        assert!(unspecified.is_ok(), "an unstated aging is its own cheese");
    }

    #[sqlx::test]
    async fn ignores_the_order_of_the_milk_types(pool: PgPool) {
        let author = a_user(&pool).await;
        let repository = CheeseRepository::new(pool);
        let mixed = |milks: Vec<MilkType>| NewCheese {
            name: "Tomme".to_owned(),
            milk_types: milks,
            paste_type: PasteType::PressedUncooked,
            designation: None,
            aging_months: None,
            created_by: author,
        };

        repository
            .create(mixed(vec![MilkType::Cow, MilkType::Goat]))
            .await
            .unwrap();
        let reordered = repository
            .create(mixed(vec![MilkType::Goat, MilkType::Cow]))
            .await;

        assert!(matches!(reordered, Err(RepositoryError::Conflict)));
    }

    #[sqlx::test]
    async fn separates_two_tommes_made_from_different_milks(pool: PgPool) {
        let author = a_user(&pool).await;
        let repository = CheeseRepository::new(pool);
        let tomme = |milk: MilkType| NewCheese {
            name: "Tomme".to_owned(),
            milk_types: vec![milk],
            paste_type: PasteType::PressedUncooked,
            designation: None,
            aging_months: None,
            created_by: author,
        };

        repository.create(tomme(MilkType::Cow)).await.unwrap();
        let goat = repository.create(tomme(MilkType::Goat)).await;

        assert!(goat.is_ok(), "a generic name is shared by several cheeses");
    }

    #[sqlx::test]
    async fn searches_without_accents(pool: PgPool) {
        let author = a_user(&pool).await;
        let repository = CheeseRepository::new(pool);
        repository
            .create(comte(author, "Comté", None))
            .await
            .unwrap();
        repository
            .create(comte(author, "Beaufort", None))
            .await
            .unwrap();

        let found = repository
            .list(
                Some("comte"),
                Page {
                    limit: 10,
                    offset: 0,
                },
            )
            .await
            .unwrap();

        assert_eq!(found.total, 1);
        assert_eq!(found.items[0].cheese.name, "Comté");
        assert_eq!(found.items[0].tasting_count, 0);
    }
}
