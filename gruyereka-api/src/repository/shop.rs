use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::shop::{NewShop, OsmElement, OsmRef, Shop, ShopKind, ShopSummary};
use crate::repository::{Page, Paginated, Result, classify};

#[derive(Debug, sqlx::FromRow)]
struct ShopRow {
    id: Uuid,
    name: String,
    kind: ShopKind,
    osm_element: OsmElement,
    osm_id: i64,
    street: Option<String>,
    postal_code: Option<String>,
    city: String,
    country_code: String,
    latitude: f64,
    longitude: f64,
    created_by: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<ShopRow> for Shop {
    fn from(row: ShopRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            kind: row.kind,
            osm_ref: OsmRef {
                element: row.osm_element,
                id: row.osm_id,
            },
            street: row.street,
            postal_code: row.postal_code,
            city: row.city,
            country_code: row.country_code,
            latitude: row.latitude,
            longitude: row.longitude,
            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct ShopSummaryRow {
    #[sqlx(flatten)]
    shop: ShopRow,
    review_count: i64,
    average_score: Option<f64>,
}

impl From<ShopSummaryRow> for ShopSummary {
    fn from(row: ShopSummaryRow) -> Self {
        Self {
            shop: row.shop.into(),
            review_count: row.review_count,
            average_score: row.average_score,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ShopRepository {
    pool: PgPool,
}

impl ShopRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, shop: NewShop) -> Result<Shop> {
        let id = Uuid::now_v7();
        let row = sqlx::query_as::<_, ShopRow>(
            "INSERT INTO shops
                 (id, name, kind, osm_element, osm_id, street, postal_code, city,
                  country_code, latitude, longitude, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, name, kind, osm_element, osm_id, street, postal_code, city,
                    country_code, latitude, longitude, created_by, created_at, updated_at",
        )
        .bind(id)
        .bind(&shop.name)
        .bind(shop.kind)
        .bind(shop.osm_ref.element)
        .bind(shop.osm_ref.id)
        .bind(&shop.street)
        .bind(&shop.postal_code)
        .bind(&shop.city)
        .bind(&shop.country_code)
        .bind(shop.latitude)
        .bind(shop.longitude)
        .bind(shop.created_by)
        .fetch_one(&self.pool)
        .await
        .map_err(classify)?;
        Ok(row.into())
    }

    pub async fn summary(&self, id: Uuid) -> Result<Option<ShopSummary>> {
        let row = sqlx::query_as::<_, ShopSummaryRow>("SELECT id, name, kind, osm_element, osm_id, street, postal_code, city,
                    country_code, latitude, longitude, created_by, created_at, updated_at, (SELECT count(*) FROM shop_reviews r WHERE r.shop_id = s.id)
                        AS review_count,
                    (SELECT avg(r.score)::double precision
                     FROM shop_reviews r WHERE r.shop_id = s.id)
                        AS average_score FROM shops s WHERE id = $1")
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(classify)?;
        Ok(row.map(Into::into))
    }

    /// `city` filters on an exact, case-insensitive city name; `search` matches
    /// the shop name.
    pub async fn list(
        &self,
        search: Option<&str>,
        city: Option<&str>,
        page: Page,
    ) -> Result<Paginated<ShopSummary>> {
        let pattern = search.map(|term| format!("%{}%", term.to_lowercase()));

        let total = sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM shops WHERE ($1::text IS NULL OR lower(name) LIKE $1)
                   AND ($2::text IS NULL OR lower(city) = lower($2))",
        )
        .bind(pattern.as_deref())
        .bind(city)
        .fetch_one(&self.pool)
        .await
        .map_err(classify)?;

        let rows = sqlx::query_as::<_, ShopSummaryRow>("SELECT id, name, kind, osm_element, osm_id, street, postal_code, city,
                    country_code, latitude, longitude, created_by, created_at, updated_at, (SELECT count(*) FROM shop_reviews r WHERE r.shop_id = s.id)
                        AS review_count,
                    (SELECT avg(r.score)::double precision
                     FROM shop_reviews r WHERE r.shop_id = s.id)
                        AS average_score
             FROM shops s
             WHERE ($1::text IS NULL OR lower(name) LIKE $1)
                   AND ($2::text IS NULL OR lower(city) = lower($2))
             ORDER BY lower(name), id
             LIMIT $3 OFFSET $4")
        .bind(pattern.as_deref())
        .bind(city)
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
}
