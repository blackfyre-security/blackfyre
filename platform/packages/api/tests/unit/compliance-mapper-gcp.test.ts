import { describe, it, expect } from "vitest";
import {
  mapCheckToControls,
  KNOWN_CHECK_TYPES,
} from "../../src/services/compliance-mapper.js";
import {
  GCP_COMPLIANCE_MAP,
  KNOWN_GCP_CHECK_TYPES,
} from "../../src/services/compliance-mapper-gcp.js";

describe("compliance-mapper-gcp", () => {
  it("exports 27 GCP check types", () => {
    expect(KNOWN_GCP_CHECK_TYPES).toHaveLength(27);
    expect(Object.keys(GCP_COMPLIANCE_MAP)).toHaveLength(27);
  });

  it("all GCP check types are included in KNOWN_CHECK_TYPES", () => {
    for (const checkType of KNOWN_GCP_CHECK_TYPES) {
      expect(KNOWN_CHECK_TYPES).toContain(checkType);
    }
  });

  it("all 18 gcp_* check types return non-empty mappings across at least 3 frameworks", () => {
    for (const checkType of KNOWN_GCP_CHECK_TYPES) {
      const result = mapCheckToControls(checkType);
      expect(result.length, `${checkType} should have mappings`).toBeGreaterThan(0);

      const frameworks = new Set(result.map((r) => r.framework));
      expect(
        frameworks.size,
        `${checkType} should map to at least 3 distinct frameworks`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("gcp_fw_ssh_from_any returns correct specific control IDs", () => {
    const result = mapCheckToControls("gcp_fw_ssh_from_any");
    const controlIds = result.map((r) => r.controlId);

    expect(controlIds).toContain("CC6.6");   // soc2
    expect(controlIds).toContain("1.1");     // pcidss
    expect(controlIds).toContain("A.8.20");  // iso27001
  });

  it("gcp_iam_allUsers_binding returns correct specific control IDs", () => {
    const result = mapCheckToControls("gcp_iam_allUsers_binding");
    const controlIds = result.map((r) => r.controlId);

    expect(controlIds).toContain("CC6.1");   // soc2
    expect(controlIds).toContain("A.8.3");   // iso27001
  });

  it("all GCP mappings have valid framework values and required fields", () => {
    const validFrameworks = ["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "nist80053", "iso42001", "pdppl"];

    for (const checkType of KNOWN_GCP_CHECK_TYPES) {
      const result = mapCheckToControls(checkType);

      for (const entry of result) {
        expect(validFrameworks).toContain(entry.framework);
        expect(entry.controlId).toBeTruthy();
        expect(entry.controlName).toBeTruthy();
        expect(entry.status).toBe("fail");
        expect(entry.weight).toBeGreaterThanOrEqual(1);
        expect(entry.weight).toBeLessThanOrEqual(3);
      }
    }
  });
});
