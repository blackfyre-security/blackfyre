"use strict";

/**
 * KMS uses AWS JSON 1.1 protocol (X-Amz-Target: TrentService.*)
 */

function jsonResponse(obj) {
  return {
    status: 200,
    headers: { "Content-Type": "application/x-amz-json-1.1" },
    body: JSON.stringify(obj),
  };
}

function handleListKeys(orgData) {
  const keys = orgData.kms.keys.map((k) => ({
    KeyId: k.id,
    KeyArn: k.arn,
  }));
  return jsonResponse({ Keys: keys, Truncated: false });
}

function handleDescribeKey(body, orgData) {
  let parsedBody = {};
  try {
    parsedBody = typeof body === "string" ? JSON.parse(body) : body;
  } catch (_) {}

  const keyId = parsedBody.KeyId;
  const key = orgData.kms.keys.find((k) => k.id === keyId || k.arn === keyId);

  if (!key) {
    return {
      status: 400,
      headers: { "Content-Type": "application/x-amz-json-1.1" },
      body: JSON.stringify({
        __type: "NotFoundException",
        message: `Invalid keyId ${keyId}`,
      }),
    };
  }

  return jsonResponse({
    KeyMetadata: {
      KeyId: key.id,
      Arn: key.arn,
      KeyState: key.state,
      KeyManager: key.manager,
      KeySpec: key.spec,
      KeyUsage: "ENCRYPT_DECRYPT",
      Enabled: key.state === "Enabled",
      CreationDate: 1672531200,
      Description: "Fake KMS key",
      MultiRegion: false,
    },
  });
}

function handleGetKeyRotationStatus(body, orgData) {
  let parsedBody = {};
  try {
    parsedBody = typeof body === "string" ? JSON.parse(body) : body;
  } catch (_) {}

  const keyId = parsedBody.KeyId;
  const key = orgData.kms.keys.find((k) => k.id === keyId || k.arn === keyId);

  if (!key) {
    return {
      status: 400,
      headers: { "Content-Type": "application/x-amz-json-1.1" },
      body: JSON.stringify({
        __type: "NotFoundException",
        message: `Invalid keyId ${keyId}`,
      }),
    };
  }

  return jsonResponse({ KeyRotationEnabled: key.rotationEnabled });
}

function handle(req, body, orgData, params, url, target) {
  if (!target) return jsonResponse({ Keys: [], Truncated: false });

  const action = target.split(".").pop();

  if (action === "ListKeys") return handleListKeys(orgData);
  if (action === "DescribeKey") return handleDescribeKey(body, orgData);
  if (action === "GetKeyRotationStatus") return handleGetKeyRotationStatus(body, orgData);

  return jsonResponse({});
}

module.exports = { handle };
