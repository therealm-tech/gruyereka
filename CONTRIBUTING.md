# Contributing

Open an issue before a large change; small fixes can go straight to a pull
request. Everything below assumes a fresh clone.

## Development setup

You need:

- **Rust**, via [rustup](https://rustup.rs). The toolchain is pinned in
  [rust-toolchain.toml](rust-toolchain.toml) and rustup installs it on the first
  `cargo` invocation, `rustfmt` and `clippy` included.
- **Docker** ≥ 25, for the PostgreSQL the tests need and the SeaweedFS the API
  stores photos in.
- **pre-commit**, and a Python to run it. The hooks that are not local install
  themselves.
- **Go**, for the `actionlint` hook, which pre-commit builds from source.
- **Node.js** ≥ 22.12 and npm, for the web client. The `biome` and `tsc` hooks run
  the binaries from its own dependency tree, so they fail until it is installed.

Install pre-commit with a distro-neutral command:

```sh
uv tool install pre-commit
```

or, without `uv`:

```sh
python3 -m pip install --user pre-commit
```

Then, from the clone:

```sh
pre-commit install
```

```sh
docker compose up -d
```

```sh
cargo build --manifest-path gruyereka-api/Cargo.toml
```

```sh
npm --prefix gruyereka-web ci
```

Neither service needs variables exported to run locally:
[.cargo/config.toml](.cargo/config.toml) carries the API's development defaults
and [gruyereka-web/.env.development](gruyereka-web/.env.development) the web
client's. Both lose to a value already present in the environment, so pointing
either at something else is a matter of exporting it.

A green `pre-commit run --all-files` and two green test runs mean the setup is
good.

See [README.md](README.md#getting-started) for running the API and the web
client.

## Running the tests

There are two suites, one per service.

### The API

The suite needs the Compose PostgreSQL up. Tests are isolated with
`#[sqlx::test]`, which creates a throwaway database per test and applies the
migrations to it, so `DATABASE_URL` must point at a server where the user may
create databases — the Compose one does, and
[.cargo/config.toml](.cargo/config.toml) already points there.

The whole suite:

```sh
cargo test --manifest-path gruyereka-api/Cargo.toml
```

A single test:

```sh
cargo test --manifest-path gruyereka-api/Cargo.toml treats_two_agings_as_two_cheeses
```

Against another database, export the variable — an exported value wins over the
one in `.cargo/config.toml`:

```sh
DATABASE_URL=postgres://user:password@localhost:5433/scratch cargo test --manifest-path gruyereka-api/Cargo.toml
```

There are two kinds, both under `#[cfg(test)]` next to the code they cover:

- **Unit tests** — name normalisation, pagination arithmetic, password hashing,
  token round-trips, error field naming. No database, no network.
- **Database and HTTP tests** — the repositories, and the router driven through
  `tower`'s `oneshot`. These carry `#[sqlx::test]` and fail without
  `DATABASE_URL`.

Nothing touches the object storage: the S3 client is constructed in the test
state but no test exercises the photo routes, so SeaweedFS is not needed to run
the suite.

### The web client

Vitest with React Testing Library, needing neither a database nor a running
API: the components are driven through their rendered output, and the modules
that would call the API are not exercised here.

The whole suite:

```sh
npm --prefix gruyereka-web test
```

A single file, or watch mode while iterating:

```sh
npm --prefix gruyereka-web test -- src/lib/format.test.ts
```

```sh
npm --prefix gruyereka-web run test:watch
```

A change that adds behaviour comes with tests for it, and a fix comes with the
regression test that would have caught it.

## Pre-commit hooks

`pre-commit install` is part of the setup above, and the hooks must pass before
a push. The same hooks run in CI, so skipping them locally only moves the
failure somewhere slower — `--no-verify` and `SKIP=` are not the fix. A red hook
is a finding: fix the code, or change [.pre-commit-config.yaml](.pre-commit-config.yaml)
in the same pull request and say why.

Run everything:

```sh
pre-commit run --all-files
```

Re-run one hook while iterating:

```sh
pre-commit run cargo-clippy --all-files
```

| Hook | What it checks | How to fix |
| --- | --- | --- |
| `trailing-whitespace`, `end-of-file-fixer` | whitespace hygiene | fixes itself, re-run |
| `check-yaml`, `check-added-large-files`, `check-merge-conflict`, `detect-private-key` | files that should not be committed as they are | remove the offending content |
| `yamllint` | YAML style, block style only, per [.yamllint.yaml](.yamllint.yaml) | edit by hand |
| `sqlfluff-lint` | migration SQL against the PostgreSQL dialect, per [.sqlfluff](.sqlfluff) | `sqlfluff fix`, or edit by hand |
| `actionlint` | GitHub Actions workflow syntax and expressions | edit by hand |
| `cargo-fmt` | Rust formatting | `cargo fmt --all` |
| `cargo-clippy` | `clippy` with `pedantic`, warnings are errors | fix it; a scoped `#[allow]` needs a reason next to it |
| `biome` | web client formatting and linting, per [gruyereka-web/biome.json](gruyereka-web/biome.json) | `npm --prefix gruyereka-web run check:write` |
| `tsc` | web client types, `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | fix the type; a cast or a suppression needs a comment saying why it is safe |

Neither test suite is a hook: the API's needs a database and both only get
slower. They run in CI instead.

Tailwind's `@theme` and `@utility` at-rules are not understood by Biome's CSS
parser, so [gruyereka-web/src/app/globals.css](gruyereka-web/src/app/globals.css)
is excluded from it and is the one file no hook formats.

## Continuous integration

| Workflow | Triggers on | What it does | Reproduce locally |
| --- | --- | --- | --- |
| [quality.yaml](.github/workflows/quality.yaml) | every push to `main`, every pull request | `pre-commit run --all-files`; `cargo test` against a PostgreSQL service; the web client's Vitest suite and a production `next build` | `pre-commit run --all-files` and the two test commands above. CI exports its own `DATABASE_URL`, which takes precedence over `.cargo/config.toml` |
| [security.yaml](.github/workflows/security.yaml) | every push to `main`, every pull request, weekly | `trivy fs` on the checkout, blocking on fixable `HIGH`/`CRITICAL`, and a full SARIF report uploaded to code scanning | `trivy fs .` |

Both are required. The weekly run exists because a CVE is disclosed against code
nobody touched, so a scan on merge day says nothing about today.

The pipeline needs no secrets; the SARIF upload uses the workflow's own
`security-events: write` permission, which fork pull requests do not get — the
upload step is skipped there and the blocking scan still runs.

## Submitting a change

- Branch off `main`.
- Commit subjects are imperative, lowercase and short — read
  `git log --oneline` and follow what is there.
- A pull request lands green, with the documentation updated in the same change:
  a new environment variable belongs in [README.md](README.md), a design change
  in [ARCHITECTURE.md](ARCHITECTURE.md), and an architectural decision gets its
  own record under [docs/adr/](docs/adr/).
