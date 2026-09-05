use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
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
    pub page: Option<u32>,
    #[validate(range(min = 1, max = 100))]
    pub per_page: Option<u32>,
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
