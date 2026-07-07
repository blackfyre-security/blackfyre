/**
 * OT/SCADA Passive Collector Agent
 *
 * SAFETY-CRITICAL: This agent is PASSIVE ONLY.
 * It analyzes pre-captured or mirrored network traffic.
 * It does NOT open connections, send probes, or transmit any data
 * to industrial control systems.
 *
 * Supported protocols (passive analysis only):
 *   - Modbus/TCP  (port 502)
 *   - DNP3        (port 20000)
 *   - BACnet/IP   (port 47808)
 */

import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import { IcsAssetRegistry, type IcsAsset } from "../services/ics-asset-registry.js";

/* ------------------------------------------------------------------ */
/*  OT Finding types                                                   */
/* ------------------------------------------------------------------ */

export type OTFindingType =
  | "asset_discovery"
  | "anomaly"
  | "unauthorized_access"
  | "config_change"
  | "rogue_device";

export type OTProtocol = "modbus" | "dnp3" | "bacnet";

export interface OTFinding {
  type: OTFindingType;
  protocol: OTProtocol;
  severity: "critical" | "high" | "medium" | "low" | "info";
  sourceIP: string;
  destinationIP: string;
  description: string;
  timestamp: Date;
  rawPacketRef?: string; // reference to pcap capture, NOT the actual packet
}

/* ------------------------------------------------------------------ */
/*  Modbus/TCP Analyzer — port 502 (passive)                          */
/* ------------------------------------------------------------------ */

interface ModbusFrame {
  transactionId: number;
  unitId: number;
  functionCode: number;
  sourceIP: string;
  destinationIP: string;
  timestamp: Date;
}

const MODBUS_WRITE_FUNCTION_CODES = new Set([
  5,  // Write Single Coil
  6,  // Write Single Register
  15, // Write Multiple Coils
  16, // Write Multiple Registers
  22, // Mask Write Register
  23, // Read/Write Multiple Registers
]);

const MODBUS_FC_NAMES: Record<number, string> = {
  1: "Read Coils",
  2: "Read Discrete Inputs",
  3: "Read Holding Registers",
  4: "Read Input Registers",
  5: "Write Single Coil",
  6: "Write Single Register",
  15: "Write Multiple Coils",
  16: "Write Multiple Registers",
  22: "Mask Write Register",
  23: "Read/Write Multiple Registers",
  43: "Read Device Identification",
};

export class ModbusAnalyzer {
  private frames: ModbusFrame[] = [];

  /**
   * Process a raw Modbus/TCP frame from mirrored traffic.
   * The caller provides pre-parsed data from the packet capture layer.
   * This method NEVER transmits data.
   */
  ingestFrame(frame: ModbusFrame): OTFinding[] {
    this.frames.push(frame);
    const findings: OTFinding[] = [];

    // Alert on any write command — writes to PLCs are high-severity events
    if (MODBUS_WRITE_FUNCTION_CODES.has(frame.functionCode)) {
      findings.push({
        type: "unauthorized_access",
        protocol: "modbus",
        severity: "high",
        sourceIP: frame.sourceIP,
        destinationIP: frame.destinationIP,
        description:
          `Modbus write command detected: FC${frame.functionCode} ` +
          `(${MODBUS_FC_NAMES[frame.functionCode] ?? "Unknown"}) ` +
          `from ${frame.sourceIP} to unit ID ${frame.unitId} at ${frame.destinationIP}. ` +
          `Write commands to PLCs should be investigated to confirm authorization.`,
        timestamp: frame.timestamp,
      });
    }

    // Alert on unknown function codes (possible reconnaissance or exploit)
    if (!MODBUS_FC_NAMES[frame.functionCode] && frame.functionCode < 128) {
      findings.push({
        type: "anomaly",
        protocol: "modbus",
        severity: "medium",
        sourceIP: frame.sourceIP,
        destinationIP: frame.destinationIP,
        description:
          `Unknown Modbus function code FC${frame.functionCode} observed ` +
          `from ${frame.sourceIP}. This may indicate reconnaissance or an exploit attempt.`,
        timestamp: frame.timestamp,
      });
    }

    return findings;
  }

  /**
   * Returns asset discovery findings from observed unit IDs.
   */
  getDiscoveryFindings(): OTFinding[] {
    const deviceMap = new Map<string, Set<number>>();
    for (const frame of this.frames) {
      const key = `${frame.sourceIP}->${frame.destinationIP}`;
      if (!deviceMap.has(key)) deviceMap.set(key, new Set());
      deviceMap.get(key)!.add(frame.unitId);
    }

    return Array.from(deviceMap.entries()).map(([pair, unitIds]) => {
      const [src, dst] = pair.split("->");
      return {
        type: "asset_discovery" as OTFindingType,
        protocol: "modbus" as OTProtocol,
        severity: "info" as const,
        sourceIP: src ?? "",
        destinationIP: dst ?? "",
        description:
          `Modbus device(s) discovered at ${dst}. ` +
          `Unit IDs observed: [${Array.from(unitIds).sort((a, b) => a - b).join(", ")}]. ` +
          `Source: ${src}.`,
        timestamp: new Date(),
      };
    });
  }

  getSummary() {
    return {
      totalFrames: this.frames.length,
      uniqueDevices: new Set(this.frames.map((f) => f.destinationIP)).size,
      writesDetected: this.frames.filter((f) => MODBUS_WRITE_FUNCTION_CODES.has(f.functionCode)).length,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  DNP3 Analyzer — port 20000 (passive)                              */
/* ------------------------------------------------------------------ */

interface Dnp3Frame {
  sourceIP: string;
  destinationIP: string;
  isMaster: boolean;
  functionCode: number;
  objectGroup: number;
  variation: number;
  isUnsolicitedResponse: boolean;
  authFailure: boolean;
  timestamp: Date;
}

export class Dnp3Analyzer {
  private frames: Dnp3Frame[] = [];

  /**
   * Process a parsed DNP3 frame from mirrored traffic.
   * This method NEVER transmits data.
   */
  ingestFrame(frame: Dnp3Frame): OTFinding[] {
    this.frames.push(frame);
    const findings: OTFinding[] = [];

    // Authentication failure — could indicate replay attack or rogue master
    if (frame.authFailure) {
      findings.push({
        type: "unauthorized_access",
        protocol: "dnp3",
        severity: "critical",
        sourceIP: frame.sourceIP,
        destinationIP: frame.destinationIP,
        description:
          `DNP3 authentication failure detected from ${frame.sourceIP}. ` +
          `This may indicate a rogue master station, replay attack, or credential brute-force attempt.`,
        timestamp: frame.timestamp,
      });
    }

    // Unsolicited responses from unexpected sources
    if (frame.isUnsolicitedResponse && frame.isMaster) {
      findings.push({
        type: "anomaly",
        protocol: "dnp3",
        severity: "high",
        sourceIP: frame.sourceIP,
        destinationIP: frame.destinationIP,
        description:
          `DNP3 unsolicited response originated from a master station at ${frame.sourceIP}. ` +
          `Unsolicited responses should only come from outstation (slave) devices. ` +
          `This may indicate spoofing or misconfiguration.`,
        timestamp: frame.timestamp,
      });
    }

    return findings;
  }

  getDiscoveryFindings(): OTFinding[] {
    const outstations = new Set(
      this.frames.filter((f) => !f.isMaster).map((f) => f.sourceIP),
    );
    const masters = new Set(
      this.frames.filter((f) => f.isMaster).map((f) => f.sourceIP),
    );

    const findings: OTFinding[] = [];
    for (const ip of outstations) {
      findings.push({
        type: "asset_discovery",
        protocol: "dnp3",
        severity: "info",
        sourceIP: ip,
        destinationIP: "",
        description: `DNP3 outstation (RTU/IED) discovered at ${ip}.`,
        timestamp: new Date(),
      });
    }
    for (const ip of masters) {
      findings.push({
        type: "asset_discovery",
        protocol: "dnp3",
        severity: "info",
        sourceIP: ip,
        destinationIP: "",
        description: `DNP3 master station (SCADA/HMI) discovered at ${ip}.`,
        timestamp: new Date(),
      });
    }
    return findings;
  }

  getSummary() {
    return {
      totalFrames: this.frames.length,
      authFailures: this.frames.filter((f) => f.authFailure).length,
      unsolicitedResponses: this.frames.filter((f) => f.isUnsolicitedResponse).length,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  BACnet/IP Analyzer — port 47808 (passive)                         */
/* ------------------------------------------------------------------ */

type BacnetServiceType =
  | "who_is"
  | "i_am"
  | "who_has"
  | "i_have"
  | "read_property"
  | "write_property"
  | "read_property_multiple"
  | "write_property_multiple"
  | "confirmed_service"
  | "unconfirmed_service"
  | "other";

interface BacnetFrame {
  sourceIP: string;
  destinationIP: string;
  service: BacnetServiceType;
  deviceId?: number;
  objectType?: string;
  timestamp: Date;
}

const BACNET_WRITE_SERVICES: Set<BacnetServiceType> = new Set([
  "write_property",
  "write_property_multiple",
]);

export class BacnetAnalyzer {
  private frames: BacnetFrame[] = [];
  private discoveredDevices = new Map<number, string>(); // deviceId -> IP

  /**
   * Process a parsed BACnet/IP frame from mirrored traffic.
   * This method NEVER transmits data.
   */
  ingestFrame(frame: BacnetFrame): OTFinding[] {
    this.frames.push(frame);
    const findings: OTFinding[] = [];

    // Track I-Am responses for asset discovery
    if (frame.service === "i_am" && frame.deviceId !== undefined) {
      const existing = this.discoveredDevices.get(frame.deviceId);
      if (existing && existing !== frame.sourceIP) {
        // Same device ID appearing from a different IP — possible rogue device
        findings.push({
          type: "rogue_device",
          protocol: "bacnet",
          severity: "high",
          sourceIP: frame.sourceIP,
          destinationIP: frame.destinationIP,
          description:
            `BACnet device ID ${frame.deviceId} is responding from a new IP address ${frame.sourceIP}. ` +
            `Previously seen at ${existing}. This may indicate a rogue device or IP conflict.`,
          timestamp: frame.timestamp,
        });
      }
      this.discoveredDevices.set(frame.deviceId, frame.sourceIP);
    }

    // Write commands — unauthorized writes to BACnet controllers are high-severity
    if (BACNET_WRITE_SERVICES.has(frame.service)) {
      findings.push({
        type: "unauthorized_access",
        protocol: "bacnet",
        severity: "high",
        sourceIP: frame.sourceIP,
        destinationIP: frame.destinationIP,
        description:
          `BACnet write service detected: ${frame.service} from ${frame.sourceIP} ` +
          `to ${frame.destinationIP}` +
          (frame.objectType ? ` targeting object type: ${frame.objectType}` : "") +
          `. Unauthorized writes to BACnet controllers can alter building/process control settings.`,
        timestamp: frame.timestamp,
      });
    }

    return findings;
  }

  getDiscoveryFindings(): OTFinding[] {
    return Array.from(this.discoveredDevices.entries()).map(([deviceId, ip]) => ({
      type: "asset_discovery" as OTFindingType,
      protocol: "bacnet" as OTProtocol,
      severity: "info" as const,
      sourceIP: ip,
      destinationIP: "",
      description:
        `BACnet/IP device discovered at ${ip} with device ID ${deviceId}.`,
      timestamp: new Date(),
    }));
  }

  getSummary() {
    return {
      totalFrames: this.frames.length,
      discoveredDevices: this.discoveredDevices.size,
      writesDetected: this.frames.filter((f) => BACNET_WRITE_SERVICES.has(f.service)).length,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  OT/SCADA Collector Agent                                           */
/* ------------------------------------------------------------------ */

interface OtCollectorConfig {
  tenantId: string;
}

interface CollectorStatus {
  running: boolean;
  startedAt: Date | null;
  stoppedAt: Date | null;
  findingsCount: number;
  assetsDiscovered: number;
  modbus: ReturnType<ModbusAnalyzer["getSummary"]>;
  dnp3: ReturnType<Dnp3Analyzer["getSummary"]>;
  bacnet: ReturnType<BacnetAnalyzer["getSummary"]>;
}

/**
 * OT/SCADA Passive Collector Agent
 *
 * Orchestrates passive analysis across Modbus, DNP3, and BACnet analyzers.
 * All sub-analyzers are PASSIVE — they only process data fed to them from
 * a SPAN/TAP feed. They NEVER initiate network connections.
 */
export class OtScadaCollectorAgent extends BaseAgent {
  readonly type = "ot-scada-collector";
  readonly displayName = "OT/SCADA Passive Collector";
  readonly supportedIntegrations = ["ot-scada"];

  private modbus = new ModbusAnalyzer();
  private dnp3 = new Dnp3Analyzer();
  private bacnet = new BacnetAnalyzer();
  private registry = new IcsAssetRegistry();

  private running = false;
  private startedAt: Date | null = null;
  private stoppedAt: Date | null = null;
  private collectedFindings: OTFinding[] = [];

  // Starts the passive collector. Transport layer (pcap subscription) is
  // wired up by the infrastructure layer — this provides the ingestion API.
  start(_config: OtCollectorConfig): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = new Date();
    this.stoppedAt = null;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.stoppedAt = new Date();
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): CollectorStatus {
    return {
      running: this.running,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      findingsCount: this.collectedFindings.length,
      assetsDiscovered: this.registry.getSummary().total,
      modbus: this.modbus.getSummary(),
      dnp3: this.dnp3.getSummary(),
      bacnet: this.bacnet.getSummary(),
    };
  }

  getFindings(): OTFinding[] {
    return [...this.collectedFindings];
  }

  getAssets(): IcsAsset[] {
    return this.registry.listAssets();
  }

  getAssetSummary() {
    return this.registry.getSummary();
  }

  // Feed a Modbus frame from the SPAN/TAP capture — called by pcap infrastructure.
  feedModbusFrame(frame: Parameters<ModbusAnalyzer["ingestFrame"]>[0]): void {
    if (!this.running) return;
    const findings = this.modbus.ingestFrame(frame);
    this.collectedFindings.push(...findings);
    this.registry.observe({
      ipAddress: frame.destinationIP,
      protocol: "modbus",
      unitId: frame.unitId,
      purdueLevel: 1, // Modbus targets are typically Level 1 (basic control)
    });
  }

  // Feed a DNP3 frame from the SPAN/TAP capture — called by pcap infrastructure.
  feedDnp3Frame(frame: Parameters<Dnp3Analyzer["ingestFrame"]>[0]): void {
    if (!this.running) return;
    const findings = this.dnp3.ingestFrame(frame);
    this.collectedFindings.push(...findings);
    this.registry.observe({
      ipAddress: frame.sourceIP,
      protocol: "dnp3",
      deviceType: frame.isMaster ? "hmi" : "rtu",
      purdueLevel: frame.isMaster ? 2 : 1,
    });
  }

  // Feed a BACnet frame from the SPAN/TAP capture — called by pcap infrastructure.
  feedBacnetFrame(frame: Parameters<BacnetAnalyzer["ingestFrame"]>[0]): void {
    if (!this.running) return;
    const findings = this.bacnet.ingestFrame(frame);
    this.collectedFindings.push(...findings);
    this.registry.observe({
      ipAddress: frame.sourceIP,
      protocol: "bacnet",
      purdueLevel: 2, // BACnet is typically Level 2 (supervisory)
    });
  }

  // Aggregates buffered passive analysis results — no network activity initiated.
  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;

    try {
      ctx.onProgress(0);

      // Emit Modbus discovery findings
      const modbusDiscovery = this.modbus.getDiscoveryFindings();
      for (const f of modbusDiscovery) {
        await ctx.onFinding(this.toAgentFinding(f));
        findingsCount++;
      }
      ctx.onProgress(33);

      // Emit DNP3 discovery findings
      const dnp3Discovery = this.dnp3.getDiscoveryFindings();
      for (const f of dnp3Discovery) {
        await ctx.onFinding(this.toAgentFinding(f));
        findingsCount++;
      }
      ctx.onProgress(66);

      // Emit BACnet discovery findings
      const bacnetDiscovery = this.bacnet.getDiscoveryFindings();
      for (const f of bacnetDiscovery) {
        await ctx.onFinding(this.toAgentFinding(f));
        findingsCount++;
      }

      // Emit all collected anomaly/alert findings
      for (const f of this.collectedFindings) {
        if (f.type !== "asset_discovery") {
          await ctx.onFinding(this.toAgentFinding(f));
          findingsCount++;
        }
      }
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  async testConnection(_credentialRef: string): Promise<boolean> {
    return true; // Passive — no active connection to test.
  }

  private toAgentFinding(f: OTFinding): import("@blackfyre/shared").AgentFindingPayload {
    return {
      title: `[OT/${f.protocol.toUpperCase()}] ${this.titleForType(f.type, f.protocol)}`,
      description: f.description,
      severity: f.severity,
      // "network" is the closest FindingCategory for OT/SCADA traffic analysis
      category: "network",
      resourceType: f.protocol,
      resourceId: `${f.sourceIP}->${f.destinationIP}`,
      resourceRegion: null,
      remediationTier: f.severity === "critical" || f.severity === "high" ? "approval" : "manual",
      autoFixAvailable: false,
    };
  }

  private titleForType(type: OTFindingType, protocol: OTProtocol): string {
    switch (type) {
      case "asset_discovery": return `${protocol.toUpperCase()} Device Discovered`;
      case "anomaly": return `Anomalous ${protocol.toUpperCase()} Traffic Detected`;
      case "unauthorized_access": return `Unauthorized ${protocol.toUpperCase()} Write Command`;
      case "config_change": return `${protocol.toUpperCase()} Configuration Change`;
      case "rogue_device": return `Rogue ${protocol.toUpperCase()} Device Detected`;
    }
  }
}

/**
 * Singleton collector instance per process.
 * In a multi-tenant deployment this would be keyed by tenantId.
 */
const collectorInstances = new Map<string, OtScadaCollectorAgent>();

export function getCollector(tenantId: string): OtScadaCollectorAgent {
  let collector = collectorInstances.get(tenantId);
  if (!collector) {
    collector = new OtScadaCollectorAgent();
    collectorInstances.set(tenantId, collector);
  }
  return collector;
}
