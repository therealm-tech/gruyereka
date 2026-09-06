use schemars::JsonSchema;
use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize};
use validator::Validate;

use crate::repository::{Page, Paginated};

const DEFAULT_PER_PAGE: u32 = 50;
const MAX_PER_PAGE: u32 = 100;

/// Offset pagination, 1-based. Absent parameters fall back to the defaults; a
/// `perPage` above the ceiling is rejected rather than silently clamped, so a
/// client never believes it got more than it did.
#[derive(Debug, Clone, Deserialize, JsonSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct PaginationQuery {
    #[validate(range(min = 1))]
    #[serde(default, deserialize_with = "number_from_query")]
    pub page: Option<u32>,
    #[validate(range(min = 1, max = 100))]
    #[serde(default, deserialize_with = "number_from_query")]
    pub per_page: Option<u32>,
}

/// Every query struct embeds this one with `#[serde(flatten)]`, and flattening
/// makes serde buffer the whole query string into its internal `Content` before
/// handing it over — which loses the integer coercion `serde_urlencoded` would
/// otherwise apply, so `page=2` arrives as the string `"2"` and a bare
/// `Option<u32>` rejects it with a `400`. Accepting both forms is what keeps
/// pagination usable at all.
fn number_from_query<'de, D>(deserializer: D) -> Result<Option<u32>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Source {
        Number(u32),
        Text(String),
    }

    match Option::<Source>::deserialize(deserializer)? {
        None => Ok(None),
        Some(Source::Number(value)) => Ok(Some(value)),
        Some(Source::Text(text)) if text.is_empty() => Ok(None),
        Some(Source::Text(text)) => text
            .parse()
            .map(Some)
            .map_err(|_| D::Error::custom(format!("{text} is not a page number"))),
    }
}

impl PaginationQuery {
    pub fn page_number(&self) -> u32 {
        self.page.unwrap_or(1)
    }

    pub fn per_page(&self) -> u32 {
        self.per_page.unwrap_or(DEFAULT_PER_PAGE).min(MAX_PER_PAGE)
    }

    pub fn to_page(&self) -> Page {
        let per_page = i64::from(self.per_page());
        Page {
            limit: per_page,
            offset: (i64::from(self.page_number()) - 1) * per_page,
        }
    }
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PageResponse<T> {
    pub items: Vec<T>,
    pub page: u32,
    pub per_page: u32,
    /// Size of the whole filtered set, so a client can compute the page count.
    pub total: i64,
}

impl<T> PageResponse<T> {
    pub fn new<S>(page: &PaginationQuery, source: Paginated<S>, map: impl Fn(S) -> T) -> Self {
        Self {
            items: source.items.into_iter().map(map).collect(),
            page: page.page_number(),
            per_page: page.per_page(),
            total: source.total,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PaginationQuery;

    #[test]
    fn defaults_to_the_first_page() {
        let query = PaginationQuery {
            page: None,
            per_page: None,
        };

        let page = query.to_page();

        assert_eq!(page.limit, 50);
        assert_eq!(page.offset, 0);
    }

    #[test]
    fn reads_a_page_number_that_arrives_as_text() {
        // What flattening does to a query string: every value reaches serde as
        // a string, whatever the field's type says.
        let query: PaginationQuery =
            serde_json::from_str(r#"{"page": "2", "perPage": "25"}"#).unwrap();

        assert_eq!(query.page, Some(2));
        assert_eq!(query.per_page, Some(25));
    }

    #[test]
    fn still_reads_a_page_number_that_arrives_as_a_number() {
        let query: PaginationQuery = serde_json::from_str(r#"{"page": 2}"#).unwrap();

        assert_eq!(query.page, Some(2));
        assert_eq!(query.per_page, None);
    }

    #[test]
    fn treats_an_empty_parameter_as_absent() {
        let query: PaginationQuery = serde_json::from_str(r#"{"page": ""}"#).unwrap();

        assert_eq!(query.page, None);
    }

    #[test]
    fn refuses_a_page_that_is_not_a_number() {
        let parsed = serde_json::from_str::<PaginationQuery>(r#"{"page": "deux"}"#);

        assert!(parsed.is_err());
    }

    #[test]
    fn turns_a_page_number_into_an_offset() {
        let query = PaginationQuery {
            page: Some(3),
            per_page: Some(20),
        };

        let page = query.to_page();

        assert_eq!(page.limit, 20);
        assert_eq!(page.offset, 40);
    }
}
