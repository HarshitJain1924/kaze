import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-origin absolute paths", () => {
    expect(safeRedirectPath("/library")).toBe("/library");
    expect(safeRedirectPath("/library?tab=watching#top")).toBe(
      "/library?tab=watching#top",
    );
  });

  it("falls back when no target is supplied", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });

  it("rejects other origins and protocol-relative targets", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("//evil.com/library")).toBe("/");
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("http://evil.com/library")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
    expect(safeRedirectPath("evil.com")).toBe("/");
  });

  it("rejects backslash and control-character separator tricks", () => {
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath("/\\\\evil.com")).toBe("/");
    expect(safeRedirectPath("/\\/evil.com")).toBe("/");
    expect(safeRedirectPath("/\t/evil.com")).toBe("/");
    expect(safeRedirectPath("/\n/evil.com")).toBe("/");
  });

  it("never returns an off-origin URL for odd but same-origin input", () => {
    expect(safeRedirectPath("/%2f%2fevil.com")).toBe("/%2f%2fevil.com");
    expect(safeRedirectPath("/./library")).toBe("/library");
  });
});
