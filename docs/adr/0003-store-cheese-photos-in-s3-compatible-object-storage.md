# 0003. Store cheese photos in S3-compatible object storage

- **Status**: accepted
- **Date**: 2026-09-05

## Context

A cheese carries an optional photo, taken on a phone and therefore measured in
megabytes rather than kilobytes. The API is a stateless service intended to run
as several replicas, and photos are read far more often than they are written.

## Decision

Photos live in an S3-compatible bucket, keyed `cheeses/<cheese id>`; the row
keeps the key. Uploads are `multipart/form-data` to the API, which checks the
declared content type and forwards the bytes. The bucket stays private: reads go
through `GET /api/v1/cheeses/{cheese_id}/photo`, which answers `307` to a
pre-signed URL valid for fifteen minutes. Development runs MinIO from the
Compose stack; anything speaking the S3 API works in production.

## Consequences

The service stays stateless, so replicas need no shared filesystem and a restart
loses nothing. Photo bytes leave the API on the write path only — reads are
served by the bucket directly, and the redirect keeps clients from having to
know anything about object storage. A leaked photo URL stops working once it
expires.

In exchange, the deployment now has a second store to provision, credential and
back up, and local development needs MinIO running before an upload can succeed.
Every photo read costs a signature and an extra round trip, and CDN caching in
front of it is awkward because the signed URL changes on every request. The
write path is not transactional: the object is stored before the row is updated,
so a failure between the two leaves an orphan object that nothing collects.

## Alternatives considered

**Bytes in a PostgreSQL column.** One store, one transaction, backups that
already cover it. It puts megabyte blobs through the connection pool and into
every dump, inflates the working set of a database sized for rows, and makes
serving an image the API's problem on every read.

**A local filesystem volume.** The simplest thing that works, and it pins the
service to one replica with a persistent volume — which is exactly the property
the rest of the design is built to avoid.

**A URL supplied by the client, with no upload at all.** No storage to operate,
and it makes the user find their own image host. Unusable from a mobile
application, which is the main way a photo of a cheese comes to exist.
