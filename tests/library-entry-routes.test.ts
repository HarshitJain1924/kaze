import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAnimeById: vi.fn(),
  toggleEpisode: vi.fn(),
  updateEntry: vi.fn(),
  getApiContext: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/services/catalog/catalog-service", () => ({
  getCatalogService: () => ({ getAnimeById: mocks.getAnimeById }),
}));
vi.mock("@/lib/api/helpers", () => ({
  getApiContext: mocks.getApiContext,
  libraryErrorResponse: () =>
    new Response(JSON.stringify({ error: "failed" }), { status: 500 }),
  readJsonBody: async (request: Request) =>
    request.json().catch(() => null),
}));
vi.mock("@/repositories/library", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/repositories/library")>();
  return {
    ...actual,
    createLibraryRepository: () => ({
      toggleEpisode: mocks.toggleEpisode,
      update: mocks.updateEntry,
    }),
  };
});

import { POST } from "@/app/api/library/[anilistId]/episodes/route";
import { PATCH } from "@/app/api/library/[anilistId]/route";

const context = { params: Promise.resolve({ anilistId: "100" }) };

function request(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/library/100", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/library/[anilistId]/episodes", () => {
  beforeEach(() => {
    mocks.getApiContext.mockResolvedValue({
      ok: true,
      context: { viewer: { id: "user-1" }, supabase: {} },
    });
    mocks.getAnimeById.mockResolvedValue({ data: { episodes: 24 } });
    mocks.toggleEpisode.mockResolvedValue({
      watchedEpisodes: [1],
      entry: { anilistId: 100, progress: 1 },
    });
    mocks.updateEntry.mockResolvedValue({ anilistId: 100, progress: 24 });
  });

  it("skips the catalogue lookup when the client already knows the total", async () => {
    const response = await POST(
      request({ episodeNumber: 1, watched: true, totalEpisodes: 24 }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.getAnimeById).not.toHaveBeenCalled();
    expect(mocks.toggleEpisode).toHaveBeenCalledWith(
      "user-1",
      100,
      1,
      true,
      24,
    );
  });

  it("does not look the total up when the provider reported none", async () => {
    await POST(
      request({ episodeNumber: 1, watched: true, totalEpisodes: null }),
      context,
    );

    expect(mocks.getAnimeById).not.toHaveBeenCalled();
    expect(mocks.toggleEpisode).toHaveBeenCalledWith(
      "user-1",
      100,
      1,
      true,
      null,
    );
  });

  it("still resolves the total when the client omits it", async () => {
    await POST(request({ episodeNumber: 2, watched: true }), context);

    expect(mocks.getAnimeById).toHaveBeenCalledWith(100);
    expect(mocks.toggleEpisode).toHaveBeenCalledWith(
      "user-1",
      100,
      2,
      true,
      24,
    );
  });
});

describe("PATCH /api/library/[anilistId]", () => {
  beforeEach(() => {
    mocks.getApiContext.mockResolvedValue({
      ok: true,
      context: { viewer: { id: "user-1" }, supabase: {} },
    });
    mocks.getAnimeById.mockResolvedValue({ data: { episodes: 24 } });
    mocks.updateEntry.mockResolvedValue({ anilistId: 100, progress: 24 });
  });

  it("passes the episode total through without a catalogue lookup", async () => {
    const response = await PATCH(
      request({ status: "completed", totalEpisodes: 12 }, "PATCH"),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.getAnimeById).not.toHaveBeenCalled();
    // The total is a request aid, never part of the stored patch.
    expect(mocks.updateEntry).toHaveBeenCalledWith(
      "user-1",
      100,
      { status: "completed" },
      12,
    );
  });

  it("resolves the total only when the client omits it", async () => {
    await PATCH(request({ progress: 3 }, "PATCH"), context);

    expect(mocks.getAnimeById).toHaveBeenCalledWith(100);
    expect(mocks.updateEntry).toHaveBeenCalledWith(
      "user-1",
      100,
      { progress: 3 },
      24,
    );
  });

  it("skips the catalogue entirely for score and notes changes", async () => {
    await PATCH(request({ notes: "Great finale" }, "PATCH"), context);

    expect(mocks.getAnimeById).not.toHaveBeenCalled();
    expect(mocks.updateEntry).toHaveBeenCalledWith(
      "user-1",
      100,
      { notes: "Great finale" },
      null,
    );
  });
});
