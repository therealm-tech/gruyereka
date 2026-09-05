use std::sync::Arc;

use aide::openapi::OpenApi;
use axum::Extension;
use axum::Json;
use axum::response::Html;

/// `aide` ships a vendored Scalar build whose CSS renders broken, so the page is
/// served by hand against the CDN. Trade-off: `/docs` needs network access.
const SCALAR_PAGE: &str = r#"<!doctype html>
<html>
  <head>
    <title>Gruyereka API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', { url: '/openapi.json' })
    </script>
  </body>
</html>
"#;

pub async fn openapi(Extension(api): Extension<Arc<OpenApi>>) -> Json<Arc<OpenApi>> {
    Json(api)
}

pub async fn scalar() -> Html<&'static str> {
    Html(SCALAR_PAGE)
}
