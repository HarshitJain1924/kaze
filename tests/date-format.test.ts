import { describe, expect, it } from "vitest";

import { formatIsoDate, formatShortIsoDate } from "@/lib/utils";

describe("calendar date formatting", () => {
  it("keeps a bare date on its own calendar day", () => {
    // `new Date("2026-11-13")` is UTC midnight; formatting it in the device
    // timezone would render Nov 12 for everyone west of UTC.
    expect(formatIsoDate("2026-11-13")).toBe("Nov 13, 2026");
    expect(formatShortIsoDate("2026-11-13")).toBe("Nov 13");
  });

  it("returns null for missing or unparseable values", () => {
    expect(formatIsoDate(null)).toBeNull();
    expect(formatIsoDate("not-a-date")).toBeNull();
    expect(formatShortIsoDate("")).toBeNull();
  });
});
