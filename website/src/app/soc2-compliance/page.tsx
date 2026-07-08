import type { Metadata } from "next";
import HaloComplianceTemplate from "@/components/halo/HaloComplianceTemplate";

export const metadata: Metadata = {
  title: "SOC 2 compliance — Blackfyre",
  description:
    "Blackfyre maps multi-cloud and on-prem scan findings to the SOC 2 controls across the five Trust Services Categories, with weighted scoring and tamper-evident evidence. Open source.",
};

export default function Page() {
  return <HaloComplianceTemplate framework="soc2" />;
}
