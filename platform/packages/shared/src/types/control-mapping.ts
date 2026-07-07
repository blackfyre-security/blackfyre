export const Framework = {
  SOC2: "soc2",
  ISO27001: "iso27001",
  HIPAA: "hipaa",
  GDPR: "gdpr",
  PCIDSS: "pcidss",
  DPDPA: "dpdpa",
  ISO42001: "iso42001",
  PDPPL: "pdppl",
  NIST80053: "nist80053",
} as const;
export type Framework = (typeof Framework)[keyof typeof Framework];

export const ControlStatus = {
  PASS: "pass",
  PARTIAL: "partial",
  FAIL: "fail",
  NA: "na",
} as const;
export type ControlStatus = (typeof ControlStatus)[keyof typeof ControlStatus];

export const ControlWeight = {
  STANDARD: 1,
  IMPORTANT: 2,
  CRITICAL: 3,
} as const;
export type ControlWeight = (typeof ControlWeight)[keyof typeof ControlWeight];

export interface ControlMapping {
  id: string;
  findingId: string;
  framework: Framework;
  controlId: string;
  controlName: string;
  status: ControlStatus;
  weight: number;
}
