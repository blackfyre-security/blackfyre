import type { Metadata } from "next";
import HaloComplianceTemplate from "@/components/halo/HaloComplianceTemplate";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title: "NIST 800-53 Rev 5 — Full 20-Family Coverage | BLACKFYRE",
  description:
    "Complete NIST SP 800-53 Rev 5 control coverage with baseline selection (Low, Moderate, High) and FedRAMP readiness pathway.",
};

export default function Page() {
  return (
    <HaloReveal delay={0}>
      <HaloComplianceTemplate framework="nist" />
    </HaloReveal>
  );
}
