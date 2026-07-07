import { describe, it, expect } from "vitest";
import {
  mapCheckToControls,
  KNOWN_CHECK_TYPES,
  type ControlMappingEntry,
} from "../../src/services/compliance-mapper.js";

const VALID_FRAMEWORKS = ["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "nist80053", "iso42001"] as const;

describe("compliance-mapper", () => {
  it("Test 1: mapCheckToControls('iam_user_no_mfa') returns correct framework mappings", () => {
    const result = mapCheckToControls("iam_user_no_mfa");

    expect(result.length).toBeGreaterThanOrEqual(6);

    const controlIds = result.map((r) => r.controlId);
    expect(controlIds).toContain("CC6.2");       // soc2
    expect(controlIds).toContain("8.3.1");        // pcidss
    expect(controlIds).toContain("164.312(d)");   // hipaa
    expect(controlIds).toContain("A.8.5");        // iso27001
    expect(controlIds).toContain("Art.32(1)");    // gdpr
    expect(controlIds).toContain("DPDPA-S8-2");   // dpdpa

    // All entries should have status "fail"
    for (const entry of result) {
      expect(entry.status).toBe("fail");
    }
  });

  it("Test 2: mapCheckToControls('s3_no_encryption') returns correct framework mappings", () => {
    const result = mapCheckToControls("s3_no_encryption");

    expect(result.length).toBeGreaterThanOrEqual(3);

    const controlIds = result.map((r) => r.controlId);
    expect(controlIds).toContain("CC6.7");        // soc2
    expect(controlIds).toContain("4.1");          // pcidss
    expect(controlIds).toContain("DPDPA-S8-1");   // dpdpa
  });

  it("Test 3: mapCheckToControls('cloudtrail_no_trails') returns correct framework mappings", () => {
    const result = mapCheckToControls("cloudtrail_no_trails");

    expect(result.length).toBeGreaterThanOrEqual(3);

    const controlIds = result.map((r) => r.controlId);
    expect(controlIds).toContain("CC7.1");        // soc2
    expect(controlIds).toContain("A.8.15");       // iso27001
    expect(controlIds).toContain("DPDPA-S8-3");   // dpdpa
  });

  it("Test 4: mapCheckToControls('kms_rotation_disabled') returns correct framework mappings", () => {
    const result = mapCheckToControls("kms_rotation_disabled");

    expect(result.length).toBeGreaterThanOrEqual(3);

    const controlIds = result.map((r) => r.controlId);
    expect(controlIds).toContain("CC6.1");        // soc2
    expect(controlIds).toContain("3.5");          // pcidss
    expect(controlIds).toContain("DPDPA-S8-1");   // dpdpa
  });

  it("Test 5: mapCheckToControls('ec2_sg_open_ssh') returns correct framework mappings", () => {
    const result = mapCheckToControls("ec2_sg_open_ssh");

    expect(result.length).toBeGreaterThanOrEqual(3);

    const controlIds = result.map((r) => r.controlId);
    expect(controlIds).toContain("CC6.6");        // soc2
    expect(controlIds).toContain("1.1");          // pcidss
    expect(controlIds).toContain("A.8.20");       // iso27001
  });

  it("Test 6: mapCheckToControls('unknown_check') returns empty array", () => {
    const result = mapCheckToControls("unknown_check");

    expect(result).toEqual([]);
  });

  it("Test 7: every check type in KNOWN_CHECK_TYPES returns at least 1 framework mapping", () => {
    expect(KNOWN_CHECK_TYPES.length).toBeGreaterThanOrEqual(54);

    for (const checkType of KNOWN_CHECK_TYPES) {
      const result = mapCheckToControls(checkType);
      expect(
        result.length,
        `${checkType} should have at least 1 mapping but has ${result.length}`,
      ).toBeGreaterThanOrEqual(1);

      // Verify at least 1 distinct framework
      const frameworks = new Set(result.map((r) => r.framework));
      expect(
        frameworks.size,
        `${checkType} should map to at least 1 distinct framework but has ${frameworks.size}`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("Test 8: all returned mappings have valid framework values", () => {
    for (const checkType of KNOWN_CHECK_TYPES) {
      const result = mapCheckToControls(checkType);

      for (const entry of result) {
        expect(
          VALID_FRAMEWORKS,
          `${checkType} returned invalid framework: ${entry.framework}`,
        ).toContain(entry.framework);

        // Verify required fields are present
        expect(entry.controlId).toBeTruthy();
        expect(entry.controlName).toBeTruthy();
        expect(entry.status).toBe("fail");
        expect(entry.weight).toBeGreaterThanOrEqual(1);
        expect(entry.weight).toBeLessThanOrEqual(3);
      }
    }
  });

  it("Test 9: Azure check types return mappings across at least 3 distinct frameworks", () => {
    const azureCheckTypes = KNOWN_CHECK_TYPES.filter((ct) => ct.startsWith("azure_"));
    expect(azureCheckTypes).toHaveLength(48);

    for (const checkType of azureCheckTypes) {
      const result = mapCheckToControls(checkType);
      expect(result.length, `${checkType} should have at least 3 mappings`).toBeGreaterThanOrEqual(3);

      const frameworks = new Set(result.map((r) => r.framework));
      expect(
        frameworks.size,
        `${checkType} should map to at least 3 distinct frameworks but has ${frameworks.size}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("Test 10: GCP check types return mappings across at least 3 distinct frameworks", () => {
    const gcpCheckTypes = KNOWN_CHECK_TYPES.filter((ct) => ct.startsWith("gcp_"));
    expect(gcpCheckTypes).toHaveLength(27);

    for (const checkType of gcpCheckTypes) {
      const result = mapCheckToControls(checkType);
      expect(result.length, `${checkType} should have at least 3 mappings`).toBeGreaterThanOrEqual(3);

      const frameworks = new Set(result.map((r) => r.framework));
      expect(
        frameworks.size,
        `${checkType} should map to at least 3 distinct frameworks but has ${frameworks.size}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
