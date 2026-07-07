"use strict";

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlResponse(body) {
  return {
    status: 200,
    headers: { "Content-Type": "application/xml" },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n${body}`,
  };
}

function getBucket(orgData, name) {
  return orgData.s3.buckets.find((b) => b.name === name);
}

function handleListBuckets(orgData) {
  const bucketsXml = orgData.s3.buckets
    .map(
      (b) => `    <Bucket>
      <Name>${xmlEscape(b.name)}</Name>
      <CreationDate>2023-01-01T00:00:00.000Z</CreationDate>
    </Bucket>`
    )
    .join("\n");

  return xmlResponse(`<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner>
    <ID>acme-bank-owner-id</ID>
    <DisplayName>acme-bank</DisplayName>
  </Owner>
  <Buckets>
${bucketsXml}
  </Buckets>
</ListAllMyBucketsResult>`);
}

function handleGetPublicAccessBlock(bucketName, orgData) {
  const bucket = getBucket(orgData, bucketName);
  if (!bucket) {
    return {
      status: 404,
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0"?><Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message><BucketName>${xmlEscape(bucketName)}</BucketName></Error>`,
    };
  }

  if (!bucket.publicAccessBlock) {
    // Return error that means no block config — SDK catches NoSuchPublicAccessBlockConfiguration
    return {
      status: 404,
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0"?><Error><Code>NoSuchPublicAccessBlockConfiguration</Code><Message>The public access block configuration was not found</Message><BucketName>${xmlEscape(bucketName)}</BucketName></Error>`,
    };
  }

  return xmlResponse(`<PublicAccessBlockConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <BlockPublicAcls>true</BlockPublicAcls>
  <IgnorePublicAcls>true</IgnorePublicAcls>
  <BlockPublicPolicy>true</BlockPublicPolicy>
  <RestrictPublicBuckets>true</RestrictPublicBuckets>
</PublicAccessBlockConfiguration>`);
}

function handleGetBucketEncryption(bucketName, orgData) {
  const bucket = getBucket(orgData, bucketName);
  if (!bucket) {
    return {
      status: 404,
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0"?><Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message></Error>`,
    };
  }

  if (!bucket.encrypted) {
    return {
      status: 404,
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0"?><Error><Code>ServerSideEncryptionConfigurationNotFoundError</Code><Message>The server side encryption configuration was not found</Message></Error>`,
    };
  }

  return xmlResponse(`<ServerSideEncryptionConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Rule>
    <ApplyServerSideEncryptionByDefault>
      <SSEAlgorithm>AES256</SSEAlgorithm>
    </ApplyServerSideEncryptionByDefault>
    <BucketKeyEnabled>false</BucketKeyEnabled>
  </Rule>
</ServerSideEncryptionConfiguration>`);
}

function handleGetBucketVersioning(bucketName, orgData) {
  const bucket = getBucket(orgData, bucketName);
  if (!bucket) {
    return {
      status: 404,
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0"?><Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message></Error>`,
    };
  }

  const statusXml = bucket.versioned
    ? `<Status>Enabled</Status>`
    : ``;

  return xmlResponse(`<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  ${statusXml}
</VersioningConfiguration>`);
}

function handleGetBucketLogging(bucketName, orgData) {
  const bucket = getBucket(orgData, bucketName);
  if (!bucket) {
    return {
      status: 404,
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0"?><Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message></Error>`,
    };
  }

  if (!bucket.logging) {
    return xmlResponse(`<BucketLoggingStatus xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
</BucketLoggingStatus>`);
  }

  return xmlResponse(`<BucketLoggingStatus xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <LoggingEnabled>
    <TargetBucket>acme-logs</TargetBucket>
    <TargetPrefix>${xmlEscape(bucketName)}/</TargetPrefix>
  </LoggingEnabled>
</BucketLoggingStatus>`);
}

/**
 * Route S3 requests by path and query string.
 * Path-style: /<bucket>?<query>  or  / for list buckets
 */
function handle(req, body, orgData, params, url) {
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // List all buckets: GET /
  if (pathname === "/" || pathname === "") {
    return handleListBuckets(orgData);
  }

  // Extract bucket name from path: /<bucket> or /<bucket>/
  const parts = pathname.replace(/^\//, "").split("/");
  const bucketName = parts[0];

  if (!bucketName) return handleListBuckets(orgData);

  if (searchParams.has("publicAccessBlock") || req.url.includes("publicAccessBlock")) {
    return handleGetPublicAccessBlock(bucketName, orgData);
  }
  if (searchParams.has("encryption") || req.url.includes("encryption")) {
    return handleGetBucketEncryption(bucketName, orgData);
  }
  if (searchParams.has("versioning") || req.url.includes("versioning")) {
    return handleGetBucketVersioning(bucketName, orgData);
  }
  if (searchParams.has("logging") || req.url.includes("logging")) {
    return handleGetBucketLogging(bucketName, orgData);
  }

  // Default: treat as list buckets if no bucket-specific query
  return handleListBuckets(orgData);
}

module.exports = { handle };
