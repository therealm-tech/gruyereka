<p align="center">
  <img src="assets/logo.svg" alt="" width="128">
</p>

# gruyereka

Rate the cheese you bought, and the shop you bought it from.

## Description

Gruyereka records what a cheese tasted like *at the place it was bought*. A
cheese exists on its own — name, milks, paste, quality scheme, aging — and a
tasting ties it to one shop, on one day, with an optional price per kilogram and
a comment. Shops are reviewed separately, out of five.

- Cheeses are identified by name, milk types, paste and aging, so an 18-month
  Comté and a 36-month Comté are two different cheeses.
- Shops are identified by their OpenStreetMap reference, resolved by the client.
- Accounts hold one of three roles: a user owns their own ratings, a moderator
  rewrites and deletes anybody's, an administrator hands out the roles.
- A tasting is a dated log entry, not a mutable rating: tasting the same cheese
  at the same shop again adds an entry and keeps the price history.

The repository holds `gruyereka-api/`, the HTTP API, written in Rust.

The API speaks no human language: closed vocabularies travel as stable codes
(`DELICIOUS`, `PRESSED_COOKED`, `GOAT`) and clients hold the translations. User
content — cheese names, shop names, comments — is stored and returned exactly as
typed.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and the reasoning behind
it.

## Getting started

### Prerequisites

- Rust, installed through [rustup](https://rustup.rs) — the pinned toolchain in
  [rust-toolchain.toml](rust-toolchain.toml) is fetched automatically
- Docker ≥ 25, for the PostgreSQL and the object storage the API talks to

### Installation

```sh
git clone https://github.com/therealm-tech/gruyereka.git
```

```sh
cd gruyereka
```

```sh
docker compose up -d
```

The Compose stack brings up PostgreSQL and SeaweedFS, whose S3 gateway listens
on port 8333. The `gruyereka-photos` bucket is created on the first upload, so
there is nothing to provision.

### Configuration

Every option is settable on the command line and through an environment
variable; `gruyereka-api --help` is the full list.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `JWT_SECRET` | yes | — | HMAC key the access tokens are signed with |
| `S3_BUCKET` | yes | — | Bucket the cheese photos are stored in |
| `SUPER_ADMIN_PASSWORD` | yes | — | Password of the administrator account |
| `SUPER_ADMIN_USER` | no | `admin` | Display name of the administrator account |
| `SUPER_ADMIN_EMAIL` | no | `admin@gruyereka` | Address the administrator signs in with |
| `BIND_ADDR` | no | `0.0.0.0:8080` | Address the HTTP server binds to |
| `DATABASE_MAX_CONNECTIONS` | no | `10` | Upper bound of the connection pool |
| `LOG_FILTER` | no | `info` | `tracing` filter directive |
| `JWT_TTL_MINUTES` | no | `1440` | Lifetime of an access token |
| `S3_REGION` | no | `us-east-1` | S3 region |
| `S3_ENDPOINT_URL` | no | — | Endpoint of an S3-compatible service |
| `S3_PATH_STYLE` | no | `true` | Address buckets as a path, not a subdomain |
| `PHOTO_URL_TTL_SECONDS` | no | `900` | Lifetime of a pre-signed photo URL |
| `CORS_ALLOWED_ORIGINS` | no | — | Comma-separated browser origins |

The S3 credentials are read from the environment the AWS SDK expects
(`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or an instance role).

The database schema is applied by the API itself on startup; there is no
separate migration step.

The administrator account is reconciled on every startup from the three
`SUPER_ADMIN_*` variables: it is created if missing, and its password and role
are reapplied if they have drifted. That is also how an instance recovers from
losing its last administrator — restart it. The flip side is that changing that
account's password by any other means is undone on the next boot.

### Usage

```sh
DATABASE_URL=postgres://gruyereka:gruyereka@localhost:5432/gruyereka \
JWT_SECRET=change-me \
SUPER_ADMIN_PASSWORD=change-me-too \
S3_BUCKET=gruyereka-photos \
S3_ENDPOINT_URL=http://localhost:8333 \
AWS_ACCESS_KEY_ID=gruyereka \
AWS_SECRET_ACCESS_KEY=gruyereka-dev-secret \
cargo run --manifest-path gruyereka-api/Cargo.toml
```

The interactive API reference is then on <http://localhost:8080/docs>, the
OpenAPI document on <http://localhost:8080/openapi.json>, and the liveness probe
on <http://localhost:8080/healthz>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0 — see [LICENSE](LICENSE).
