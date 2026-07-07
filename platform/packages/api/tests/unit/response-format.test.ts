import { describe, it, expect } from "vitest";
import { success, error } from "../../src/utils/response.js";

describe("success", () => {
  it("returns success: true with the provided data", () => {
    const result = success({ id: 1 });
    expect(result).toEqual({ success: true, data: { id: 1 } });
  });

  it("sets success to true", () => {
    const result = success({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("preserves the data payload exactly", () => {
    const payload = { id: 1, name: "test", nested: { value: true } };
    const result = success(payload);
    expect(result.data).toEqual(payload);
  });

  it("does not include an error field", () => {
    const result = success({ id: 1 });
    expect(result.error).toBeUndefined();
  });

  it("works with null data", () => {
    const result = success(null);
    expect(result).toEqual({ success: true, data: null });
  });

  it("works with array data", () => {
    const result = success([1, 2, 3]);
    expect(result).toEqual({ success: true, data: [1, 2, 3] });
  });
});

describe("error", () => {
  it("returns success: false with code and message in the error field", () => {
    const result = error("NOT_FOUND", "Resource not found");
    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Resource not found" },
    });
  });

  it("sets success to false", () => {
    const result = error("SOME_ERROR", "Some message");
    expect(result.success).toBe(false);
  });

  it("includes the correct error code", () => {
    const result = error("UNAUTHORIZED", "Access denied");
    expect(result.error?.code).toBe("UNAUTHORIZED");
  });

  it("includes the correct error message", () => {
    const result = error("UNAUTHORIZED", "Access denied");
    expect(result.error?.message).toBe("Access denied");
  });

  it("does not include a data field", () => {
    const result = error("NOT_FOUND", "Resource not found");
    expect(result.data).toBeUndefined();
  });
});
