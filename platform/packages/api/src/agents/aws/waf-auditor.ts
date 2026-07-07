// REAL IMPL (BLACKFYRE 2026-06): replaces the canned 4-finding stub with a real
// @aws-sdk/client-wafv2 auditor. Enumerates actual Web ACLs across both WAFv2
// scopes (REGIONAL via the agent's regional client + CLOUDFRONT via us-east-1)
// using the paginated ListWebACLs API (NextMarker), then pulls each ACL's full
// definition via GetWebACL and its logging config via GetLoggingConfiguration.
// Findings are derived solely from real properties: presence of any AWSManagedRules
// managed rule group (ManagedRuleGroupStatement with VendorName "AWS"), presence of
// a RateBasedStatement anywhere in the rule tree, and whether a LoggingConfiguration
// with at least one LogDestinationConfig exists. No hardcoded findings, no sample
// data, no TODO. The public export signature (class AwsWafAuditorAgent extends
// BaseAgent, type "aws-waf-auditor") is kept identical so registry.ts and all
// callers keep compiling.
import {
  WAFV2Client,
  ListWebACLsCommand,
  GetWebACLCommand,
  GetLoggingConfigurationCommand,
  type Scope,
  type WebACL,
  type Rule,
  type Statement,
} from "@aws-sdk/client-wafv2";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveCredentials } from "./credentials.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): WAFv2 has two independent scopes. REGIONAL Web
// ACLs (ALB / API Gateway / AppSync / Cognito / App Runner / Verified Access) are
// listed from the caller's chosen region; CLOUDFRONT Web ACLs are global and MUST
// be listed against the us-east-1 endpoint. We enumerate both so a single audit
// covers every Web ACL the account owns.
const CLOUDFRONT_REGION = "us-east-1";

// REAL IMPL (BLACKFYRE 2026-06): AWS-published managed rule groups carry the
// vendor name "AWS" (e.g. AWSManagedRulesCommonRuleSet, ...SQLiRuleSet,
// ...KnownBadInputsRuleSet). We detect protection via the vendor rather than a
// hardcoded rule-set name so any current/future AWSManagedRules group counts.
const AWS_MANAGED_RULES_VENDOR = "AWS";

function makeClient(
  creds: AwsTemporaryCredentials,
  region?: string,
): WAFV2Client {
  return new WAFV2Client({
    ...(region ? { region } : {}),
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): Runs all WAF security checks against real Web
 * ACLs and returns findings. Enumerates every Web ACL in both the REGIONAL and
 * CLOUDFRONT scopes via the paginated ListWebACLs API, resolves each ACL's full
 * definition via GetWebACL, and inspects its real rule tree + logging config.
 */
export async function auditWaf(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  // REGIONAL scope uses the default (regional) client; CLOUDFRONT scope is global
  // and must be queried via the us-east-1 endpoint per the WAFv2 API contract.
  const regionalClient = makeClient(creds);
  const cloudfrontClient = makeClient(creds, CLOUDFRONT_REGION);

  const [regionalFindings, cloudfrontFindings] = await Promise.all([
    auditScope(regionalClient, "REGIONAL"),
    auditScope(cloudfrontClient, "CLOUDFRONT"),
  ]);

  findings.push(...regionalFindings, ...cloudfrontFindings);
  return findings;
}

/**
 * Enumerates and audits every Web ACL within a single WAFv2 scope.
 */
async function auditScope(
  client: WAFV2Client,
  scope: Scope,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  // Collect every Web ACL summary in this scope (paginated via NextMarker).
  const summaries: Array<{ Name?: string; Id?: string; ARN?: string }> = [];
  let nextMarker: string | undefined;
  do {
    const resp = await client.send(
      new ListWebACLsCommand({ Scope: scope, NextMarker: nextMarker, Limit: 100 }),
    );
    for (const acl of resp.WebACLs ?? []) summaries.push(acl);
    nextMarker = resp.NextMarker;
  } while (nextMarker);

  // Resolve each ACL's full definition + logging config and run the checks.
  for (const summary of summaries) {
    if (!summary.Name || !summary.Id) continue;

    const webAclResp = await client.send(
      new GetWebACLCommand({
        Name: summary.Name,
        Id: summary.Id,
        Scope: scope,
      }),
    );
    const webAcl = webAclResp.WebACL;
    if (!webAcl) continue;

    const loggingEnabled = await hasLoggingConfiguration(
      client,
      webAcl.ARN ?? summary.ARN,
    );

    findings.push(...evaluateWebAcl(webAcl, scope, loggingEnabled));
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): A Web ACL has logging enabled only when a
 * LoggingConfiguration exists with at least one LogDestinationConfig (Kinesis
 * Firehose / S3 / CloudWatch Logs). When no logging config is attached the API
 * raises WAFNonexistentItemException, which we treat as "not enabled".
 */
async function hasLoggingConfiguration(
  client: WAFV2Client,
  resourceArn: string | undefined,
): Promise<boolean> {
  if (!resourceArn) return false;
  try {
    const resp = await client.send(
      new GetLoggingConfigurationCommand({ ResourceArn: resourceArn }),
    );
    const destinations = resp.LoggingConfiguration?.LogDestinationConfigs ?? [];
    return destinations.length > 0;
  } catch (error) {
    // WAFNonexistentItemException => no logging configuration attached.
    if (
      error instanceof Error &&
      error.name === "WAFNonexistentItemException"
    ) {
      return false;
    }
    // Any other error (throttling, access denied, etc.) shouldn't be reported as
    // a "logging disabled" finding — rethrow so the agent records the real error.
    throw error;
  }
}

/**
 * Extracts the AWS region from a WAFv2 Web ACL ARN
 * (arn:aws:wafv2:<region>:<account>:<scope>/webacl/<name>/<id>). CLOUDFRONT-scoped
 * ACLs use the literal region "global". Returns null when undeterminable.
 */
function regionFromArn(arn: string | undefined): string | null {
  if (!arn) return null;
  const parts = arn.split(":");
  // arn : aws : wafv2 : <region> : <account> : ...
  return parts.length >= 4 && parts[3] ? parts[3] : null;
}

/**
 * Recursively determines whether any statement in a rule's statement tree (incl.
 * AndStatement / OrStatement / NotStatement / scope-down branches) is a
 * RateBasedStatement. Rate-based rules cap requests per source and are the
 * primary WAF defence against L7 floods and brute-force attacks.
 */
function statementHasRateBased(statement: Statement | undefined): boolean {
  if (!statement) return false;
  if (statement.RateBasedStatement) return true;
  if (statement.AndStatement?.Statements?.some(statementHasRateBased)) {
    return true;
  }
  if (statement.OrStatement?.Statements?.some(statementHasRateBased)) {
    return true;
  }
  if (statementHasRateBased(statement.NotStatement?.Statement)) return true;
  // The wafv2 Statement type is deeply recursive; TS collapses the nested
  // RateBasedStatement to `never`, so cast the scope-down branch to keep the
  // recursion type-safe.
  if (statementHasRateBased((statement.RateBasedStatement as any)?.ScopeDownStatement)) {
    return true;
  }
  return false;
}

/**
 * Recursively determines whether any statement in a rule's statement tree
 * references an AWS-published managed rule group (ManagedRuleGroupStatement with
 * VendorName "AWS", i.e. the AWSManagedRules* families).
 */
function statementHasAwsManagedRules(
  statement: Statement | undefined,
): boolean {
  if (!statement) return false;
  const managed = statement.ManagedRuleGroupStatement;
  if (managed && managed.VendorName === AWS_MANAGED_RULES_VENDOR) return true;
  if (statement.AndStatement?.Statements?.some(statementHasAwsManagedRules)) {
    return true;
  }
  if (statement.OrStatement?.Statements?.some(statementHasAwsManagedRules)) {
    return true;
  }
  if (statementHasAwsManagedRules(statement.NotStatement?.Statement)) {
    return true;
  }
  return false;
}

/**
 * Evaluates a single Web ACL's real definition against all WAF checks.
 */
function evaluateWebAcl(
  webAcl: WebACL,
  scope: Scope,
  loggingEnabled: boolean,
): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  const name = webAcl.Name ?? webAcl.Id ?? "unknown";
  const resourceId = webAcl.ARN ?? name;
  const region = regionFromArn(webAcl.ARN);
  const rules: Rule[] = webAcl.Rules ?? [];

  const hasAwsManagedRules = rules.some((rule) =>
    statementHasAwsManagedRules(rule.Statement),
  );
  const hasRateBasedRule = rules.some((rule) =>
    statementHasRateBased(rule.Statement),
  );

  const scopeLabel = scope === "CLOUDFRONT" ? "CloudFront" : "regional";

  // Check: no AWS managed rule groups -> high. Without AWSManagedRules the ACL
  // lacks AWS-maintained coverage for common exploits, SQLi, and known-bad inputs.
  if (!hasAwsManagedRules) {
    findings.push({
      title: `WAF Web ACL "${name}" has no AWS managed rule groups`,
      description: `${scopeLabel} WAFv2 Web ACL ${resourceId} does not reference any AWS-published managed rule group (ManagedRuleGroupStatement with VendorName "AWS", e.g. AWSManagedRulesCommonRuleSet / AWSManagedRulesSQLiRuleSet / AWSManagedRulesKnownBadInputsRuleSet). Without AWS managed rules the Web ACL has no continuously-updated baseline protection against common web exploits, SQL injection, and known-bad inputs. Add the appropriate AWSManagedRules rule groups.`,
      severity: "high",
      category: "network",
      resourceType: "AWS::WAFv2::WebACL",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("waf_no_managed_rules"),
    });
  }

  // Check: no rate-based rule -> medium. Rate-based statements throttle abusive
  // sources and are the primary WAF control against L7 floods / brute force.
  if (!hasRateBasedRule) {
    findings.push({
      title: `WAF Web ACL "${name}" has no rate-based rule`,
      description: `${scopeLabel} WAFv2 Web ACL ${resourceId} contains no RateBasedStatement in any rule. Rate-based rules cap the number of requests from a single source and are the primary WAF defence against application-layer DDoS, scraping, and brute-force attacks. Add a rate-based rule with an appropriate request limit.`,
      severity: "medium",
      category: "network",
      resourceType: "AWS::WAFv2::WebACL",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("waf_no_rate_based_rule"),
    });
  }

  // Check: logging not enabled -> medium. WAF must stream request logs to a
  // destination (Kinesis Firehose / S3 / CloudWatch Logs) for detection & audit.
  if (!loggingEnabled) {
    findings.push({
      title: `WAF Web ACL "${name}" does not have logging enabled`,
      description: `${scopeLabel} WAFv2 Web ACL ${resourceId} has no LoggingConfiguration with a log destination (Kinesis Data Firehose, S3, or CloudWatch Logs). Without WAF logging, blocked and allowed request details are not retained for security monitoring, incident response, or compliance evidence. Enable logging to a configured destination.`,
      severity: "medium",
      category: "logging",
      resourceType: "AWS::WAFv2::WebACL",
      resourceId,
      resourceRegion: region,
      remediationTier: "auto",
      autoFixAvailable: true,
      controlMappings: mapCheckToControls("waf_logging_disabled"),
    });
  }

  return findings;
}

/**
 * AWS WAF Auditor Agent
 *
 * Scans: WAFv2 Web ACLs (missing AWS managed rule groups, missing rate-based
 *        rules, disabled logging) across the REGIONAL and CLOUDFRONT scopes.
 * Integration: AWS SDK v3 (@aws-sdk/client-wafv2) via STS AssumeRole credentialRef.
 */
export class AwsWafAuditorAgent extends BaseAgent {
  readonly type = "aws-waf-auditor";
  readonly displayName = "AWS WAF Auditor";
  readonly supportedIntegrations = ["aws"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      // REAL IMPL (BLACKFYRE 2026-06): resolve scoped read-only credentials and
      // enumerate real WAFv2 Web ACLs instead of emitting canned data.
      const creds = await resolveCredentials(ctx.credentialRef);

      const findings = await auditWaf(creds);

      for (const finding of findings) {
        await ctx.onFinding({ ...finding, source: this.type });
        findingsCount++;
      }

      ctx.onProgress(100);
      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      return this.createResult(
        startedAt,
        findingsCount,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  // REAL IMPL (BLACKFYRE 2026-06): validate real API access by resolving
  // credentials and issuing a lightweight ListWebACLs call (REGIONAL scope),
  // rather than returning a hardcoded true.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveCredentials(credentialRef);
      const client = makeClient(creds);
      await client.send(new ListWebACLsCommand({ Scope: "REGIONAL", Limit: 1 }));
      return true;
    } catch {
      return false;
    }
  }
}
