use std::net::SocketAddr;

use clap::Parser;

use crate::secret::Secret;

#[derive(Debug, Parser)]
#[command(version, about, long_about = None)]
pub struct Cli {
    /// Address the HTTP server binds to
    #[arg(long, env = "BIND_ADDR", default_value_t = SocketAddr::from(([0, 0, 0, 0], 8080)))]
    pub bind_addr: SocketAddr,

    /// PostgreSQL connection string
    ///
    // `hide_env_values` because clap prints the value of a set variable in
    // `--help`, and this one carries the database password.
    #[arg(long, env = "DATABASE_URL", hide_env_values = true)]
    pub database_url: Secret,

    /// Upper bound of the PostgreSQL connection pool
    #[arg(long, env = "DATABASE_MAX_CONNECTIONS", default_value_t = 10)]
    pub database_max_connections: u32,

    /// `tracing` filter directive (e.g. `info`, `gruyereka_api=debug,sqlx=warn`)
    ///
    /// Syntax: <https://docs.rs/tracing-subscriber/latest/tracing_subscriber/filter/struct.EnvFilter.html#directives>
    #[arg(long, env = "LOG_FILTER", default_value = "info")]
    pub log_filter: String,

    /// HMAC key the access tokens are signed with
    #[arg(long, env = "JWT_SECRET", hide_env_values = true)]
    pub jwt_secret: Secret,

    /// Lifetime of an access token, in minutes
    #[arg(long, env = "JWT_TTL_MINUTES", default_value_t = 1440)]
    pub jwt_ttl_minutes: u32,

    /// Display name of the administrator account reconciled at startup
    #[arg(long, env = "SUPER_ADMIN_USER", default_value = "admin")]
    pub super_admin_user: String,

    /// Address the administrator account signs in with
    #[arg(long, env = "SUPER_ADMIN_EMAIL", default_value = "admin@gruyereka")]
    pub super_admin_email: String,

    /// Password of the administrator account, reapplied at every startup
    #[arg(long, env = "SUPER_ADMIN_PASSWORD", hide_env_values = true)]
    pub super_admin_password: Secret,

    /// Bucket the cheese photos are stored in
    #[arg(long, env = "S3_BUCKET")]
    pub s3_bucket: String,

    /// S3 region
    #[arg(long, env = "S3_REGION", default_value = "us-east-1")]
    pub s3_region: String,

    /// S3 endpoint, for an S3-compatible service such as `SeaweedFS`
    #[arg(long, env = "S3_ENDPOINT_URL")]
    pub s3_endpoint_url: Option<String>,

    /// Address buckets as a path (`host/bucket`) instead of a subdomain
    #[arg(long, env = "S3_PATH_STYLE", default_value_t = true, action = clap::ArgAction::Set)]
    pub s3_path_style: bool,

    /// Lifetime of the pre-signed photo URLs, in seconds
    #[arg(long, env = "PHOTO_URL_TTL_SECONDS", default_value_t = 900)]
    pub photo_url_ttl_seconds: u64,

    /// Origins allowed to call the API from a browser; repeat for several
    #[arg(long, env = "CORS_ALLOWED_ORIGINS", value_delimiter = ',')]
    pub cors_allowed_origins: Vec<String>,
}
