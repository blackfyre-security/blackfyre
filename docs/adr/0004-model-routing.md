# ADR-0004: Three-tier model routing for AI features

Status: accepted (direction); implementation is deliberately incremental — see
honest status at the bottom

## Context

Blackfyre's AI features span wildly different work: deterministic transforms and
rule-based checks; high-volume, low-stakes classification (finding triage,
severity suggestions); and genuinely hard reasoning (gap analysis, MITRE ATT&CK
mapping, the security copilot, executive summaries). Routing everything to a
frontier model is slow and expensive; routing everything to a small model produces
bad compliance advice. Cost scales per-tenant-per-scan, so the routing decision is a
unit-economics decision.

## Decision

Route AI work through three tiers, choosing the cheapest tier that can do the job
(internally numbered ADR-026):

| Tier | Handler | Latency | Cost | Use for |
|---|---|---|---|---|
| 1 | Deterministic code / heuristics — no LLM call | ~ms | $0 | Rule-based checks, templated remediation text, anything a function can decide |
| 2 | Fast small model (Haiku-class) | sub-second | ~100× cheaper than tier 3 | Classification, tagging, short summaries at scan volume |
| 3 | Frontier model (Sonnet/Opus-class) | seconds | highest | Gap analysis, ATT&CK mapping, copilot, executive narratives |

Supporting decisions:

- **Fail down, never up**: every LLM call site wraps the call and degrades to its
  tier-1 heuristic on failure or when no provider is configured (`callLLM` returns
  empty → caller's fallback). Local dev without keys works fully; AI features
  enrich rather than gate.
- **Provider-agnostic client**: all tiers call through the unified wrapper in
  `services/llm/client.ts`, which picks Anthropic direct (when `ANTHROPIC_API_KEY`
  is real) or AWS Bedrock (IAM auth, `BEDROCK_REGION`/`BEDROCK_MODEL_ID` mapping) —
  see [docs/LLM_PROVIDER.md](../LLM_PROVIDER.md). Routing tiers and provider choice
  are orthogonal.

## Consequences

- AI cost stays roughly proportional to genuinely-hard work, not to scan volume;
  tier-2-able workloads don't ride the frontier model.
- Call sites must define their tier-1 fallback up front — which doubles as
  resilience (provider outage degrades quality, not availability).
- Tier assignment is a review point for new AI features: "why is this tier 3?"
- Model names/versions live in one place (the client wrapper + `BEDROCK_MODEL_ID`
  override), so upgrades don't touch call sites.

**Honest implementation status (2026-07):** tiers 1 and 3 are live — every call
site has a heuristic fallback, and analysis/copilot features default to a
Sonnet-class model through the unified client. Tier 2 (automatic small-model
routing by task class) is not yet wired: today a single default model serves all
LLM calls, with `BEDROCK_MODEL_ID` as a manual override. Contributions welcome —
the wrapper is the extension point.
