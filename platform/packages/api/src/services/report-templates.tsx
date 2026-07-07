/**
 * @react-pdf templates for the tamper-evident export-report flow.
 *
 * Each template renders a one-to-two-page PDF whose first page is a cover
 * card with the BLACKFYRE wordmark, tenant account number, the SHA-256
 * fingerprint of the unsigned PDF bytes, and a visual "Digitally Signed"
 * stamp. The real PKCS#7 signature is appended post-render in
 * `report-export-service.ts`.
 *
 * Color palette: sober slate-9xx + a single accent (green-400). Matches the
 * dark admin shell.
 */
import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ---- Shared style tokens ---------------------------------------------------

const COLORS = {
  bg: "#0A0A0B",
  surface: "#16171A",
  border: "#262830",
  text: "#F5F6F7",
  textMuted: "#9CA0AC",
  textDim: "#6B6F7B",
  accent: "#00E68A",
  critical: "#FF4A4A",
  high: "#FFB347",
  medium: "#5BC2FF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    padding: 40,
    fontSize: 10.5,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  wordmark: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 2,
    color: COLORS.accent,
  },
  wordmarkSub: {
    fontSize: 8,
    color: COLORS.textDim,
    marginTop: 2,
    letterSpacing: 1,
  },
  reportType: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 24,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
    borderTop: `1pt solid ${COLORS.border}`,
    borderBottom: `1pt solid ${COLORS.border}`,
    paddingVertical: 12,
  },
  metaCell: {
    width: "33%",
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 7.5,
    color: COLORS.textDim,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 11,
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    border: `1pt solid ${COLORS.border}`,
    backgroundColor: COLORS.surface,
    padding: 14,
    marginBottom: 10,
    borderRadius: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottom: `0.5pt solid ${COLORS.border}`,
  },
  rowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  fingerprintBox: {
    border: `1pt solid ${COLORS.accent}`,
    backgroundColor: "#0E1F18",
    padding: 12,
    marginTop: 12,
    borderRadius: 4,
  },
  fingerprintLabel: {
    fontSize: 7.5,
    color: COLORS.accent,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  fingerprintHex: {
    fontFamily: "Courier",
    fontSize: 9,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  fingerprintHint: {
    fontSize: 8,
    color: COLORS.textDim,
    marginTop: 6,
  },
  stamp: {
    position: "absolute",
    right: 40,
    top: 40,
    border: `1.5pt solid ${COLORS.accent}`,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    transform: "rotate(-6deg)",
  },
  stampTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.accent,
    letterSpacing: 1.5,
  },
  stampSub: {
    fontSize: 6.5,
    color: COLORS.accent,
    letterSpacing: 1,
    marginTop: 1,
  },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COLORS.textDim,
    letterSpacing: 0.5,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    fontSize: 8,
    fontFamily: "Courier",
  },
});

// ---- Shared shapes --------------------------------------------------------

export interface CoverContext {
  tenantName: string;
  accountNumber: string;
  generatedAt: string;
  generatedBy: string;
  sha256: string;
}

interface CoverProps extends CoverContext {
  title: string;
  reportType: string;
  subtitle?: string;
}

function CoverHeader(props: CoverProps): React.ReactElement {
  return (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.wordmark}>BLACKFYRE</Text>
          <Text style={styles.wordmarkSub}>REPORTING AUTHORITY</Text>
        </View>
        <Text style={styles.reportType}>{props.reportType}</Text>
      </View>

      <View style={styles.stamp}>
        <Text style={styles.stampTitle}>DIGITALLY SIGNED</Text>
        <Text style={styles.stampSub}>PKCS#7 · SHA-256</Text>
      </View>

      <Text style={styles.title}>{props.title}</Text>
      {props.subtitle && <Text style={styles.subtitle}>{props.subtitle}</Text>}

      <View style={styles.metaGrid}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Tenant</Text>
          <Text style={styles.metaValue}>{props.tenantName}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Account №</Text>
          <Text style={styles.metaValue}>{props.accountNumber}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Generated</Text>
          <Text style={styles.metaValue}>{props.generatedAt}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>By</Text>
          <Text style={styles.metaValue}>{props.generatedBy}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Issuer</Text>
          <Text style={styles.metaValue}>BLACKFYRE Reporting Authority</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Validity</Text>
          <Text style={styles.metaValue}>Verifiable via fingerprint</Text>
        </View>
      </View>

      <View style={styles.fingerprintBox}>
        <Text style={styles.fingerprintLabel}>SHA-256 fingerprint</Text>
        <Text style={styles.fingerprintHex}>{formatHex(props.sha256)}</Text>
        <Text style={styles.fingerprintHint}>
          Verify at https://blackfyre.tech/verify/{props.sha256}
        </Text>
      </View>
    </View>
  );
}

function Footer(props: { sha256: string }): React.ReactElement {
  return (
    <View style={styles.footer} fixed>
      <Text>BLACKFYRE · CONFIDENTIAL</Text>
      <Text>{props.sha256.slice(0, 16)}…</Text>
    </View>
  );
}

function formatHex(hex: string): string {
  // Insert a space every 8 chars for readability.
  return hex.replace(/(.{8})/g, "$1 ").trim();
}

// ---- Tenant Health --------------------------------------------------------

export interface TenantHealthData {
  postureScore: number;
  plan: string;
  monthlyPriceInr: number | null;
  findings: { critical: number; high: number; medium: number; low: number };
  evidenceCount: number;
  agentsActive: number;
}

export function TenantHealthReport(props: {
  cover: CoverContext;
  data: TenantHealthData;
}): React.ReactElement {
  const { cover, data } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <CoverHeader
          {...cover}
          title="Tenant Health Report"
          reportType="TENANT · HEALTH"
          subtitle="Posture, findings, and evidence at-a-glance."
        />

        <Text style={styles.sectionTitle}>Posture</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text>Posture score</Text>
            <Text style={{ color: COLORS.accent, fontWeight: 700 }}>
              {data.postureScore.toFixed(1)} / 100
            </Text>
          </View>
          <View style={styles.row}>
            <Text>Plan</Text>
            <Text>{data.plan}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text>Monthly price (INR)</Text>
            <Text>
              {data.monthlyPriceInr != null
                ? `\u20B9${data.monthlyPriceInr.toLocaleString("en-IN")}`
                : "\u2014"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Findings by severity</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text>Critical</Text>
            <Text style={{ color: COLORS.critical }}>{data.findings.critical}</Text>
          </View>
          <View style={styles.row}>
            <Text>High</Text>
            <Text style={{ color: COLORS.high }}>{data.findings.high}</Text>
          </View>
          <View style={styles.row}>
            <Text>Medium</Text>
            <Text style={{ color: COLORS.medium }}>{data.findings.medium}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text>Low</Text>
            <Text>{data.findings.low}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Coverage</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text>Active agents</Text>
            <Text>{data.agentsActive}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text>Evidence artefacts</Text>
            <Text>{data.evidenceCount.toLocaleString()}</Text>
          </View>
        </View>

        <Footer sha256={cover.sha256} />
      </Page>
    </Document>
  );
}

// ---- Compliance Overview --------------------------------------------------

export interface ComplianceOverviewData {
  frameworks: Array<{ framework: string; score: number; status: string; controls: number }>;
}

export function ComplianceOverviewReport(props: {
  cover: CoverContext;
  data: ComplianceOverviewData;
}): React.ReactElement {
  const { cover, data } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <CoverHeader
          {...cover}
          title="Compliance Overview"
          reportType="COMPLIANCE · OVERVIEW"
          subtitle="Framework-by-framework posture snapshot."
        />

        <Text style={styles.sectionTitle}>Frameworks</Text>
        <View style={styles.card}>
          {data.frameworks.length === 0 && (
            <Text style={{ color: COLORS.textMuted }}>
              No frameworks enrolled for this tenant.
            </Text>
          )}
          {data.frameworks.map((fw, i) => (
            <View
              key={fw.framework}
              style={i === data.frameworks.length - 1 ? styles.rowLast : styles.row}
            >
              <Text style={{ width: "30%", textTransform: "uppercase" }}>
                {fw.framework}
              </Text>
              <Text style={{ width: "20%", color: COLORS.textMuted }}>
                {fw.controls} controls
              </Text>
              <Text style={{ width: "20%" }}>{fw.status}</Text>
              <Text
                style={{
                  width: "20%",
                  textAlign: "right",
                  color: fw.score >= 90 ? COLORS.accent : COLORS.high,
                  fontWeight: 700,
                }}
              >
                {fw.score.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>

        <Footer sha256={cover.sha256} />
      </Page>
    </Document>
  );
}

// ---- Findings Roll-up ------------------------------------------------------

export interface FindingsRollupData {
  findings: Array<{
    id: string;
    title: string;
    severity: string;
    category: string;
    createdAt: string;
  }>;
}

export function FindingsRollupReport(props: {
  cover: CoverContext;
  data: FindingsRollupData;
}): React.ReactElement {
  const { cover, data } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <CoverHeader
          {...cover}
          title="Findings Roll-up"
          reportType="FINDINGS · ROLLUP"
          subtitle={`Top ${Math.min(data.findings.length, 20)} open findings.`}
        />

        <Text style={styles.sectionTitle}>Top open findings</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={{ width: "10%", color: COLORS.textDim }}>SEV</Text>
            <Text style={{ width: "20%", color: COLORS.textDim }}>CATEGORY</Text>
            <Text style={{ width: "50%", color: COLORS.textDim }}>TITLE</Text>
            <Text style={{ width: "20%", color: COLORS.textDim, textAlign: "right" }}>
              OPENED
            </Text>
          </View>
          {data.findings.slice(0, 20).map((f, i) => {
            const sevColor =
              f.severity === "critical"
                ? COLORS.critical
                : f.severity === "high"
                  ? COLORS.high
                  : f.severity === "medium"
                    ? COLORS.medium
                    : COLORS.textMuted;
            const isLast = i === Math.min(data.findings.length, 20) - 1;
            return (
              <View key={f.id} style={isLast ? styles.rowLast : styles.row}>
                <Text style={{ width: "10%", color: sevColor, fontWeight: 700 }}>
                  {f.severity.slice(0, 4).toUpperCase()}
                </Text>
                <Text style={{ width: "20%", color: COLORS.textMuted }}>
                  {f.category}
                </Text>
                <Text style={{ width: "50%" }}>
                  {f.title.length > 70 ? f.title.slice(0, 67) + "..." : f.title}
                </Text>
                <Text
                  style={{ width: "20%", textAlign: "right", color: COLORS.textDim }}
                >
                  {f.createdAt.slice(0, 10)}
                </Text>
              </View>
            );
          })}
        </View>

        <Footer sha256={cover.sha256} />
      </Page>
    </Document>
  );
}
