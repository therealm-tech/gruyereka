# 0001. Keep accounts and passwords in the API

- **Status**: accepted
- **Date**: 2026-09-05

## Context

Every rating belongs to somebody: a tasting has an author, a shop review is
unique per author, and both are editable only by the person who wrote them. The
service therefore needs identities before it needs anything else.

The clients are a web front end and a mobile application, aimed at individuals
rather than at an organisation with an existing directory. There is no identity
provider in place, and no operational appetite to stand one up for a project
whose entire user model is "an email address and a display name".

## Decision

The API owns the accounts. It stores an email, a display name and an Argon2
password hash, and it issues its own HS256 JSON Web Tokens carrying the user id
as the subject. Registration and login are two endpoints of the product API; a
protected endpoint is one whose handler extracts the authenticated caller.

## Consequences

The service has no runtime dependency on anything to authenticate a request:
verifying a token is a signature check against a key held in memory, so an
identity provider being down cannot take the API down with it, and local
development needs no auth infrastructure at all.

Against that, we now own password handling — hashing parameters, reset flows,
credential-stuffing defences, breach response — which is security-sensitive code
that is never finished. Tokens are stateless and therefore cannot be revoked: a
token stays valid until it expires, and changing a password does not end
existing sessions. Adding a second authentication factor, or single sign-on for
an organisation, means building it rather than configuring it.

Moving to an external provider later is a migration, not a switch: existing
accounts have to be reconciled against provider subjects, and the `users` table
keeps a password column that nothing writes.

## Alternatives considered

**An external OIDC provider (Keycloak, Authentik, a public identity provider).**
The API would validate provider-issued tokens and keep only a profile row. It
removes the password code entirely and brings revocation, multi-factor and
single sign-on for free. It loses on operations: another service to run, keep
patched and keep available, on the critical path of every login, for a project
whose only account attribute is an email address.

**No accounts at all.** A single implicit user, deferring identity. It is the
fastest thing to build and it makes the ratings meaningless — the whole model is
"who thought what, and where" — and retrofitting authorship onto rows that never
had an author is worse than writing it now.
