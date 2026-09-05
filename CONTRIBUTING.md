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

A green `pre-commit run --all-files` and a green test run mean the setup is
good.

See [README.md](README.md#getting-started) for running the API itself.

## Running the tests

The suite needs the Compose PostgreSQL up, and `DATABASE_URL` pointing at it.
Tests are isolated with `#[sqlx::test]`, which creates a throwaway database per
test and applies the migrations to it, so the connection string must point at a
server where the user may create databases — the Compose one does.

The whole suite:

```sh
DATABASE_URL=postgres://gruyereka:gruyereka@localhost:5432/gruyereka cargo test --manifest-path gruyereka-api/Cargo.toml
```

A single test:

```sh
DATABASE_URL=postgres://gruyereka:gruyereka@localhost:5432/gruyereka cargo test --manifest-path gruyereka-api/Cargo.toml treats_two_agings_as_two_cheeses
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

The test suite is deliberately **not** a hook: it needs a database and it only
gets slower. It runs in CI instead.

## Continuous integration

| Workflow | Triggers on | What it does | Reproduce locally |
| --- | --- | --- | --- |
| [quality.yaml](.github/workflows/quality.yaml) | every push to `main`, every pull request | `pre-commit run --all-files`, then `cargo test` against a PostgreSQL service | `pre-commit run --all-files` and the test command above |
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
