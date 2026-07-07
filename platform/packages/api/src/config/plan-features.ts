import { PLANS } from "@blackfyre/shared";

export interface PlanFeatures {
  name: string;
  displayName: string;
  monthlyPrice: number;
  clouds: number;           // max cloud accounts (-1 = unlimited)
  frameworks: string[];     // allowed compliance frameworks
  scanFrequency: string;    // daily, weekly, monthly, continuous
  aiAnalysis: boolean;
  evidenceVault: boolean;
  continuousMonitoring: boolean;
  threatIntel: boolean;
  apiAccess: boolean;
  slaHours: number;         // support SLA in hours
  maxUsers: number;         // -1 = unlimited
  customReports: boolean;
}

export const PLAN_FEATURES: Record<string, PlanFeatures> = {
  comply: {
    name: "comply",
    displayName: PLANS.comply.name,
    monthlyPrice: PLANS.comply.priceMonthlyINR,
    clouds: PLANS.comply.cloudsLimit === "unlimited" ? -1 : PLANS.comply.cloudsLimit,
    frameworks: ["soc2", "iso27001"],
    scanFrequency: PLANS.comply.scanCadence,
    aiAnalysis: PLANS.comply.aiEnabled,
    evidenceVault: true,
    continuousMonitoring: false,
    threatIntel: false,
    apiAccess: false,
    slaHours: 48,
    maxUsers: PLANS.comply.usersLimit === "unlimited" ? -1 : PLANS.comply.usersLimit,
    customReports: false,
  },
  protect: {
    name: "protect",
    displayName: PLANS.protect.name,
    monthlyPrice: PLANS.protect.priceMonthlyINR,
    clouds: PLANS.protect.cloudsLimit === "unlimited" ? -1 : PLANS.protect.cloudsLimit,
    frameworks: ["soc2", "iso27001", "hipaa", "gdpr", "pci_dss", "dpdpa"],
    scanFrequency: PLANS.protect.scanCadence,
    aiAnalysis: PLANS.protect.aiEnabled,
    evidenceVault: true,
    continuousMonitoring: false,
    threatIntel: false,
    apiAccess: true,
    slaHours: 24,
    maxUsers: PLANS.protect.usersLimit === "unlimited" ? -1 : PLANS.protect.usersLimit,
    customReports: true,
  },
  defend: {
    name: "defend",
    displayName: PLANS.defend.name,
    monthlyPrice: PLANS.defend.priceMonthlyINR,
    clouds: -1,  // unlimited
    frameworks: ["soc2", "iso27001", "hipaa", "gdpr", "pci_dss", "dpdpa", "iso42001", "pdppl"],
    scanFrequency: PLANS.defend.scanCadence,
    aiAnalysis: PLANS.defend.aiEnabled,
    evidenceVault: true,
    continuousMonitoring: true,
    threatIntel: true,
    apiAccess: true,
    slaHours: 4,
    maxUsers: -1,  // unlimited
    customReports: true,
  },
};
