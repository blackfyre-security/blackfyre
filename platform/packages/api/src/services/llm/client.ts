import Anthropic from "@anthropic-ai/sdk";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

/**
 * Unified LLM client wrapping Anthropic's direct API and AWS Bedrock so the
 * rest of the codebase doesn't care which provider is active.
 *
 * Selection (see {@link getLlmClient}):
 *   - ANTHROPIC_API_KEY is set to a real value → AnthropicLlmClient
 *   - otherwise                                → BedrockLlmClient (IAM auth)
 *
 * The shapes mirror Anthropic's messages.create() so existing call sites only
 * need to swap `new Anthropic()` for `getLlmClient()`. See docs/LLM_PROVIDER.md
 * for the env-var contract and model mapping rules.
 */

export type LlmRole = "user" | "assistant";
export type LlmMessage = { role: LlmRole; content: string };
// Re-export Anthropic's content block types — Bedrock returns the same shape
// when invoking Claude models (anthropic_version: "bedrock-2023-05-31").
export type LlmTextBlock = Anthropic.TextBlock;
export type LlmContentBlock = Anthropic.ContentBlock;

export interface LlmCreateParams {
  model: string;
  max_tokens: number;
  system?: string;
  messages: LlmMessage[];
  temperature?: number;
}

export interface LlmResponse {
  content: LlmContentBlock[];
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

export type LlmProvider = "anthropic" | "bedrock";

export interface LlmClient {
  readonly provider: LlmProvider;
  readonly modelId: string;
  messages: { create(params: LlmCreateParams): Promise<LlmResponse> };
}

/* ------------------------------------------------------------------ */
/*  Anthropic implementation                                          */
/* ------------------------------------------------------------------ */

class AnthropicLlmClient implements LlmClient {
  readonly provider: LlmProvider = "anthropic";
  readonly modelId: string;
  private client: Anthropic;

  constructor(opts: { apiKey: string; defaultModelId: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.modelId = opts.defaultModelId;
  }

  messages = {
    create: async (params: LlmCreateParams): Promise<LlmResponse> => {
      const res = await this.client.messages.create({
        model: params.model,
        max_tokens: params.max_tokens,
        system: params.system,
        messages: params.messages,
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      });
      return {
        content: res.content,
        stop_reason: res.stop_reason,
        usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens },
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Bedrock implementation                                            */
/* ------------------------------------------------------------------ */

/**
 * Map an Anthropic model ID (`claude-sonnet-4-20250514`) to a Bedrock
 * cross-region inference profile (`us.anthropic.claude-sonnet-4-20250514-v1:0`).
 *
 * Region prefix is picked from BEDROCK_REGION:
 *   us-*   → us
 *   ap-*   → apac
 *   eu-*   → eu
 *   other  → (omit prefix, use direct model ID — works in single-region)
 *
 * Override the whole lookup by setting BEDROCK_MODEL_ID.
 */
export function anthropicToBedrockModelId(
  anthropicModel: string,
  region: string,
  override?: string,
): string {
  if (override && override.trim().length > 0) return override;

  let regionPrefix = "";
  if (region.startsWith("us-")) regionPrefix = "us.";
  else if (region.startsWith("ap-")) regionPrefix = "apac.";
  else if (region.startsWith("eu-")) regionPrefix = "eu.";

  // claude-sonnet-4-20250514 → anthropic.claude-sonnet-4-20250514-v1:0
  // Skip the rewrite if the caller already passed a fully-qualified Bedrock id.
  if (anthropicModel.includes("anthropic.")) return anthropicModel;

  const base = anthropicModel.replace(/^claude-/, "anthropic.claude-");
  // Bedrock model IDs always end in -v<N>:0; default to v1:0.
  const versioned = /-v\d+:\d+$/.test(base) ? base : `${base}-v1:0`;
  return `${regionPrefix}${versioned}`;
}

class BedrockLlmClient implements LlmClient {
  readonly provider: LlmProvider = "bedrock";
  readonly modelId: string;
  private client: BedrockRuntimeClient;
  private region: string;
  private modelIdOverride?: string;

  constructor(opts: { region: string; modelIdOverride?: string; defaultAnthropicModel: string }) {
    this.client = new BedrockRuntimeClient({ region: opts.region });
    this.region = opts.region;
    this.modelIdOverride = opts.modelIdOverride && opts.modelIdOverride.trim().length > 0
      ? opts.modelIdOverride
      : undefined;
    this.modelId = anthropicToBedrockModelId(opts.defaultAnthropicModel, opts.region, this.modelIdOverride);
  }

  messages = {
    create: async (params: LlmCreateParams): Promise<LlmResponse> => {
      const modelId = anthropicToBedrockModelId(params.model, this.region, this.modelIdOverride);
      // Bedrock body matches Anthropic's messages.create payload but routes
      // `model` via the SDK's modelId parameter and requires anthropic_version.
      const body = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: params.max_tokens,
        ...(params.system !== undefined ? { system: params.system } : {}),
        messages: params.messages,
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      };

      const res = await this.client.send(
        new InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(body),
        }),
      );

      const payload = JSON.parse(new TextDecoder().decode(res.body)) as {
        content: LlmContentBlock[];
        stop_reason: string | null;
        usage: { input_tokens: number; output_tokens: number };
      };

      return {
        content: payload.content,
        stop_reason: payload.stop_reason,
        usage: payload.usage,
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// Common placeholder values that SST/Terraform substitutes for unset secrets.
const PLACEHOLDER_PATTERN = /^(<\s*not\s*set\s*>|placeholder|change[- ]?me|dummy|todo|none|null|undefined)$/i;

function isRealKey(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (PLACEHOLDER_PATTERN.test(trimmed)) return false;
  // Anthropic keys start with sk-ant- and are >60 chars in practice. Reject
  // anything obviously too short to be a real credential.
  if (trimmed.length < 20) return false;
  return true;
}

let cached: LlmClient | undefined;

/**
 * Returns the active LLM client. Cached after first call — env vars are
 * assumed stable across the process lifetime. Use {@link resetLlmClient} in
 * tests when you need to swap providers.
 */
export function getLlmClient(): LlmClient {
  if (cached !== undefined) return cached;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (isRealKey(anthropicKey)) {
    cached = new AnthropicLlmClient({
      apiKey: anthropicKey!,
      defaultModelId: DEFAULT_MODEL,
    });
  } else {
    const region = process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "us-east-1";
    const modelIdOverride = process.env.BEDROCK_MODEL_ID;
    cached = new BedrockLlmClient({
      region,
      modelIdOverride,
      defaultAnthropicModel: DEFAULT_MODEL,
    });
  }
  return cached;
}

/** Test-only: clear the cached client so the next getLlmClient() re-resolves. */
export function resetLlmClient(): void {
  cached = undefined;
}

/**
 * Returns metadata about the active provider without forcing a client to
 * exist. Useful for capability/status endpoints that don't actually call the
 * LLM but want to report which mode is in effect.
 */
export function describeLlmProvider(): { provider: LlmProvider; modelId: string } {
  const client = getLlmClient();
  return { provider: client.provider, modelId: client.modelId };
}
