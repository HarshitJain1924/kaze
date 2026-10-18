import { describe, expect, it } from "vitest";

import { getNextEpisodeNumber } from "@/features/library/continue-watching";

describe("getNextEpisodeNumber", () => {
  it("determines the next sequential episode for a show with sequential watch history", () => {
    const { nextEp, atEnd } = getNextEpisodeNumber(3, [1, 2, 3], 12);
    expect(nextEp).toBe(4);
    expect(atEnd).toBe(false);
  });

  it("finds the first unwatched gap for non-sequential watches", () => {
    // Watched episode 1, skipped 2 and 3, watched 4
    const { nextEp, atEnd } = getNextEpisodeNumber(4, [1, 4], 12);
    expect(nextEp).toBe(2);
    expect(atEnd).toBe(false);
  });

  it("does not prematurely complete if only the final episode was watched non-sequentially", () => {
    // Watched episode 12 out of 12, but earlier episodes are not watched
    const { nextEp, atEnd } = getNextEpisodeNumber(12, [12], 12);
    expect(nextEp).toBe(1);
    expect(atEnd).toBe(false);
  });

  it("marks as atEnd when all episodes in total are watched", () => {
    const allTwelve = Array.from({ length: 12 }, (_, i) => i + 1);
    const { nextEp, atEnd } = getNextEpisodeNumber(12, allTwelve, 12);
    expect(nextEp).toBe(13);
    expect(atEnd).toBe(true);
  });

  it("supports legacy entries with no individual episode records", () => {
    // Legacy entry with progress = 5, but empty watchedEpisodes array
    const { nextEp, atEnd } = getNextEpisodeNumber(5, [], 12);
    expect(nextEp).toBe(6);
    expect(atEnd).toBe(false);
  });

  it("supports legacy completion when progress matches total without episode records", () => {
    const { nextEp, atEnd } = getNextEpisodeNumber(12, [], 12);
    expect(nextEp).toBe(13);
    expect(atEnd).toBe(true);
  });

  it("handles unknown episode totals without falsely completing", () => {
    const { nextEp, atEnd } = getNextEpisodeNumber(25, [1, 2, 3], null);
    expect(nextEp).toBe(4);
    expect(atEnd).toBe(false);
  });

  it("handles unstarted shows cleanly", () => {
    const { nextEp, atEnd } = getNextEpisodeNumber(0, [], 24);
    expect(nextEp).toBe(1);
    expect(atEnd).toBe(false);
  });
});
