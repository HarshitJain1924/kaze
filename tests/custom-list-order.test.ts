import { describe, expect, it } from "vitest";

import {
  customListItemKey,
  moveCustomListItem,
  type CustomListItem,
} from "@/types/custom-list";

const items: CustomListItem[] = [
  { id: "a", anilistId: 1, title: "A", coverImage: null, addedAt: "", rank: 1 },
  { id: "b", anilistId: 2, title: "B", coverImage: null, addedAt: "", rank: 2 },
  {
    id: "c",
    tmdbId: 3,
    tmdbKind: "movie",
    title: "C",
    coverImage: null,
    addedAt: "",
    rank: 3,
  },
];

describe("custom list ordering", () => {
  it("moves an AniList entry down and renumbers ranks", () => {
    const moved = moveCustomListItem(items, "anilist:1", 2);
    expect(moved?.map((item) => item.title)).toEqual(["B", "C", "A"]);
    expect(moved?.map((item) => item.rank)).toEqual([1, 2, 3]);
  });

  it("moves a TMDB entry and clamps an out-of-range target", () => {
    const key = customListItemKey({ tmdbId: 3, tmdbKind: "movie" });
    const moved = moveCustomListItem(items, key, -5);
    expect(moved?.map((item) => item.title)).toEqual(["C", "A", "B"]);
  });

  it("returns null for unknown keys or no-op moves", () => {
    expect(moveCustomListItem(items, "anilist:999", 0)).toBeNull();
    expect(moveCustomListItem(items, "anilist:1", 0)).toBeNull();
  });

  it("does not mutate the input items", () => {
    moveCustomListItem(items, "anilist:1", 2);
    expect(items.map((item) => item.title)).toEqual(["A", "B", "C"]);
  });
});
