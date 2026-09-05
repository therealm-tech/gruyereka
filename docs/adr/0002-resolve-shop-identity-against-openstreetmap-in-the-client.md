# 0002. Resolve shop identity against OpenStreetMap in the client

- **Status**: accepted
- **Date**: 2026-09-05

## Context

A rating is tied to the place the cheese was bought, so two people rating the
same cheesemonger have to land on the same shop row. Free-text names do not do
that: "Fromagerie Dupont", "fromagerie dupont" and "From. Dupont" are three rows
for one shop. A free-text address does not either — it moves the normalisation
problem from the name to the street line without solving it.

An address also has to be structured rather than a single string if the shops
are ever to appear on a map, which is the obvious next thing to want from a
model that already knows where cheese was bought.

## Decision

A shop is identified by its OpenStreetMap reference, the pair
`(osm_element, osm_id)`, under a unique constraint. The client resolves the shop
against Nominatim — or any other OpenStreetMap geocoder — before creating it,
and posts the reference together with the address and coordinates it got back.
The API stores those as cached attributes and never contacts OpenStreetMap
itself.

## Consequences

Deduplication becomes exact for every shop that exists in OpenStreetMap, and the
coordinates arrive for free, so a map is a client feature rather than a schema
change. The API keeps no outbound dependency: no Nominatim usage policy to
respect, no rate limit to back off from, no geocoder outage that blocks shop
creation, and nothing to stub in the test suite.

The cost is that the API trusts the client on the address. Nothing stops a
caller from posting a real OSM id with a made-up street, and nothing detects it
afterwards; the API validates the shape of an address, never its truth. Two
clients that resolve different references for the same physical shop — a node
and the way of the building around it — still create two rows, and there is no
merge operation to reconcile them. A shop that is simply not in OpenStreetMap
cannot be created at all until somebody adds it there.

Every client now has to implement a geocoder search before its shop-creation
form, which is real work repeated per platform.

## Alternatives considered

**A structured address normalised by the API.** Street, postal code, city and
country under a unique constraint on their folded form. No external dependency,
but abbreviations, building numbers and missing postal codes make the
normalisation approximate — it reduces duplicates rather than removing them, and
it gives no coordinates.

**The API queries Nominatim itself at creation time.** It would let the server
verify the address instead of trusting it. It puts a third-party service, its
usage policy and its availability on the write path of the product, in exchange
for validating a field nobody reads critically.

**Coordinates and a proximity rule.** Two shops within some radius are the same
shop. It needs PostGIS and a fuzzy matching rule that is wrong at both ends —
merging two units of the same market hall, splitting one shop whose GPS fix
drifted.
