#!/usr/bin/env node
"use strict";

const http = require("http");
const path = require("path");
const fs = require("fs");
const { URLSearchParams } = require("url");

const ORG_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "org-data.json"), "utf8")
);

const handlers = {
  iam: require("./handlers/iam.js"),
  sts: require("./handlers/sts.js"),
  s3: require("./handlers/s3.js"),
  ec2: require("./handlers/ec2.js"),
  cloudtrail: require("./handlers/cloudtrail.js"),
  kms: require("./handlers/kms.js"),
};

const PORT = 4566;

/**
 * Parse form-encoded (application/x-www-form-urlencoded) body.
 * Returns an object with key-value pairs.
 */
function parseFormBody(body) {
  const params = {};
  const sp = new URLSearchParams(body);
  for (const [key, value] of sp.entries()) {
    params[key] = value;
  }
  return params;
}

/**
 * Determine service from User-Agent header.
 * AWS SDK v3 sends: "aws-sdk-js/3.x ... api/<service>#3.x"
 */
function serviceFromUserAgent(ua) {
  if (!ua) return null;
  // Match api/<service>#version pattern
  const match = ua.match(/\bapi\/([a-z0-9\-]+)#/i);
  if (match) {
    const svc = match[1].toLowerCase();
    // Normalize common aliases
    if (svc === "iam") return "iam";
    if (svc === "sts") return "sts";
    if (svc === "s3") return "s3";
    if (svc === "ec2") return "ec2";
    if (svc === "cloudtrail") return "cloudtrail";
    if (svc === "kms") return "kms";
    return svc;
  }
  return null;
}

/**
 * Determine service from X-Amz-Target header (JSON-protocol services).
 * e.g. "com.amazonaws.cloudtrail..." -> cloudtrail
 *      "TrentService.ListKeys" -> kms
 */
function serviceFromTarget(target) {
  if (!target) return null;
  const t = target.toLowerCase();
  if (t.includes("cloudtrail")) return "cloudtrail";
  if (t.includes("trentservice") || t.includes("kms")) return "kms";
  return null;
}

/**
 * Determine service from form-encoded body Action value.
 * IAM/STS/EC2 all use form-encoded with Action=...
 */
const IAM_ACTIONS = new Set([
  "ListUsers",
  "ListMFADevices",
  "ListAccessKeys",
  "GetAccountSummary",
  "GetAccountAuthorizationDetails",
  "GetAccountPasswordPolicy",
  "CreateUser",
  "DeleteUser",
]);

const STS_ACTIONS = new Set([
  "AssumeRole",
  "GetCallerIdentity",
  "GetSessionToken",
  "AssumeRoleWithWebIdentity",
]);

const EC2_ACTIONS = new Set([
  "DescribeSecurityGroups",
  "DescribeVolumes",
  "DescribeInstances",
  "DescribeVpcs",
]);

function serviceFromAction(action) {
  if (!action) return null;
  if (STS_ACTIONS.has(action)) return "sts";
  if (IAM_ACTIONS.has(action)) return "iam";
  if (EC2_ACTIONS.has(action)) return "ec2";
  return null;
}

/**
 * Determine if request is S3 (path-style GET with bucket/query params).
 */
function isS3Request(req, method, pathname) {
  if (method === "GET" || method === "HEAD") {
    const ua = req.headers["user-agent"] || "";
    if (ua.toLowerCase().includes("api/s3#")) return true;
    // Path-style S3 requests to non-root or root with bucket-like paths
  }
  // Check via User-Agent since all clients use the same endpoint
  const ua = req.headers["user-agent"] || "";
  if (serviceFromUserAgent(ua) === "s3") return true;
  return false;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  const startMs = Date.now();
  const rawUrl = req.url || "/";
  const parsedUrl = new URL(rawUrl, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  const method = req.method || "GET";

  const body = await readBody(req);
  const ua = req.headers["user-agent"] || "";
  const target = req.headers["x-amz-target"] || "";
  const contentType = req.headers["content-type"] || "";

  let service = serviceFromUserAgent(ua);
  let params = {};
  let parsedBody = null;

  // Form-encoded body (IAM/STS/EC2)
  if (contentType.includes("application/x-www-form-urlencoded") && body) {
    params = parseFormBody(body);
    if (!service) service = serviceFromAction(params.Action);
  }

  // JSON body (KMS/CloudTrail via X-Amz-Target)
  if (target) {
    const svcFromTarget = serviceFromTarget(target);
    if (svcFromTarget) service = svcFromTarget;
    if (contentType.includes("application/x-amz-json") || contentType.includes("application/json")) {
      try {
        parsedBody = JSON.parse(body);
      } catch (_) {}
    }
  }

  // Fallback: action from form body
  if (!service && params.Action) {
    service = serviceFromAction(params.Action);
  }

  // S3 detection
  if (!service && (method === "GET" || method === "HEAD" || method === "PUT")) {
    if (serviceFromUserAgent(ua) === "s3") service = "s3";
  }

  let result = null;

  try {
    if (service === "sts") {
      result = handlers.sts.handle(req, body, ORG_DATA, params);
    } else if (service === "iam") {
      result = handlers.iam.handle(req, body, ORG_DATA, params);
    } else if (service === "s3") {
      result = handlers.s3.handle(req, body, ORG_DATA, params, parsedUrl);
    } else if (service === "ec2") {
      result = handlers.ec2.handle(req, body, ORG_DATA, params);
    } else if (service === "cloudtrail") {
      result = handlers.cloudtrail.handle(req, body, ORG_DATA, params, parsedUrl, target);
    } else if (service === "kms") {
      result = handlers.kms.handle(req, body, ORG_DATA, params, parsedUrl, target);
    } else {
      // Unknown service — return generic OK
      console.warn(`[fake-org] Unknown service | ua=${ua} | action=${params.Action} | target=${target} | path=${pathname}`);
      result = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "fake-org: unknown service" }),
      };
    }
  } catch (err) {
    console.error(`[fake-org] Handler error for service=${service}:`, err);
    result = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }

  const elapsed = Date.now() - startMs;
  console.log(
    `[fake-org] ${method} ${pathname} svc=${service || "?"} action=${params.Action || target || "-"} → ${result.status} (${elapsed}ms)`
  );

  res.writeHead(result.status, result.headers);
  res.end(result.body);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[fake-org] Mock AWS cloud listening on http://127.0.0.1:${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[fake-org] SIGTERM received, shutting down");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("[fake-org] SIGINT received, shutting down");
  server.close(() => process.exit(0));
});
