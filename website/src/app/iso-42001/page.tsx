import type { Metadata } from "next";
import HaloComplianceTemplate from "@/components/halo/HaloComplianceTemplate";

export const metadata: Metadata = {
  title: "ISO 42001 — Blackfyre",
  description:
    "Blackfyre maps infrastructure findings to the ISO/IEC 42001:2023 AI-management controls, evidencing the operational and technical safeguards behind your AI systems. Open source.",
};

export default function Page() {
  return <HaloComplianceTemplate framework="iso42001" />;
}
