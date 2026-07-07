# LLM provider routing

Where the API talks to a Claude model, and how it picks between **Anthropic's
direct API** and **AWS Bedrock**.

> Code: `platform/packages/api/src/services/llm/client.ts`

## TL;DR

```
ANTHROPIC_API_KEY set to a real value?
  ├── yes → Anthropic direct API (api.anthropic.com)
  └── no  → AWS Bedrock (IAM auth, no key required)
```

The choice happens once, on first call to `getLlmClient()`, and is cached for
the lifetime of the process. No per-request fallback — failures throw and
upstream call sites degrade to heuristic logic via existing `try/catch` paths.

## Why both

- **Anthropic direct** is faster (no AWS intermediation), supports the latest
  model versions soonest, and is the default for prod once we have a real key.
- **Bedrock** uses IAM via the Lambda's execution role — zero key management,
  perfect for staging / demo where we may not have an Anthropic key yet, and
  for customers whose contracts forbid us from sharing data with non-AWS
  endpoints.

Either way, call sites use the same `messages.create({...})` shape. Bedrock
returns the same response payload as Anthropic when invoked against Claude
models (`anthropic_version: "bedrock-2023-05-31"`), so the wrapper is a thin
adapter rather than a translation layer.

## Environment variables

| Variable                | Default       | Purpose                                                                 |
|-------------------------|---------------|-------------------------------------------------------------------------|
| `ANTHROPIC_API_KEY`     | _empty_       | If set to a real value, picks Anthropic direct.                         |
| `BEDROCK_REGION`        | `us-east-1`   | AWS region for Bedrock calls. Falls back to `AWS_REGION` if unset.      |
| `BEDROCK_MODEL_ID`      | _empty_       | When set, replaces the auto-mapped Bedrock model ID. Use to force a    |
|                         |               | specific inference profile (e.g., `apac.anthropic.claude-haiku-...`).  |

### What counts as a "real" Anthropic key

The factory rejects values that look like placeholders SST/Terraform substitute
for unset secrets (`<not set>`, `placeholder`, `change-me`, `dummy`, `todo`,
`none`, `null`, `undefined`) and anything shorter than 20 characters. A real
Anthropic key starts with `sk-ant-` and is ~100 characters.

## Region & model mapping

Bedrock requires cross-region inference profile IDs for most Claude models.
The wrapper maps the Anthropic-format model ID to Bedrock automatically:

| Anthropic model                | `BEDROCK_REGION` | Bedrock model ID                                              |
|--------------------------------|------------------|---------------------------------------------------------------|
| `claude-sonnet-4-20250514`     | `us-east-1`      | `us.anthropic.claude-sonnet-4-20250514-v1:0`                  |
| `claude-sonnet-4-20250514`     | `ap-south-1`     | `apac.anthropic.claude-sonnet-4-20250514-v1:0`                |
| `claude-sonnet-4-20250514`     | `eu-west-1`      | `eu.anthropic.claude-sonnet-4-20250514-v1:0`                  |

For regions that don't support cross-region profiles (rare), or when you need a
non-default version suffix, set `BEDROCK_MODEL_ID` explicitly.

## Setup steps for a new AWS region

1. Open the AWS console → Bedrock → **Model access**, in `BEDROCK_REGION`.
2. Enable access to the Anthropic Claude models you plan to use.
3. Confirm the Lambda execution role has `bedrock:InvokeModel` on the relevant
   model ARN (or `*` for the region while testing).
4. Hit `GET /api/ai/capabilities` — it now returns `{provider: "bedrock", model: <id>}`.

If access is missing, Bedrock returns `AccessDeniedException` at call time;
the wrapper logs the error and the call site falls back to its heuristic path
(returns an empty string from `callLLM`).

## How to switch back to Anthropic direct

1. Set `ANTHROPIC_API_KEY` to a real `sk-ant-...` key (via `sst secret set
   AnthropicApiKey` for staging/prod, or `.env` for local dev).
2. Restart the API. The cached client picks up the new env on cold start.

That's it — no code change needed.

## Call sites that route through the wrapper

- `services/cortex/copilot.ts` — CORTEX security copilot
- `services/ai-ethics-service.ts` — bias / fairness assessments
- `services/ai-analysis-service.ts` — gap analysis, MITRE mapping, risk scoring,
  executive summaries, anomaly detection, etc.

All three were originally constructed with `new Anthropic(...)`; they now use
`getLlmClient()`. The `client | null` guard pattern in the two service classes
is preserved (with `try/catch` around the LLM call) so failure paths still
fall through to heuristic logic instead of bubbling errors to the user.

## Local development

Local dev typically has no Anthropic key set and no AWS credentials configured
for Bedrock — in that case Bedrock calls fail at runtime with the AWS SDK's
default credential chain error. The call sites swallow this and return their
heuristic outputs, so the API still works without AI features.

To use AI features locally:

```bash
# Option A — direct Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."
npm run dev

# Option B — Bedrock with your AWS profile
export BEDROCK_REGION=us-east-1
aws sso login   # or whatever populates the default credentials
npm run dev
```
