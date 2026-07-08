export interface Stat {
  value: string;
  label: string;
  numericValue: number;
  suffix: string;
}

export interface Service {
  name: string;
  description: string;
  tags: string[];
}

export interface ServiceCategory {
  id: string;
  label: string;
  services: Service[];
}

export interface ApproachStep {
  number: number;
  title: string;
  description: string;
}

export interface Differentiator {
  title: string;
  description: string;
}

export interface PlatformTier {
  name: string;
  price: string;
  basePrice: number; // INR monthly price for currency conversion
  period: string;
  badge?: string;
  description: string;
  features: string[];
  cta: string;
}

export interface ProfessionalService {
  name: string;
  price: string;
  basePrice: number;
  unit: string; // "mo", "hr", "project"
  description: string;
}

export const stats: Stat[] = [
  { value: "55", label: "Cloud & On-Prem Auditors", numericValue: 55, suffix: "" },
  { value: "9", label: "Compliance Frameworks", numericValue: 9, suffix: "" },
  { value: "678", label: "Mapped Controls", numericValue: 678, suffix: "" },
  { value: "3", label: "Clouds + On-Prem", numericValue: 3, suffix: "" },
];

export const serviceCategories: ServiceCategory[] = [
  {
    id: "security",
    label: "Security",
    services: [
      {
        name: "Audit & Compliance",
        description: "Navigate compliance from readiness through certification.",
        tags: ["SOC 2 Type I & II", "ISO 27001:2022", "HIPAA", "GDPR", "PCI-DSS v4.0", "DPDPA", "CERT-In", "RBI Cyber Framework"],
      },
      {
        name: "vCISO Services",
        description: "Strategic security leadership on demand.",
        tags: ["Security Strategy", "Risk Management", "Board Reporting"],
      },
      {
        name: "VAPT / Penetration Testing",
        description: "Find vulnerabilities before attackers do. Critical findings receive same-day escalation with remediation guidance.",
        tags: ["Web App", "API", "Mobile", "Network", "Cloud", "Red Team"],
      },
      {
        name: "Endpoint Security",
        description: "Deploy and manage advanced endpoint protection. Vendor-neutral: we evaluate and recommend based on your environment and budget.",
        tags: ["EDR/XDR", "EPP", "Defender", "Open-Source Options", "Managed Detection"],
      },
      {
        name: "Security Architecture",
        description: "Security architecture design and implementation scoped to your environment, compliance requirements, and budget.",
        tags: ["Zero Trust", "SIEM", "SOAR", "Security Automation", "Splunk", "Elastic", "Datadog"],
      },
    ],
  },
  {
    id: "identity",
    label: "Identity & Devices",
    services: [
      {
        name: "MDM & Device Management",
        description: "End-to-end device lifecycle and compliance enforcement across platforms.",
        tags: ["macOS", "Windows", "Mobile", "Zero-Touch Enrollment", "Compliance Enforcement"],
      },
      {
        name: "Identity & Access Management",
        description: "Centralize authentication, enforce least privilege. Platform-agnostic — we select the best-fit IdP for your stack.",
        tags: ["SSO/MFA", "Directory Services", "Lifecycle Automation", "Least Privilege"],
      },
    ],
  },
  {
    id: "cloud",
    label: "Cloud & Infra",
    services: [
      {
        name: "Cloud Services",
        description: "Architecture, hardening, and cost optimization.",
        tags: ["AWS", "Azure", "GCP", "Multi-Cloud", "FinOps"],
      },
      {
        name: "Cloud Managed Services",
        description: "Continuous monitoring, incident response, and optimization.",
        tags: ["Continuous Monitoring", "Automated DR", "IaC", "Compliance Automation"],
      },
      {
        name: "Infrastructure Services",
        description: "Modernize your IT backbone.",
        tags: ["Network", "Server & Storage", "DR/BCP"],
      },
      {
        name: "Private Cloud Hosting",
        description: "Dedicated, compliant hosting for regulated industries.",
        tags: ["Dedicated Infra", "Up to 99.95% SLA", "Managed Patching"],
      },
    ],
  },
  {
    id: "ai",
    label: "AI Security",
    services: [
      {
        name: "AI Security",
        description: "Protect your AI/ML stack from adversarial attacks, RAG pipelines, and model supply chains.",
        tags: ["LLM Threat Assessment", "Prompt Injection", "AI Red Teaming", "Model Supply Chain", "RAG Pipeline Security", "LLM Guard", "Lakera", "Prompt Armor"],
      },
      {
        name: "AI Compliance & Ethics",
        description: "Navigate AI regulation and governance frameworks. EU AI Act enforcement began Aug 2025 with full obligations phased through 2026. Bias assessments use industry-standard methodologies with clearly defined scope and limitations.",
        tags: ["EU AI Act", "NIST AI RMF", "Algorithmic Assessment", "AI Governance"],
      },
    ],
  },
];

export const approachSteps: ApproachStep[] = [
  { number: 1, title: "Discover", description: "Free 30-min discovery call. No slides, no pitch — honest conversation about what you need. You receive a Discovery Summary with recommended next steps within 24 hours." },
  { number: 2, title: "Assess", description: "Deep dive into your security posture, infrastructure, and compliance gaps. Deliverable: a Security Posture Assessment report with risks quantified and priorities ranked." },
  { number: 3, title: "Plan", description: "Tailored roadmap with prioritized actions, realistic timelines, and a detailed Statement of Work with fixed-scope, transparent pricing." },
  { number: 4, title: "Execute", description: "Hands-on implementation alongside your team. Deploy, configure, harden, test. Critical findings from VAPT get a same-day escalation briefing." },
  { number: 5, title: "Verify", description: "Every deliverable validated. Pen test findings confirmed remediated. Controls tested. You receive a signed Verification Report." },
  { number: 6, title: "Partner", description: "Project clients convert to retainers at preferred rates. Quarterly security reviews, evolving threat response, and a dedicated point of contact." },
];

export const differentiators: Differentiator[] = [
  { title: "Practitioner-Led", description: "Senior practitioners bring deep hands-on experience — no junior consultants reading playbooks." },
  { title: "Vendor-Neutral", description: "We evaluate tools across vendors and recommend based purely on your stack, risk profile, and budget. No reseller commissions, no vendor lock-in." },
  { title: "Startup-Native", description: "We design pricing, timelines, and deliverables for teams of 5-500." },
  { title: "AI-Era Ready", description: "Dedicated AI security and AI compliance practices for the regulatory landscape arriving now." },
  { title: "Full Stack", description: "From compliance and pentesting to MDM, identity, cloud, and infrastructure — one partner." },
  { title: "Outcome-Oriented", description: "Actionable roadmaps, hands-on implementation, and measurable risk reduction." },
];

export const platformTiers: PlatformTier[] = [
  {
    name: "Comply",
    price: "₹14,999",
    basePrice: 14999,
    period: "/mo",
    description: "Automated compliance scanning, evidence vault, and audit-ready reports.",
    features: [
      "6 compliance frameworks (SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, DPDPA)",
      "Tamper-evident evidence vault (S3 WORM)",
      "Automated evidence collection & SHA-256 integrity",
      "One-click audit bundle export (PDF + artifacts)",
      "Compliance score tracking & trend dashboard",
      "Email alerts & scheduled scan reports",
    ],
    cta: "Talk to us",
  },
  {
    name: "Protect",
    price: "₹49,999",
    basePrice: 49999,
    period: "/mo",
    badge: "Most Popular",
    description: "Full security posture across cloud, on-prem, and endpoints with AI-powered remediation.",
    features: [
      "Everything in Comply",
      "Multi-cloud scanning (AWS, Azure, GCP) — 10-min reports",
      "On-premise agent (Windows/Linux, Active Directory, SNMP)",
      "VAPT scanning with MITRE ATT&CK mapping",
      "AI-powered gap analysis & remediation playbooks",
      "Real-time SSE dashboard with live findings",
      "Human-approved remediation with impact preview",
      "Slack & webhook integrations",
    ],
    cta: "Talk to us",
  },
  {
    name: "Defend",
    price: "₹1,19,999",
    basePrice: 119999,
    period: "/mo",
    description: "Autonomous, continuous defense with threat intelligence, OT/SCADA, and regulatory SLA tracking.",
    features: [
      "Everything in Protect",
      "Continuous monitoring & drift detection",
      "CVE/KEV threat intelligence correlation",
      "OT/SCADA passive scanning (Modbus, DNP3, BACnet)",
      "CERT-In 6-hour SLA tracking & priority alerts",
      "Stakeholder dashboard with client branding",
      "Dedicated support & custom integrations",
      "DPDPA transparency dashboard & data erasure",
    ],
    cta: "Talk to us",
  },
];

export const professionalServices: ProfessionalService[] = [
  {
    name: "vCISO Services",
    price: "₹1,50,000/mo",
    basePrice: 150000,
    unit: "mo",
    description: "Strategic security leadership, risk management, and board-level reporting on demand.",
  },
  {
    name: "VAPT / Pen Testing",
    price: "From ₹3,00,000",
    basePrice: 300000,
    unit: "project",
    description: "Web, API, mobile, network, and cloud penetration testing with same-day critical escalation.",
  },
  {
    name: "Compliance Advisory",
    price: "From ₹4,50,000",
    basePrice: 450000,
    unit: "project",
    description: "End-to-end compliance readiness through certification — SOC 2, ISO 27001, HIPAA, and more.",
  },
  {
    name: "Security Architecture",
    price: "From ₹5,00,000",
    basePrice: 500000,
    unit: "project",
    description: "Zero Trust design, SIEM/SOAR implementation, and security automation for your environment.",
  },
  {
    name: "AI Security Assessment",
    price: "From ₹4,00,000",
    basePrice: 400000,
    unit: "project",
    description: "LLM threat assessment, prompt injection testing, RAG pipeline security, and AI governance review.",
  },
  {
    name: "Incident Response",
    price: "₹15,000/hr",
    basePrice: 15000,
    unit: "hr",
    description: "Emergency incident containment, forensics, and recovery with 24/7 availability.",
  },
];

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
  rate: number; // multiplier from INR base
}

export const currencies: CurrencyOption[] = [
  { code: "INR", symbol: "₹", label: "India (INR)", rate: 1 },
  { code: "USD", symbol: "$", label: "United States (USD)", rate: 0.012 },
  { code: "GBP", symbol: "£", label: "United Kingdom (GBP)", rate: 0.0094 },
  { code: "EUR", symbol: "€", label: "Europe (EUR)", rate: 0.011 },
  { code: "AED", symbol: "AED ", label: "UAE (AED)", rate: 0.044 },
  { code: "SAR", symbol: "SAR ", label: "Saudi Arabia (SAR)", rate: 0.045 },
  { code: "SGD", symbol: "S$", label: "Singapore (SGD)", rate: 0.016 },
  { code: "AUD", symbol: "A$", label: "Australia (AUD)", rate: 0.018 },
];

export interface ServiceOffering {
  title: string;
  description: string;
  icon: string; // Lucide icon name
  section: "security" | "technology" | "development";
  href?: string; // Optional dedicated landing page; falls back to /book when absent
}

export const serviceOfferings: ServiceOffering[] = [
  {
    title: "vCISO",
    description: "Virtual Chief Information Security Officer. Fractional security leadership for startups and mid-market.",
    icon: "Shield",
    section: "security",
  },
  {
    title: "VAPT / Pen Testing",
    description: "Vulnerability assessment and penetration testing across web, mobile, API, and infrastructure.",
    icon: "Bug",
    section: "security",
  },
  {
    title: "Compliance Advisory",
    description: "SOC 2, ISO 27001, HIPAA, GDPR, DPDPA readiness and audit preparation.",
    icon: "ClipboardCheck",
    section: "security",
  },
  {
    title: "Security Architecture",
    description: "Design and review of security architecture for cloud-native and hybrid environments.",
    icon: "Network",
    section: "security",
  },
  {
    title: "Cloud Security",
    description: "AWS, Azure, GCP security posture management, hardening, and incident response.",
    icon: "Cloud",
    section: "security",
  },
  {
    title: "AI Security",
    description: "LLM pipeline security, prompt injection defense, AI governance frameworks.",
    icon: "Brain",
    section: "security",
  },
  {
    title: "Identity & Access",
    description: "Deploy and manage Okta, Azure AD / Entra ID, and JumpCloud. SSO, MFA, lifecycle automation.",
    icon: "Key",
    section: "technology",
  },
  {
    title: "Endpoint & MDM",
    description: "Jamf, Kandji, and JumpCloud MDM. Device enrollment, compliance policies, zero-touch deployment.",
    icon: "Monitor",
    section: "technology",
  },
  {
    title: "Google Workspace",
    description: "Migration, deployment, security configuration, and ongoing management for Google Workspace.",
    icon: "Mail",
    section: "technology",
  },
  {
    title: "ITSM & Service Desk",
    description: "Freshworks and Freshservice implementation. Workflow automation, SLA management, integrations.",
    icon: "Headphones",
    section: "technology",
  },
  {
    title: "Mobile App Development",
    description: "Android and iOS MVP prototypes. Native and cross-platform development.",
    icon: "Smartphone",
    section: "development",
    href: "/mobile-app-development",
  },
  {
    title: "Website Design & Development",
    description: "Marketing sites, web applications, and SaaS dashboards.",
    icon: "Globe",
    section: "development",
    href: "/web-development",
  },
];

export interface EngagementModel {
  title: string;
  description: string;
}

export const engagementModels: EngagementModel[] = [
  {
    title: "Monthly Retainer",
    description: "Ongoing security partnership with dedicated hours, regular assessments, and priority support.",
  },
  {
    title: "Project-Based",
    description: "Fixed-scope engagements with clear deliverables, timelines, and milestones.",
  },
  {
    title: "Hourly (T&M)",
    description: "Flexible time-and-materials for advisory, incident response, and ad-hoc security needs.",
  },
  {
    title: "Annual Contract",
    description: "Comprehensive yearly security coverage with discounted rates and guaranteed availability.",
  },
];

export interface PlatformFeature {
  title: string;
  description: string;
  icon: string;
}

export const platformFeatures: PlatformFeature[] = [
  {
    title: "Multi-Cloud Scanning",
    description: "55 auditors cover IAM, storage, compute, networking, encryption, logging, database, monitoring, and containers across AWS, Azure, GCP, and on-premises — plus Prowler and Checkov/Semgrep/Bandit.",
    icon: "Layers",
  },
  {
    title: "9 Compliance Frameworks",
    description: "SOC 2, ISO 27001, HIPAA, GDPR, PCI DSS, DPDPA, ISO 42001, PDPPL, and NIST 800-53 — 678 controls with weighted per-framework scoring.",
    icon: "ShieldCheck",
  },
  {
    title: "AI-Powered Analysis",
    description: "Gap analysis, MITRE ATT&CK mapping, risk assessment, and remediation recommendations.",
    icon: "Brain",
  },
  {
    title: "Evidence Vault",
    description: "Tamper-evident evidence collection with SHA-256 integrity verification and S3 WORM storage.",
    icon: "Lock",
  },
  {
    title: "Drift Detection",
    description: "Real-time configuration change monitoring with severity-rated alerts and audit trails.",
    icon: "Activity",
  },
  {
    title: "Real-Time Dashboard",
    description: "SSE-powered live scan progress, finding discovery, and compliance score updates.",
    icon: "Monitor",
  },
];

export interface TierFeatureRow {
  feature: string;
  comply: string;
  protect: string;
  defend: string;
}

export const tierComparison: TierFeatureRow[] = [
  { feature: "Cloud Providers", comply: "1", protect: "Up to 3", defend: "Unlimited" },
  { feature: "Compliance Frameworks", comply: "2", protect: "6", defend: "All 9" },
  { feature: "Scan Frequency", comply: "Weekly", protect: "Daily", defend: "Continuous" },
  { feature: "AI Analysis", comply: "—", protect: "Yes", defend: "Yes + Threat Intel" },
  { feature: "Users", comply: "5", protect: "25", defend: "Unlimited" },
  { feature: "SLA", comply: "48 hours", protect: "24 hours", defend: "4 hours" },
  { feature: "Evidence Vault", comply: "Yes", protect: "Yes", defend: "Yes (WORM)" },
  { feature: "Drift Detection", comply: "—", protect: "Yes", defend: "Real-time" },
  { feature: "On-Prem Scanning", comply: "—", protect: "—", defend: "Yes" },
];
