import type { Metadata } from "next";
import HaloComplianceTemplate from "@/components/halo/HaloComplianceTemplate";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title: "SOC 2 Type II Compliance — BLACKFYRE",
  description:
    "BLACKFYRE automates your entire SOC 2 Type II journey — continuous control monitoring, evidence chain with SHA-256 integrity, audit-ready packages on demand.",
};

export default function Page() {
  return (
    <HaloReveal delay={0}>
      <HaloComplianceTemplate framework="soc2" />
    </HaloReveal>
  );
}
