import { describe, expect, it, vi } from "vitest";
import { fetchAnimeThemes } from "@/services/catalog/themes-client";

describe("fetchAnimeThemes", () => {
  it("returns mapped themes when AnimeThemes API responds successfully", async () => {
    const mockResource = {
      resources: [
        {
          id: 9047,
          external_id: 101922,
          site: "AniList",
          anime: [{ id: 1502, slug: "kimetsu_no_yaiba" }],
        },
      ],
    };

    const mockAnime = {
      anime: {
        animethemes: [
          {
            id: 9139,
            slug: "OP1",
            type: "OP",
            song: {
              title: "Gurenge",
              artists: [{ name: "LiSA" }],
            },
            animethemeentries: [
              {
                episodes: "1-26",
                videos: [
                  {
                    link: "https://v.animethemes.moe/KimetsuNoYaiba-OP1.webm",
                  },
                ],
              },
            ],
          },
          {
            id: 9141,
            slug: "ED1",
            type: "ED",
            song: {
              title: "from the edge",
              artists: [{ name: "FictionJunction feat. LiSA" }],
            },
            animethemeentries: [
              {
                episodes: "1-18, 20-25",
                videos: [
                  {
                    link: "https://v.animethemes.moe/KimetsuNoYaiba-ED1.webm",
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const mockFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResource,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnime,
      } as Response);

    const themes = await fetchAnimeThemes(999999);
    expect(themes).toHaveLength(2);
    expect(themes[0]?.slug).toBe("OP1");
    expect(themes[0]?.title).toBe("Gurenge");
    expect(themes[0]?.artist).toBe("LiSA");
    expect(themes[0]?.videoUrl).toBe("https://v.animethemes.moe/KimetsuNoYaiba-OP1.webm");

    expect(themes[1]?.slug).toBe("ED1");
    expect(themes[1]?.title).toBe("from the edge");
    expect(themes[1]?.artist).toBe("FictionJunction feat. LiSA");

    mockFetch.mockRestore();
  });

  it("handles network failure gracefully without throwing", async () => {
    const mockFetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Connection refused"));

    const themes = await fetchAnimeThemes(888888);
    expect(themes).toEqual([]);

    mockFetch.mockRestore();
  });
});

