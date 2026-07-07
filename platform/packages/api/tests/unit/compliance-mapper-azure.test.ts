import { describe, it, expect } from "vitest";
import {
  mapCheckToControls,
  KNOWN_CHECK_TYPES,
} from "../../src/services/compliance-mapper.js";
import {
  AZURE_COMPLIANCE_MAP,
  KNOWN_AZURE_CHECK_TYPES,
} from "../../src/services/compliance-mapper-azure.js";

describe("compliance-mapper-azure", () => {
  it("exports 48 Azure check types", () => {
    expect(KNOWN_AZURE_CHECK_TYPES).toHaveLength(48);
    expect(Object.keys(AZURE_COMPLIANCE_MAP)).toHaveLength(48);
  });

  it("all Azure check types are included in KNOWN_CHECK_TYPES", () => {
    for (const checkType of KNOWN_AZURE_CHECK_TYPES) {
      expect(KNOWN_CHECK_TYPES).toContain(checkType);
    }
  });

  it("all 18 azure_* check types return non-empty mappings across at least 3 frameworks", () => {
    for (const checkType of KNOWN_AZURE_CHECK_TYPES) {
      const result = mapCheckToControls(checkType);
      expect(result.length, `${checkType} should have mappings`).toBeGreaterThan(0);

      const frameworks = new Set(result.map((r) => r.framework));
      expect(
        frameworks.size,
        `${checkType} should map to at least 3 distinct frameworks`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("azure_nsg_ssh_from_any returns correct specific control IDs", () => {
    const result = mapCheckToControls("azure_nsg_ssh_from_any");
    const controlIds = result.map((r) => r.controlId);

    expect(controlIds).toContain("CC6.6");   // soc2
    expect(controlIds).toContain("1.1");     // pcidss
    expect(controlIds).toContain("A.8.20");  // iso27001
  });

  it("azure_storage_public_blob returns correct specific control IDs", () => {
    const result = mapCheckToControls("azure_storage_public_blob");
    const controlIds = result.map((r) => r.controlId);

    expect(controlIds).toContain("CC6.1");   // soc2
    expect(controlIds).toContain("A.8.3");   // iso27001
  });

  it("all Azure mappings have valid framework values and required fields", () => {
    const validFrameworks = ["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "nist80053", "iso42001", "pdppl"];

    for (const checkType of KNOWN_AZURE_CHECK_TYPES) {
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
