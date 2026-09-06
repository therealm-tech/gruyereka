# 0004. Render the web client on its own server

- **Status**: accepted
- **Date**: 2026-09-05

## Context

Gruyereka is a discovery product: the value of a rating is that somebody else
finds it. Cheese and shop fiches are public — `GET /cheeses`, `GET /shops`,
`GET /tastings` and `GET /shops/{id}/reviews` take no credentials — so they are
the surface people search for and link to.

Search engines are not the binding constraint. Googlebot runs JavaScript, so a
single-page application does get indexed, late but reliably. Link unfurlers do
not: Slack, WhatsApp, Signal, Discord and LinkedIn read the HTML a URL returns
and stop there. On a client-rendered application, sharing a shop link produces
an empty preview — which is the gesture the product is built around.

The API issues a bearer token with no refresh and no revocation. A browser
application has to keep it somewhere. `localStorage` hands it to any script
that runs on the page; an in-memory token signs the user out on every reload.

## Decision

The web client is `gruyereka-web`, a Next.js application running as its own
process. Public pages are rendered on that server, which fetches the API
server-to-server and emits complete HTML with its metadata, canonical link,
`schema.org` payload and sitemap.

The access token lives in an httpOnly, `SameSite=Lax` cookie that this server
sets from its own sign-in action. The browser talks only to the web server; the
web server attaches the bearer when it calls the API. Photos are relayed the
same way: a route on the web server follows the API's redirect and hands the
short-lived bucket URL back to the browser.

## Consequences

A shared fiche unfurls with its name, its rating and its description, and it is
indexable the day it is published rather than whenever a renderer gets to it.
Page state that matters — the search query, the page number — lives in the URL,
so a result page is shareable and works without JavaScript.

The token never reaches page JavaScript, so a cross-site scripting hole cannot
exfiltrate it, and a reload keeps the session. Because the browser never calls
the API, the web client needs no CORS grant: `CORS_ALLOWED_ORIGINS` stays for
the other clients.

The costs are real. There is now a Node process to deploy, watch and patch
beside the Rust service, and a second hop on every request. That server holds
credentials, which makes it a thing to secure rather than a static bundle on a
CDN. Two places now know the API's wire contract, and they can drift: the web
client re-declares the schemas it parses, and a change to the API has to land
in both. Every authenticated write goes through a server action rather than
straight to the API, so each one is written twice — once as an API operation,
once as the action that forwards it.

The mobile client, when it comes, does not get any of this. It talks to the API
directly with a bearer token it stores itself, so authentication has two shapes
in the system rather than one.

## Alternatives considered

**A static single-page application.** The natural neighbour of a separate API:
no second runtime, no credential on a server, deployable to any file host. It
loses link previews entirely and delays indexing, which is the whole point of
making the fiches public.

**Prerendering the public pages at build time.** Keeps the static deployment
and fixes the unfurling. Cheeses and shops are user-generated and change
continuously, so it needs on-demand regeneration — at which point a server is
running anyway.

**A single-page application with the token in `localStorage`.** One less
component and a session that survives reloads. Any injected script can read the
token, and the API cannot revoke it once taken.

**Serving the client from `gruyereka-api` itself.** One process, one origin, no
CORS. It puts templating and asset serving in the Rust service, and it couples
the release of a screen to the release of the API.
