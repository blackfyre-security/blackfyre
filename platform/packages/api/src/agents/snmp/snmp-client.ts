import * as dgram from "node:dgram";
import * as net from "node:net";
import type { SNMPConfig } from "../snmp-auditor.js";
import { OptionalDependencyMissingError, isOptionalDependencyMissing } from "../optional-dependency.js";

export interface SnmpEntry {
  oid: string;
  value: string;
}

export const OID = {
  sysDescr:    "1.3.6.1.2.1.1.1.0",
  sysObjectID: "1.3.6.1.2.1.1.2.0",
  sysName:     "1.3.6.1.2.1.1.5.0",
} as const;

export type SnmpGetFn  = (ip: string, config: SNMPConfig, oid: string) => Promise<string | null>;
export type SnmpWalkFn = (ip: string, config: SNMPConfig, oidPrefix: string) => Promise<SnmpEntry[]>;
export type PortCheckFn = (host: string, port: number) => Promise<boolean>;

/** Expand CIDR notation and IP ranges to individual IPs. Capped at 254 addresses. */
export function expandTargets(targets: string[]): string[] {
  const ips: string[] = [];
  for (const target of targets) {
    if (target.includes("/")) {
      const [base, mask] = target.split("/");
      const maskBits = Number(mask);
      if (maskBits >= 24) {
        const parts = (base ?? "").split(".").map(Number);
        const hostCount = 2 ** (32 - maskBits) - 2;
        for (let i = 1; i <= Math.min(hostCount, 254); i++) {
          ips.push(`${parts[0]}.${parts[1]}.${parts[2]}.${i}`);
        }
      } else {
        ips.push(base ?? target);
      }
    } else if (target.includes("-")) {
      const [start, end] = target.split("-");
      const startParts = (start ?? "").split(".").map(Number);
      const endLast = Number((end ?? "").split(".").pop() ?? 0);
      for (let i = startParts[3] ?? 1; i <= endLast; i++) {
        ips.push(`${startParts[0]}.${startParts[1]}.${startParts[2]}.${i}`);
      }
    } else {
      ips.push(target);
    }
  }
  return ips.slice(0, 254);
}

/** Build a minimal SNMP v2c GET PDU for sysDescr as a lightweight probe. */
function buildSnmpV2cGetPdu(community: Buffer): Buffer {
  const oid = Buffer.from([0x30, 0x0d, 0x06, 0x09, 0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00, 0x05, 0x00]);
  const reqId = Buffer.from([0x02, 0x04, 0x00, 0x00, 0x00, 0x01]);
  const errStatus = Buffer.from([0x02, 0x01, 0x00]);
  const errIndex = Buffer.from([0x02, 0x01, 0x00]);
  const varBindList = Buffer.concat([Buffer.from([0x30, oid.length]), oid]);
  const pduContent = Buffer.concat([reqId, errStatus, errIndex, Buffer.from([0x30, varBindList.length]), varBindList]);
  const getPdu = Buffer.concat([Buffer.from([0xa0, pduContent.length]), pduContent]);
  const communityField = Buffer.concat([Buffer.from([0x04, community.length]), community]);
  const version = Buffer.from([0x02, 0x01, 0x01]); // v2c = 1
  const seqContent = Buffer.concat([version, communityField, getPdu]);
  return Buffer.concat([Buffer.from([0x30, seqContent.length]), seqContent]);
}

function parseSnmpResponse(msg: Buffer): string | null {
  try {
    let i = 0;
    while (i < msg.length - 2) {
      if (msg[i] === 0x04) {
        const len = msg[i + 1] ?? 0;
        if (len > 0 && i + 2 + len <= msg.length) {
          const value = msg.slice(i + 2, i + 2 + len).toString("ascii");
          if (value.length > 3) return value;
        }
      }
      i++;
    }
    return "";
  } catch (err) {
    // A missing optional dependency is a real, actionable condition — never let the
    // catch-all turn it back into a silent empty result.
    if (isOptionalDependencyMissing(err)) throw err;
    return null;
  }
}

async function snmpGetV2c(ip: string, community: string): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const timeout = setTimeout(() => { socket.close(); resolve(null); }, 3000);
    const communityBytes = Buffer.from(community, "ascii");
    const pdu = buildSnmpV2cGetPdu(communityBytes);

    socket.on("error", () => { clearTimeout(timeout); socket.close(); resolve(null); });
    socket.on("message", (msg) => { clearTimeout(timeout); socket.close(); resolve(parseSnmpResponse(msg)); });
    socket.send(pdu, 0, pdu.length, 161, ip, (err) => {
      if (err) { clearTimeout(timeout); socket.close(); resolve(null); }
    });
  });
}

async function snmpGetV3(ip: string, config: SNMPConfig): Promise<string | null> {
  try {
    // net-snmp is an OPTIONAL dependency (see agents/optional-dependency.ts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const netSnmp = await import("net-snmp" as any).catch(() => null) as any;
    if (!netSnmp) {
      throw new OptionalDependencyMissingError("net-snmp", "SNMP device auditing");
    }
    if (!config.auth) return null;

    return await new Promise<string | null>((resolve) => {
      const session = netSnmp.createV3Session(ip, {
        name: config.auth!.user,
        level: config.auth!.privProtocol ? netSnmp.SecurityLevel.authPriv : netSnmp.SecurityLevel.authNoPriv,
        authProtocol: config.auth!.authProtocol === "SHA" ? netSnmp.AuthProtocols.sha : netSnmp.AuthProtocols.md5,
        authKey: config.auth!.authKey,
        privProtocol: config.auth!.privProtocol === "AES" ? netSnmp.PrivProtocols.aes : config.auth!.privProtocol === "DES" ? netSnmp.PrivProtocols.des : undefined,
        privKey: config.auth!.privKey,
      }, { version: netSnmp.Version3, transport: "udp4", timeout: 3000, retries: 1 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.get([OID.sysDescr], (err: any, varbinds: any[]) => {
        session.close();
        if (err || !varbinds[0]) { resolve(null); return; }
        resolve(String(varbinds[0].value ?? ""));
      });
    });
  } catch (err) {
    // A missing optional dependency is a real, actionable condition — never let the
    // catch-all turn it back into a silent empty result.
    if (isOptionalDependencyMissing(err)) throw err;
    return null;
  }
}

export async function snmpGet(ip: string, config: SNMPConfig, _oid: string): Promise<string | null> {
  if (config.version === "v3") return snmpGetV3(ip, config);
  return snmpGetV2c(ip, config.community ?? "public");
}

export async function snmpWalk(ip: string, config: SNMPConfig, oidPrefix: string): Promise<SnmpEntry[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const netSnmp = await import("net-snmp" as any).catch(() => null) as any;
    if (!netSnmp) {
      throw new OptionalDependencyMissingError("net-snmp", "SNMP device auditing");
    }

    const session = config.version === "v3" && config.auth
      ? netSnmp.createV3Session(ip, {
          name: config.auth.user,
          level: config.auth.privProtocol ? netSnmp.SecurityLevel.authPriv : netSnmp.SecurityLevel.authNoPriv,
          authProtocol: config.auth.authProtocol === "SHA" ? netSnmp.AuthProtocols.sha : netSnmp.AuthProtocols.md5,
          authKey: config.auth.authKey,
        }, { version: netSnmp.Version3, transport: "udp4", timeout: 5000, retries: 1 })
      : netSnmp.createSession(ip, config.community ?? "public", { version: netSnmp.Version2c, transport: "udp4", timeout: 5000, retries: 1 });

    return await new Promise<SnmpEntry[]>((resolve) => {
      const entries: SnmpEntry[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.subtree(oidPrefix, 50, (varbinds: any[]) => {
        for (const vb of varbinds) entries.push({ oid: vb.oid, value: String(vb.value ?? "") });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (_err: any) => { session.close(); resolve(entries); });
    });
  } catch (err) {
    if (isOptionalDependencyMissing(err)) throw err;
    return [];
  }
}

export function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.on("error", () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}
