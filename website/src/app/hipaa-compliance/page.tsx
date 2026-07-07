import type { Metadata } from "next";
import HaloComplianceTemplate from "@/components/halo/HaloComplianceTemplate";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title: "HIPAA Compliance for Healthcare Technology — BLACKFYRE",
  description:
    "Protect ePHI with automated technical-safeguard monitoring, continuous evidence collection, and auditor-ready compliance packages across AWS, Azure, GCP.",
};

export default function Page() {
  return (
    <HaloReveal delay={0}>
      <HaloComplianceTemplate framework="hipaa" />
    </HaloReveal>
  );
}
