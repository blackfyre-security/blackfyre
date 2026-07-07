import type { Metadata } from "next";
import HaloComplianceTemplate from "@/components/halo/HaloComplianceTemplate";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title: "ISO 42001 AI Governance — BLACKFYRE",
  description:
    "ISO 42001:2023 is the first international standard for AI management systems. BLACKFYRE operationalises it clause-by-clause with continuous monitoring.",
};

export default function Page() {
  return (
    <HaloReveal delay={0}>
      <HaloComplianceTemplate framework="iso42001" />
    </HaloReveal>
  );
}
