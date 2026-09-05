use aws_sdk_s3::Client;
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream;
use std::time::Duration;

/// Object storage for the cheese photos. Objects stay private: the API hands out
/// short-lived pre-signed URLs instead of making the bucket public, so a photo
/// cannot be scraped once the URL has expired.
#[derive(Debug, Clone)]
pub struct PhotoStore {
    client: Client,
    bucket: String,
    url_ttl: Duration,
}

#[derive(Debug, thiserror::Error)]
pub enum PhotoStoreError {
    #[error("could not store the photo")]
    Upload(#[source] Box<dyn std::error::Error + Send + Sync>),
    #[error("could not sign a photo URL")]
    Presign(#[source] Box<dyn std::error::Error + Send + Sync>),
}

impl PhotoStore {
    pub fn new(client: Client, bucket: String, url_ttl: Duration) -> Self {
        Self {
            client,
            bucket,
            url_ttl,
        }
    }

    #[tracing::instrument(skip(self, body), fields(bucket = %self.bucket, bytes = body.len()))]
    pub async fn put(
        &self,
        key: &str,
        content_type: &str,
        body: Vec<u8>,
    ) -> Result<(), PhotoStoreError> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .content_type(content_type)
            .body(ByteStream::from(body))
            .send()
            .await
            .map_err(|error| PhotoStoreError::Upload(Box::new(error)))?;
        tracing::debug!(key, "photo stored");
        Ok(())
    }

    #[tracing::instrument(skip(self), fields(bucket = %self.bucket))]
    pub async fn presigned_url(&self, key: &str) -> Result<String, PhotoStoreError> {
        let config = PresigningConfig::expires_in(self.url_ttl)
            .map_err(|error| PhotoStoreError::Presign(Box::new(error)))?;
        let request = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .presigned(config)
            .await
            .map_err(|error| PhotoStoreError::Presign(Box::new(error)))?;
        Ok(request.uri().to_string())
    }
}
