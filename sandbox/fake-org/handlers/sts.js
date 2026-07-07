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
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n${body}`,
  };
}

function handleAssumeRole(params) {
  const roleArn = params.RoleArn || "arn:aws:iam::123456789012:role/fake-role";
  const sessionName = params.RoleSessionName || "fake-session";
  const expiry = new Date(Date.now() + 3600 * 1000).toISOString();

  return xmlResponse(`<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
  <AssumeRoleResult>
    <Credentials>
      <SessionToken>FakeSessionToken123456789</SessionToken>
      <SecretAccessKey>fakeSecretKey1234567890123456789012345</SecretAccessKey>
      <Expiration>${xmlEscape(expiry)}</Expiration>
      <AccessKeyId>ASIAIOSFODNN7EXAMPLE</AccessKeyId>
    </Credentials>
    <AssumedRoleUser>
      <AssumedRoleId>AROAIOSFODNN7EXAMPLE:${xmlEscape(sessionName)}</AssumedRoleId>
      <Arn>${xmlEscape(roleArn)}</Arn>
    </AssumedRoleUser>
  </AssumeRoleResult>
  <ResponseMetadata>
    <RequestId>c6104cbe-af31-11e0-8154-cbc7ccf896c7</RequestId>
  </ResponseMetadata>
</AssumeRoleResponse>`);
}

function handleGetCallerIdentity() {
  return xmlResponse(`<GetCallerIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
  <GetCallerIdentityResult>
    <Arn>arn:aws:iam::123456789012:user/test</Arn>
    <UserId>AKIAIOSFODNN7EXAMPLE</UserId>
    <Account>123456789012</Account>
  </GetCallerIdentityResult>
  <ResponseMetadata>
    <RequestId>01234567-89ab-cdef-0123-456789abcdef</RequestId>
  </ResponseMetadata>
</GetCallerIdentityResponse>`);
}

function handle(req, body, orgData, params) {
  const action = params.Action;
  if (action === "AssumeRole") return handleAssumeRole(params);
  if (action === "GetCallerIdentity") return handleGetCallerIdentity();

  return {
    status: 400,
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0"?><Error><Code>InvalidAction</Code><Message>Unknown STS action: ${xmlEscape(action)}</Message></Error>`,
  };
}

module.exports = { handle };
