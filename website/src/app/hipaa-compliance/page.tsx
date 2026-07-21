import type { Metadata } from "next";
import HaloComplianceTemplate from "@/components/halo/HaloComplianceTemplate";

export const metadata: Metadata = {
  title: "HIPAA compliance — Blackfyre",
  description:
    "Blackfyre maps AWS, Azure, GCP and on-prem findings to the HIPAA Security Rule safeguards with weighted scoring and a hash-verified evidence vault. It never reads ePHI. Open source.",
};

export default function Page() {
  return <HaloComplianceTemplate framework="hipaa" />;
}
