mod api;
mod bootstrap;
mod cli;
mod domain;
mod photo;
mod repository;
mod secret;
mod telemetry;
#[cfg(test)]
mod test_support;

use std::sync::Arc;
use std::time::Duration;

use aws_config::BehaviorVersion;
use clap::Parser;
use jsonwebtoken::{DecodingKey, EncodingKey};
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;

use crate::api::state::{AppState, TokenConfig};
use crate::cli::Cli;
use crate::photo::PhotoStore;
use crate::repository::cheese::CheeseRepository;
use crate::repository::shop::ShopRepository;
use crate::repository::shop_review::ShopReviewRepository;
use crate::repository::tasting::TastingRepository;
use crate::repository::user::UserRepository;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    telemetry::init(&cli.log_filter);

    let pool = PgPoolOptions::new()
        .max_connections(cli.database_max_connections)
        .connect(cli.database_url.expose())
        .await?;
    tracing::debug!(
        max_connections = cli.database_max_connections,
        "database pool opened"
    );
    sqlx::migrate!().run(&pool).await?;
    tracing::info!("migrations applied");

    let users = UserRepository::new(pool.clone());
    bootstrap::ensure_super_admin(&users, &cli).await?;

    let state = AppState {
        users,
        cheeses: CheeseRepository::new(pool.clone()),
        shops: ShopRepository::new(pool.clone()),
        tastings: TastingRepository::new(pool.clone()),
        shop_reviews: ShopReviewRepository::new(pool),
        photos: photo_store(&cli).await,
        tokens: Arc::new(TokenConfig {
            encoding: EncodingKey::from_secret(cli.jwt_secret.expose().as_bytes()),
            decoding: DecodingKey::from_secret(cli.jwt_secret.expose().as_bytes()),
            ttl_minutes: cli.jwt_ttl_minutes,
        }),
    };

    let router = api::build(state, &cli.cors_allowed_origins)?;
    let listener = TcpListener::bind(cli.bind_addr).await?;
    tracing::info!(addr = %cli.bind_addr, "listening");
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    tracing::info!("shutdown complete");
    Ok(())
}

async fn photo_store(cli: &Cli) -> PhotoStore {
    let mut loader = aws_config::defaults(BehaviorVersion::latest())
        .region(aws_config::Region::new(cli.s3_region.clone()));
    if let Some(endpoint) = &cli.s3_endpoint_url {
        loader = loader.endpoint_url(endpoint);
    }
    let config = aws_sdk_s3::config::Builder::from(&loader.load().await)
        .force_path_style(cli.s3_path_style)
        .build();
    PhotoStore::new(
        aws_sdk_s3::Client::from_conf(config),
        cli.s3_bucket.clone(),
        Duration::from_secs(cli.photo_url_ttl_seconds),
    )
}

/// Completes on SIGTERM or SIGINT so an in-flight request is served to the end
/// rather than cut off when the container is stopped.
async fn shutdown_signal() {
    use tokio::signal::unix::{SignalKind, signal};

    let mut interrupt = signal(SignalKind::interrupt()).expect("SIGINT handler");
    let mut terminate = signal(SignalKind::terminate()).expect("SIGTERM handler");
    tokio::select! {
        _ = interrupt.recv() => {},
        _ = terminate.recv() => {},
    }
    tracing::info!("shutdown signal received, draining");
}
