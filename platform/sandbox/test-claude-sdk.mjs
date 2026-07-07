// Tests the Anthropic SDK wiring used by the codebase.
// 1. Imports @anthropic-ai/sdk FROM THE API PACKAGE (same version code uses).
// 2. Probes with a dummy key -> proves real HTTP call to api.anthropic.com (401).
// 3. If ANTHROPIC_API_KEY is set, runs a real prompt and prints the reply.
import Anthropic from "../node_modules/@anthropic-ai/sdk/index.mjs";
import { readFileSync } from "node:fs";

const sdkPkg = JSON.parse(readFileSync("../node_modules/@anthropic-ai/sdk/package.json", "utf-8"));
console.log("SDK loaded:", sdkPkg.name, "v" + sdkPkg.version);

const realKey = process.env.ANTHROPIC_API_KEY;
const key = realKey || "sk-ant-dummy-" + Date.now();
console.log("apiKey present?", !!realKey, "  (using " + (realKey ? "REAL" : "dummy") + " key)");

const client = new Anthropic({ apiKey: key });

try {
  const t0 = Date.now();
  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    system: "You are a cybersecurity compliance expert. Respond ONLY with a valid JSON object, no markdown fences.",
    messages: [{
      role: "user",
      content: 'Analyze 1 finding against SOC2: [critical] IAM user without MFA — Root account has no MFA.\nRespond as JSON: { "overallScore": <0-100>, "criticalGaps": <count>, "gaps": [{ "control": "<id>", "framework": "soc2", "status": "gap", "risk": "critical", "recommendation": "<text>" }] }',
    }],
  });
  const elapsed = Date.now() - t0;
  console.log("--- LIVE REPLY (took " + elapsed + "ms) ---");
  console.log("model:", msg.model);
  console.log("usage:", JSON.stringify(msg.usage));
  console.log("content:", msg.content[0].type === "text" ? msg.content[0].text : "(non-text)");
  console.log("verdict: LIVE Claude call succeeded — integration confirmed working end-to-end.");
} catch (e) {
  const status = e?.status ?? e?.response?.status ?? "?";
  const errBody = e?.error ?? e?.message ?? String(e);
  console.log("--- ERROR ---");
  console.log("HTTP status:", status);
  console.log("body:", typeof errBody === "object" ? JSON.stringify(errBody) : errBody);
  if (status === 401) {
    console.log("verdict: SDK wiring is REAL — got 401 from api.anthropic.com (dummy key rejected, as expected). Set ANTHROPIC_API_KEY to a real key to test full round-trip.");
  } else {
    console.log("verdict: unexpected error — wiring may be broken.");
  }
}
