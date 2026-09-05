use tracing_subscriber::EnvFilter;

/// Logs go to stderr so that anything the process legitimately writes to stdout
/// stays machine-readable.
pub fn init(log_filter: &str) {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::new(log_filter))
        .with_writer(std::io::stderr)
        .init();
}
