import { describe, it, expect } from "vitest";
import { SwarmOrchestrator } from "../../src/agents/swarm-orchestrator.js";
import { getAllAgents, getAgent, getAgentsForIntegration } from "../../src/agents/registry.js";

describe("Agent Registry", () => {
  it("has all scanning agents registered", () => {
    const agents = getAllAgents();
    expect(agents.length).toBe(33);
  });

  it("maps AWS integration to cloud-auditor-aws and expansion agents", () => {
    const agents = getAgentsForIntegration("aws");
    expect(agents.length).toBeGreaterThanOrEqual(1);
    expect(agents.map(a => a.type)).toContain("cloud-auditor-aws");
  });

  it("maps Azure integration to cloud-auditor-azure and expansion agents", () => {
    const agents = getAgentsForIntegration("azure");
    expect(agents.length).toBeGreaterThanOrEqual(1);
    expect(agents.map(a => a.type)).toContain("cloud-auditor-azure");
  });

  it("maps GCP integration to cloud-auditor-gcp and expansion agents", () => {
    const agents = getAgentsForIntegration("gcp");
    expect(agents.length).toBeGreaterThanOrEqual(1);
    expect(agents.map(a => a.type)).toContain("cloud-auditor-gcp");
  });

  it("maps Okta integration to identity-auditor and saas-auditor", () => {
    const agents = getAgentsForIntegration("okta");
    expect(agents.length).toBeGreaterThanOrEqual(1);
    expect(agents.map(a => a.type)).toContain("identity-auditor");
  });

  it("maps Jamf integration to endpoint-auditor", () => {
    const agents = getAgentsForIntegration("jamf");
    expect(agents.length).toBe(1);
    expect(agents[0].type).toBe("endpoint-auditor");
  });

  it("maps network integration to network-scanner", () => {
    const agents = getAgentsForIntegration("network");
    expect(agents.length).toBe(1);
    expect(agents[0].type).toBe("network-scanner");
  });

  it("returns empty array for unknown integration type", () => {
    const agents = getAgentsForIntegration("unknown-system");
    expect(agents.length).toBe(0);
  });

  it("Azure agent has correct displayName and supportedIntegrations", () => {
    const agent = getAgent("cloud-auditor-azure");
    expect(agent).toBeDefined();
    expect(agent!.displayName).toBe("Azure Cloud Auditor");
    expect(agent!.supportedIntegrations).toContain("azure");
  });

  it("GCP agent has correct displayName and supportedIntegrations", () => {
    const agent = getAgent("cloud-auditor-gcp");
    expect(agent).toBeDefined();
    expect(agent!.displayName).toBe("GCP Cloud Auditor");
    expect(agent!.supportedIntegrations).toContain("gcp");
  });

  it("all cloud agents are registered for their respective integration types", () => {
    const awsAgents = getAgentsForIntegration("aws");
    const azureAgents = getAgentsForIntegration("azure");
    const gcpAgents = getAgentsForIntegration("gcp");

    expect(awsAgents.length).toBeGreaterThanOrEqual(1);
    expect(azureAgents.length).toBeGreaterThanOrEqual(1);
    expect(gcpAgents.length).toBeGreaterThanOrEqual(1);

    expect(awsAgents.map(a => a.type)).toContain("cloud-auditor-aws");
    expect(azureAgents.map(a => a.type)).toContain("cloud-auditor-azure");
    expect(gcpAgents.map(a => a.type)).toContain("cloud-auditor-gcp");
  });
});

describe("Swarm Orchestrator", () => {
  it("runs agents for given integrations", async () => {
    const orchestrator = new SwarmOrchestrator();
    const findings: any[] = [];

    const result = await orchestrator.runSwarm({
      scanId: "test-scan-1",
      tenantId: "test-tenant-1",
      frameworks: ["soc2"],
      integrations: [
        { id: "int-1", type: "aws", credentialRef: "vault://aws/test" },
      ],
      onFinding: async (finding) => {
        findings.push(finding);
      },
      onProgress: async () => {},
      onAgentComplete: async () => {},
      onAgentError: async () => {},
    });

    expect(result.swarmId).toBe("swarm_test-scan-1");
    expect(result.agentResults.length).toBeGreaterThanOrEqual(1);
    expect(result.agentResults.map(r => r.agentType)).toContain("cloud-auditor-aws");
  });

  it("handles empty integrations list", async () => {
    const orchestrator = new SwarmOrchestrator();

    const result = await orchestrator.runSwarm({
      scanId: "test-scan-2",
      tenantId: "test-tenant-2",
      frameworks: ["soc2"],
      integrations: [],
      onFinding: async () => {},
      onProgress: async () => {},
      onAgentComplete: async () => {},
      onAgentError: async () => {},
    });

    expect(result.agentResults.length).toBe(0);
    expect(result.totalFindings).toBe(0);
  });

  // Root cause turned out to be in network-scanner, not the orchestrator:
  // scanPorts/getTlsCertificate were using inactivity-only socket timeouts,
  // which never fire when DNS is stuck on a malformed host like
  // "192.168.1.0/24" (slash makes it invalid; libuv thread pool gets
  // exhausted, 23 port checks queue, parallel agents make it worse).
  // Fixed 2026-05-19 by wrapping each socket promise in Promise.race
  // with a HARD_TIMEOUT_MS ceiling. Generous test timeout (30s) so a
  // worst-case CI run finishes; in practice it completes in ~6s.
  it("runs multiple agents in parallel", { timeout: 30_000 }, async () => {
    const orchestrator = new SwarmOrchestrator();
    const completedAgents: string[] = [];

    const result = await orchestrator.runSwarm({
      scanId: "test-scan-3",
      tenantId: "test-tenant-3",
      frameworks: ["soc2", "hipaa"],
      integrations: [
        { id: "int-1", type: "aws", credentialRef: "vault://aws/test" },
        { id: "int-2", type: "okta", credentialRef: "vault://okta/test" },
        { id: "int-3", type: "network", credentialRef: "192.168.1.0/24" },
      ],
      onFinding: async () => {},
      onProgress: async () => {},
      onAgentComplete: async (r) => { completedAgents.push(r.agentType); },
      onAgentError: async () => {},
    });

    expect(result.agentResults.length).toBeGreaterThanOrEqual(3);
    expect(completedAgents).toContain("cloud-auditor-aws");
    expect(completedAgents).toContain("identity-auditor");
    expect(completedAgents).toContain("network-scanner");
  });

  it("runs Azure agent through swarm orchestrator", async () => {
    const orchestrator = new SwarmOrchestrator();
    const completedAgents: string[] = [];

    const result = await orchestrator.runSwarm({
      scanId: "test-scan-azure",
      tenantId: "test-tenant-az",
      frameworks: ["soc2", "iso27001"],
      integrations: [
        { id: "int-az", type: "azure", credentialRef: "vault://azure/test" },
      ],
      onFinding: async () => {},
      onProgress: async () => {},
      onAgentComplete: async (r) => { completedAgents.push(r.agentType); },
      onAgentError: async () => {},
    });

    expect(result.agentResults.length).toBeGreaterThanOrEqual(1);
    expect(result.agentResults.map(r => r.agentType)).toContain("cloud-auditor-azure");
    expect(completedAgents).toContain("cloud-auditor-azure");
  });

  it("runs GCP agent through swarm orchestrator", async () => {
    const orchestrator = new SwarmOrchestrator();
    const completedAgents: string[] = [];

    const result = await orchestrator.runSwarm({
      scanId: "test-scan-gcp",
      tenantId: "test-tenant-gcp",
      frameworks: ["soc2", "hipaa"],
      integrations: [
        { id: "int-gcp", type: "gcp", credentialRef: "vault://gcp/test" },
      ],
      onFinding: async () => {},
      onProgress: async () => {},
      onAgentComplete: async (r) => { completedAgents.push(r.agentType); },
      onAgentError: async () => {},
    });

    expect(result.agentResults.length).toBeGreaterThanOrEqual(1);
    expect(result.agentResults.map(r => r.agentType)).toContain("cloud-auditor-gcp");
    expect(completedAgents).toContain("cloud-auditor-gcp");
  });

  it("runs multi-cloud scan with AWS + Azure + GCP", async () => {
    const orchestrator = new SwarmOrchestrator();
    const completedAgents: string[] = [];

    const result = await orchestrator.runSwarm({
      scanId: "test-scan-multicloud",
      tenantId: "test-tenant-multi",
      frameworks: ["soc2", "iso27001", "hipaa"],
      integrations: [
        { id: "int-aws", type: "aws", credentialRef: "vault://aws/test" },
        { id: "int-az", type: "azure", credentialRef: "vault://azure/test" },
        { id: "int-gcp", type: "gcp", credentialRef: "vault://gcp/test" },
      ],
      onFinding: async () => {},
      onProgress: async () => {},
      onAgentComplete: async (r) => { completedAgents.push(r.agentType); },
      onAgentError: async () => {},
    });

    expect(result.agentResults.length).toBeGreaterThanOrEqual(3);

    const agentTypes = result.agentResults.map((r) => r.agentType);
    expect(agentTypes).toContain("cloud-auditor-aws");
    expect(agentTypes).toContain("cloud-auditor-azure");
    expect(agentTypes).toContain("cloud-auditor-gcp");

    expect(completedAgents).toContain("cloud-auditor-aws");
    expect(completedAgents).toContain("cloud-auditor-azure");
    expect(completedAgents).toContain("cloud-auditor-gcp");
  });

  it("multi-cloud scan handles partial agent failures gracefully", async () => {
    const orchestrator = new SwarmOrchestrator();
    const completedAgents: string[] = [];
    const erroredAgents: string[] = [];

    const result = await orchestrator.runSwarm({
      scanId: "test-scan-partial",
      tenantId: "test-tenant-partial",
      frameworks: ["soc2"],
      integrations: [
        { id: "int-aws", type: "aws", credentialRef: "vault://aws/test" },
        { id: "int-az", type: "azure", credentialRef: "vault://azure/test" },
        { id: "int-gcp", type: "gcp", credentialRef: "vault://gcp/test" },
      ],
      onFinding: async () => {},
      onProgress: async () => {},
      onAgentComplete: async (r) => { completedAgents.push(r.agentType); },
      onAgentError: async (agentType) => { erroredAgents.push(agentType); },
    });

    // Promise.allSettled ensures all agents run even if one fails.
    // Since these are real agent instances (not mocked), they all attempt to
    // resolve credentials and may fail, but the swarm never crashes.
    expect(result.agentResults.length).toBeGreaterThanOrEqual(3);
    // The swarm should have produced results for all cloud agents
    const agentTypes = result.agentResults.map((r) => r.agentType);
    expect(agentTypes).toContain("cloud-auditor-aws");
    expect(agentTypes).toContain("cloud-auditor-azure");
    expect(agentTypes).toContain("cloud-auditor-gcp");
  });
});
