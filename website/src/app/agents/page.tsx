import type { Metadata } from "next";
import { AUDITOR_COUNT } from "@/data/auditors";
import AuditorCatalog from "./AuditorCatalog";

export const metadata: Metadata = {
  title: "Auditors — Blackfyre",
  description: `Browse all ${AUDITOR_COUNT} Blackfyre auditors across AWS, Azure, GCP and on-prem (Active Directory, SNMP, IdP, EDR, Kubernetes, registries, VCS, SaaS). Search and filter by cloud and category.`,
};

export default function AuditorsPage() {
  return <AuditorCatalog />;
}
