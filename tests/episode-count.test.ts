import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAnimeById: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/services/catalog/catalog-service", () => ({
  getCatalogService: () => ({ getAnimeById: mocks.getAnimeById }),
}));

import {
  resolveEpisodeCount,
  resolveEpisodeTotal,
} from "@/features/library/episode-count";

describe("episode total resolution", () => {
  beforeEach(() => {
    mocks.getAnimeById.mockReset();
    mocks.getAnimeById.mockResolvedValue({ data: { episodes: 24 } });
  });

  it("uses the total the client already has without calling the provider", async () => {
    await expect(resolveEpisodeTotal(12, 100)).resolves.toBe(12);
    expect(mocks.getAnimeById).not.toHaveBeenCalled();
  });

  it("treats an explicit unknown total as authoritative", async () => {
    await expect(resolveEpisodeTotal(null, 100)).resolves.toBeNull();
    expect(mocks.getAnimeById).not.toHaveBeenCalled();
  });

  it("asks the catalogue only when the client omitted the total", async () => {
    await expect(resolveEpisodeTotal(undefined, 100)).resolves.toBe(24);
    expect(mocks.getAnimeById).toHaveBeenCalledWith(100);
  });

  it("still degrades to null when the catalogue cannot answer", async () => {
    mocks.getAnimeById.mockRejectedValue(new Error("provider down"));
    await expect(resolveEpisodeCount(100)).resolves.toBeNull();
  });
});
