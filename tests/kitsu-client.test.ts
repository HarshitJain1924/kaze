import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { KitsuClient } from "@/services/catalog/kitsu-client";

import {
  jsonResponse,
  kitsuAnimeResource,
  kitsuMappingResource,
  kitsuMappingResponse,
  kitsuSearchResponse,
} from "./helpers/catalog-fixtures";

function clientWith(fetchImpl: (url: string) => Promise<Response>) {
  return new KitsuClient({
    fetchImpl: fetchImpl as unknown as typeof fetch,
    timeoutMs: 5000,
  });
}

describe("KitsuClient", () => {
  it("resolves a verified AniList mapping and preserves the AniList ID", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/mappings?");
      // URLSearchParams encodes JSON:API bracket keys and the site value.
      expect(url).toContain("filter%5BexternalSite%5D=anilist%2Fanime");
      expect(url).toContain("filter%5BexternalId%5D=154587");
      expect(url).toContain("include=item");
      return kitsuMappingResponse(154587, { kitsuId: "46474" });
    });

    const result = await clientWith(fetchMock).getAnimeByAnilistId(154587);

    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;

    expect(result.summary.id).toBe(154587);
    expect(result.kitsuId).toBe(46474);
    expect(result.summary.title.english).toBe("Kitsu English 154587");
    expect(result.summary.episodes).toBe(24);
    expect(result.summary.averageScore).toBe(82);
    expect(result.summary.seasonYear).toBe(2024);
    expect(result.summary.format).toBe("TV");
    expect(result.summary.status).toBe("FINISHED");
  });

  it("reports a missing mapping separately from a provider failure", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: [], meta: { count: 0 } }),
    );

    const result = await clientWith(fetchMock).getAnimeByAnilistId(999_999);

    expect(result).toEqual({ kind: "not_mapped", reason: "no_mapping" });
  });

  it("never guesses when two Kitsu entries claim the same AniList ID", async () => {
    const first = kitsuMappingResource(154587, "46474", {
      mappingId: "m-1",
    });
    const second = kitsuMappingResource(154587, "99999", {
      mappingId: "m-2",
    });
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: [first, second],
        included: [
          kitsuAnimeResource(154587, { kitsuId: "46474", id: "46474" }),
          kitsuAnimeResource(154587, { kitsuId: "99999", id: "99999" }),
        ],
      }),
    );

    const result = await clientWith(fetchMock).getAnimeByAnilistId(154587);

    expect(result).toEqual({ kind: "ambiguous", kitsuIds: [46474, 99999] });
  });

  it("ignores mappings whose external id does not match the requested ID", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: [
          kitsuMappingResource(154587, "46474", { externalId: "999999" }),
        ],
        included: [
          kitsuAnimeResource(154587, { kitsuId: "46474", id: "46474" }),
        ],
      }),
    );

    const result = await clientWith(fetchMock).getAnimeByAnilistId(154587);

    expect(result.kind).toBe("not_mapped");
  });

  it("falls back to the anime endpoint when the mapping omits the item", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/mappings")) {
        return jsonResponse({
          data: [kitsuMappingResource(154587, "46474")],
        });
      }
      return jsonResponse({
        data: kitsuAnimeResource(154587, { kitsuId: "46474", id: "46474" }),
      });
    });

    const result = await clientWith(fetchMock).getAnimeByAnilistId(154587);

    expect(result.kind).toBe("found");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces HTTP failures as provider errors, not missing mappings", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));

    const result = await clientWith(fetchMock).getAnimeByAnilistId(154587);

    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.error.kind).toBe("http");
    expect(result.error.status).toBe(503);
  });

  it("surfaces network failures as provider errors", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await clientWith(fetchMock).getAnimeByAnilistId(154587);

    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.error.kind).toBe("network");
  });

  it("treats an aborted request timeout as a provider failure", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });

    const result = await clientWith(fetchMock).searchAnime("slow", 5);

    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.error.kind).toBe("network");
  });

  it("treats unreadable JSON as an invalid response", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("not json", {
          status: 200,
          headers: { "content-type": "application/vnd.api+json" },
        }),
    );

    const result = await clientWith(fetchMock).getAnimeByAnilistId(154587);

    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.error.kind).toBe("invalid_response");
  });

  it("searches only entries with a verified AniList mapping", async () => {
    const fetchMock = vi.fn(async () =>
      kitsuSearchResponse([
        { anilistId: 100, kitsuId: "7001", mappingIds: ["a"] },
        { anilistId: 101, kitsuId: "7002", mappingIds: ["b"] },
      ]),
    );

    const result = await clientWith(fetchMock).searchAnime("frieren", 8);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items.map((item) => item.id)).toEqual([100, 101]);
    expect(result.skipped).toBe(0);
    expect(result.total).toBe(2);
  });

  it("skips search results without an AniList mapping", async () => {
    const payload = kitsuSearchResponse([
      { anilistId: 100, kitsuId: "7001" },
    ]);
    // Remove the mapping include and relationship to simulate an unmapped hit.
    const body = (await payload.json()) as {
      data: Array<Record<string, unknown>>;
      included: Array<Record<string, unknown>>;
    };
    body.included = [];
    for (const entry of body.data) {
      entry.relationships = { mappings: { data: [] } };
    }

    const result = await clientWith(
      vi.fn(async () => jsonResponse(body)),
    ).searchAnime("unmapped", 8);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items).toEqual([]);
    expect(result.skipped).toBe(1);
  });

  it("clamps the page limit to Kitsu's supported maximum", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      kitsuSearchResponse([]),
    );

    await clientWith(fetchMock).searchAnime("frieren", 50);

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("page%5Blimit%5D=20");
    expect(url).toContain("filter%5Btext%5D=frieren");
    expect(url).toContain("include=mappings");
  });

  it("encodes user search text in the query string", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      kitsuSearchResponse([]),
    );

    await clientWith(fetchMock).searchAnime("k-on! & more", 5);

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).not.toContain("k-on! & more");
    expect(url).toContain("k-on%21+%26+more");
  });

  it("handles absent titles, scores, dates and episode counts", async () => {
    const fetchMock = vi.fn(async () =>
      kitsuSearchResponse([
        {
          anilistId: 200,
          kitsuId: "8001",
          attributes: {
            titles: { en: null, en_jp: null, ja_jp: null },
            canonicalTitle: null,
            posterImage: {},
            averageRating: "not-a-number",
            startDate: "not-a-date",
            episodeCount: 0,
            subtype: "UNKNOWN_SUBTYPE",
            status: "mystery",
          },
        },
      ]),
    );

    const result = await clientWith(fetchMock).searchAnime("mystery", 5);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // A result with no usable title is skipped rather than mislabelled.
    expect(result.items).toEqual([]);
    expect(result.skipped).toBe(1);
  });

  it("keeps partial metadata with nulls instead of inventing values", async () => {
    const fetchMock = vi.fn(async () =>
      kitsuSearchResponse([
        {
          anilistId: 201,
          kitsuId: "8002",
          attributes: {
            titles: { en: "Only English", en_jp: null, ja_jp: null },
            canonicalTitle: "Only English",
            posterImage: { medium: "https://media.kitsu.app/medium.jpg" },
            averageRating: null,
            startDate: null,
            episodeCount: null,
            subtype: "UNKNOWN_SUBTYPE",
            status: "mystery",
          },
        },
      ]),
    );

    const result = await clientWith(fetchMock).searchAnime("partial", 5);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const item = result.items[0];
    expect(item?.id).toBe(201);
    expect(item?.title).toEqual({
      english: "Only English",
      romaji: "Only English",
      native: null,
    });
    expect(item?.coverImage.extraLarge).toBe(
      "https://media.kitsu.app/medium.jpg",
    );
    expect(item?.coverImage.large).toBe("https://media.kitsu.app/medium.jpg");
    expect(item?.averageScore).toBeNull();
    expect(item?.seasonYear).toBeNull();
    expect(item?.episodes).toBeNull();
    expect(item?.format).toBeNull();
    expect(item?.status).toBeNull();
  });

  it("returns a provider error for a failed search instead of an empty list", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 502 }));

    const result = await clientWith(fetchMock).searchAnime("frieren", 8);

    expect(result.kind).toBe("error");
  });

  it("returns a genuine empty list when Kitsu answers with no matches", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: [], included: [], meta: { count: 0 } }),
    );

    const result = await clientWith(fetchMock).searchAnime("nothing", 8);

    expect(result).toEqual({ kind: "ok", items: [], skipped: 0, total: 0 });
  });

  it("returns an empty result for an empty query without a request", async () => {
    const fetchMock = vi.fn(async () => kitsuSearchResponse([]));

    const result = await clientWith(fetchMock).searchAnime("   ", 8);

    expect(result).toEqual({ kind: "ok", items: [], skipped: 0, total: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores invalid AniList IDs before requesting anything", async () => {
    const fetchMock = vi.fn(async () => kitsuMappingResponse(1));

    const result = await clientWith(fetchMock).getAnimeByAnilistId(0);

    expect(result).toEqual({
      kind: "not_mapped",
      reason: "incomplete_mapping",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
