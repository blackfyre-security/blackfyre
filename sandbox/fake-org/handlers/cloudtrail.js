"use strict";

/**
 * CloudTrail uses AWS JSON 1.1 protocol (JSON request/response, X-Amz-Target header).
 */

function jsonResponse(obj) {
  return {
    status: 200,
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
    },
    body: JSON.stringify(obj),
  };
}

function handleDescribeTrails(orgData) {
  // Return empty trails list — triggers "No CloudTrail trails configured" finding
  return jsonResponse({ trailList: orgData.cloudtrail.trails || [] });
}

function handleGetTrailStatus(orgData) {
  // This won't be reached if trails list is empty, but handle defensively
  return jsonResponse({
    IsLogging: false,
    LatestDeliveryTime: null,
    LatestDeliveryError: "No trail",
  });
}

function handle(req, body, orgData, params, url, target) {
  if (target === "com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.DescribeTrails") {
    return handleDescribeTrails(orgData);
  }
  if (target === "com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.GetTrailStatus") {
    return handleGetTrailStatus(orgData);
  }

  // Try JSON body action too
  let parsedBody = {};
  try {
    parsedBody = typeof body === "string" ? JSON.parse(body) : body;
  } catch (_) {}

  if (target && target.includes("DescribeTrails")) return handleDescribeTrails(orgData);
  if (target && target.includes("GetTrailStatus")) return handleGetTrailStatus(orgData);

  return jsonResponse({ trailList: [] });
}

module.exports = { handle };
