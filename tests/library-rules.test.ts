import { describe, expect, it } from "vitest";

import {
  applyLibraryEntryUpdate,
  LibraryProgressError,
} from "@/lib/library-rules";
import type { LibraryEntry } from "@/types/library";

function makeEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: "entry-1",
    userId: "user-1",
    anilistId: 1,
    status: "planning",
    progress: 0,
    score: null,
    startedAt: null,
    completedAt: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const TODAY = "2026-10-18";

describe("applyLibraryEntryUpdate", () => {
  it("records a start date when moving to watching", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry(),
      { status: "watching" },
      12,
      TODAY,
    );
    expect(result.status).toBe("watching");
    expect(result.startedAt).toBe(TODAY);
    expect(result.completedAt).toBeNull();
  });

  it("preserves an existing start date", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry({ startedAt: "2026-02-02" }),
      { status: "on_hold" },
      12,
      TODAY,
    );
    expect(result.startedAt).toBe("2026-02-02");
  });

  it("preserves rating, notes and progress when the status changes", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry({
        status: "watching",
        progress: 4,
        score: 9,
        notes: "Great so far",
      }),
      { status: "on_hold" },
      12,
      TODAY,
    );

    expect(result.status).toBe("on_hold");
    expect(result.progress).toBeUndefined();
    expect(result.score).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("fills progress to the known episode count on completion", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry({ status: "watching", progress: 5, score: 8 }),
      { status: "completed" },
      12,
      TODAY,
    );
    expect(result.progress).toBe(12);
    expect(result.completedAt).toBe(TODAY);
    expect(result.score).toBeUndefined();
  });

  it("keeps an explicitly supplied progress when completing", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry({ status: "watching", progress: 5 }),
      { status: "completed", progress: 7 },
      12,
      TODAY,
    );
    expect(result.progress).toBe(7);
  });

  it("does not invent progress when the episode count is unknown", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry({ status: "watching", progress: 5 }),
      { status: "completed" },
      null,
      TODAY,
    );
    expect(result.progress).toBeUndefined();
    expect(result.completedAt).toBe(TODAY);
  });

  it("clears the completion date when reversing completion", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry({
        status: "completed",
        progress: 12,
        completedAt: "2026-05-05",
      }),
      { status: "watching" },
      12,
      TODAY,
    );
    expect(result.completedAt).toBeNull();
    expect(result.progress).toBeUndefined();
  });

  it("rejects negative or fractional progress", () => {
    expect(() =>
      applyLibraryEntryUpdate(makeEntry(), { progress: -1 }, 12, TODAY),
    ).toThrow(LibraryProgressError);
    expect(() =>
      applyLibraryEntryUpdate(makeEntry(), { progress: 1.5 }, 12, TODAY),
    ).toThrow(LibraryProgressError);
  });

  it("rejects progress beyond a known episode count", () => {
    expect(() =>
      applyLibraryEntryUpdate(makeEntry(), { progress: 13 }, 12, TODAY),
    ).toThrow(/cannot exceed/i);
  });

  it("allows progress equal to the episode count", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry(),
      { progress: 12 },
      12,
      TODAY,
    );
    expect(result.progress).toBe(12);
  });

  it("allows unbounded progress when the total is unknown", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry(),
      { progress: 500 },
      null,
      TODAY,
    );
    expect(result.progress).toBe(500);
  });

  it("passes score and notes through without altering unrelated fields", () => {
    const result = applyLibraryEntryUpdate(
      makeEntry({ status: "watching", progress: 3, score: 7, notes: "old" }),
      { score: null, notes: "new note" },
      12,
      TODAY,
    );
    expect(result.score).toBeNull();
    expect(result.notes).toBe("new note");
    expect(result.status).toBeUndefined();
    expect(result.progress).toBeUndefined();
  });
});
