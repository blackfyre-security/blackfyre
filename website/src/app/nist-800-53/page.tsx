import type { Metadata } from "next";
import HaloComplianceTemplate from "@/components/halo/HaloComplianceTemplate";

export const metadata: Metadata = {
  title: "NIST 800-53 — Blackfyre",
  description:
    "Blackfyre maps multi-cloud and on-prem findings to the NIST SP 800-53 Rev 5 controls across all 20 families, with weighted scoring and tamper-evident evidence for your ATO path. Open source.",
};

export default function Page() {
  return <HaloComplianceTemplate framework="nist80053" />;
}
