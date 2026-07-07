export const TenantPlan = {
  COMPLY: "comply",
  PROTECT: "protect",
  DEFEND: "defend",
} as const;
export type TenantPlan = (typeof TenantPlan)[keyof typeof TenantPlan];

export const IndustryProfile = {
  FINTECH: "fintech",
  HEALTHTECH: "healthtech",
  SAAS: "saas",
  ECOMMERCE: "ecommerce",
  AITECH: "aitech",
  CUSTOM: "custom",
  GOVERNMENT: "government",
} as const;
export type IndustryProfile = (typeof IndustryProfile)[keyof typeof IndustryProfile];

export const OnboardingStatus = {
  PENDING: "pending",
  CONFIGURING: "configuring",
  SCANNING: "scanning",
  ACTIVE: "active",
  SUSPENDED: "suspended",
} as const;
export type OnboardingStatus = (typeof OnboardingStatus)[keyof typeof OnboardingStatus];

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  industryProfile: IndustryProfile;
  onboardingStatus: OnboardingStatus;
  createdAt: Date;
  updatedAt: Date;
}
