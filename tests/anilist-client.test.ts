import { describe, expect, it, vi } from "vitest";

import { AniListClient } from "@/services/anilist/client";
import { CircuitBreaker } from "@/services/anilist/circuit-breaker";
import {
  AniListError,
  AniListSuspendedError,
  CircuitBreakerOpenError,
} from "@/services/anilist/errors";

const media = {
  id: 1,
  title: { romaji: "Test Anime", english: "Test Anime", native: null },
  coverImage: {
    extraLarge: "https://s4.anilist.co/file/cover.jpg",
    large: null,
    color: null,
  },
  format: "TV",
  episodes: 12,
  averageScore: 80,
  seasonYear: 2024,
  status: "RELEASING",
  genres: ["Action"],
};

function pageResponse(
  items: unknown[] = [media],
  pageInfo: Record<string, unknown> = {},
) {
  return new Response(
    JSON.stringify({
      data: {
        Page: {
          pageInfo: {
            currentPage: 1,
            lastPage: 2,
            hasNextPage: true,
            total: 30,
            ...pageInfo,
          },
          media: items,
        },
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createClient(
  fetchImpl: ReturnType<typeof vi.fn>,
  options: { sleep?: (ms: number) => Promise<void> } = {},
) {
  const sleeps: number[] = [];
  const client = new AniListClient({
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep:
      options.sleep ??
      (async (ms: number) => {
        sleeps.push(ms);
      }),
    random: () => 0,
    baseBackoffMs: 10,
    maxBackoffMs: 5000,
  });
  return { client, sleeps };
}

describe("AniListClient", () => {
  it("deduplicates concurrent identical requests", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const { client } = createClient(fetchMock);

    const first = client.searchAnime({ query: "test" });
    const second = client.searchAnime({ query: "test" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch?.(pageResponse());

    const [a, b] = await Promise.all([first, second]);
    expect(a.items[0]?.id).toBe(1);
    expect(b.items[0]?.id).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves repeated requests from the TTL cache", async () => {
    const fetchMock = vi.fn(async () => pageResponse());
    const { client } = createClient(fetchMock);

    await client.searchAnime({ query: "cached" });
    await client.searchAnime({ query: "cached" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clamps paging and forwards filters to AniList", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => pageResponse());
    const { client } = createClient(fetchMock);

    await client.searchAnime({
      query: "  cowboy  ",
      genre: "Action",
      format: "TV",
      season: "FALL",
      seasonYear: 2024,
      page: 0,
      perPage: 999,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      variables: Record<string, unknown>;
    };
    expect(body.variables).toMatchObject({
      page: 1,
      perPage: 50,
      search: "cowboy",
      genre: "Action",
      format: "TV",
      season: "FALL",
      seasonYear: 2024,
    });
  });

  it("retries HTTP 429 using the Retry-After header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", {
          status: 429,
          headers: { "retry-after": "1" },
        }),
      )
      .mockResolvedValueOnce(pageResponse());
    const { client, sleeps } = createClient(fetchMock);

    const result = await client.searchAnime({ query: "retry" });

    expect(result.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([1000]);
  });

  it("retries transient server errors with backoff", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(pageResponse());
    const { client, sleeps } = createClient(fetchMock);

    await expect(
      client.searchAnime({ query: "backoff" }),
    ).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toHaveLength(1);
  });

  it("gives up after the configured retry budget", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 500 }));
    const { client } = createClient(fetchMock);

    await expect(client.searchAnime({ query: "down" })).rejects.toBeInstanceOf(
      AniListError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a GraphQL request error", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ errors: [{ message: "Invalid search filter" }] }, 400),
    );
    const { client } = createClient(fetchMock);

    await expect(client.searchAnime({ query: "bad" })).rejects.toThrow(
      "Invalid search filter",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces GraphQL errors returned with HTTP 200", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ errors: [{ message: "Too many requests" }], data: null }),
    );
    const { client } = createClient(fetchMock);

    await expect(client.searchAnime({ query: "oops" })).rejects.toThrow(
      "Too many requests",
    );
  });

  it("rejects unreadable pages", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: { Page: null } }),
    );
    const { client } = createClient(fetchMock);

    await expect(client.searchAnime({ query: "broken" })).rejects.toBeInstanceOf(
      AniListError,
    );
  });

  it("rejects invalid ids before hitting the network", async () => {
    const fetchMock = vi.fn(async () => pageResponse());
    const { client } = createClient(fetchMock);

    await expect(client.getAnimeById(0)).rejects.toBeInstanceOf(AniListError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when AniList reports a missing media entry", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { Media: null } }));
    const { client } = createClient(fetchMock);

    await expect(client.getAnimeById(42)).resolves.toBeNull();
  });

  it("treats a not-found GraphQL response as a missing anime", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ errors: [{ message: "Not Found." }] }, 404),
    );
    const { client } = createClient(fetchMock);

    await expect(client.getAnimeById(999999)).resolves.toBeNull();
  });

  it("still rejects other detail failures", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ errors: [{ message: "Internal error" }] }, 400),
    );
    const { client } = createClient(fetchMock);

    await expect(client.getAnimeById(1)).rejects.toBeInstanceOf(AniListError);
  });

  it("honours an HTTP-date Retry-After header exactly", async () => {
    const nowMs = Date.parse("2026-01-01T00:00:00Z");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", {
          status: 429,
          headers: {
            "retry-after": new Date(nowMs + 3000).toUTCString(),
          },
        }),
      )
      .mockResolvedValueOnce(pageResponse());
    const sleeps: number[] = [];
    const client = new AniListClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => nowMs,
      random: () => 0,
      baseBackoffMs: 10,
      maxBackoffMs: 5000,
    });

    await client.searchAnime({ query: "date-retry" });

    expect(sleeps).toEqual([3000]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a rate-limit error instead of waiting longer than the budget", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("", {
          status: 429,
          headers: { "retry-after": "120" },
        }),
    );
    const sleeps: number[] = [];
    const client = new AniListClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      maxRetryAfterMs: 5000,
      maxRetries: 2,
    });

    await expect(client.searchAnime({ query: "slow-down" })).rejects.toMatchObject(
      { status: 429, retryAfterMs: 120_000 },
    );

    // Never retry earlier than the server asked for.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it("stops retrying once the total sleeping budget would be exceeded", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("", {
          status: 429,
          headers: { "retry-after": "5" },
        }),
    );
    const sleeps: number[] = [];
    const client = new AniListClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      maxRetries: 2,
      maxRetryAfterMs: 10_000,
      retryBudgetMs: 8_000,
    });

    await expect(client.searchAnime({ query: "budget" })).rejects.toBeInstanceOf(
      AniListError,
    );
    expect(sleeps).toEqual([5000]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("records one failure per suspended request, not per retry", async () => {
    const circuitBreaker = new CircuitBreaker({ failureThreshold: 3 });
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          errors: [
            {
              message:
                "The AniList API has been temporarily disabled due to severe stability issues.",
            },
          ],
          data: null,
        },
        403,
      ),
    );
    const client = new AniListClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      circuitBreaker,
      maxRetries: 3,
    });

    await expect(client.getAnimeById(154587)).rejects.toBeInstanceOf(
      AniListSuspendedError,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(circuitBreaker.getState().consecutiveFailures).toBe(1);
    expect(circuitBreaker.getState().state).toBe("OPEN");
  });

  it("permits only one half-open probe under concurrent load", async () => {
    let now = 0;
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      now: () => now,
    });
    circuitBreaker.recordFailure(new Error("boom"));
    now += 1000;

    let resolveProbe: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveProbe = resolve;
        }),
    );
    const client = new AniListClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      circuitBreaker,
      maxRetries: 0,
      now: () => now,
    });

    const requests = [1, 2, 3, 4, 5].map((index) =>
      client.searchAnime({ query: `probe-${index}` }),
    );

    // Only the probe reaches the network; the rest are rejected immediately.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveProbe?.(pageResponse());

    const settled = await Promise.allSettled(requests);
    const rejected = settled.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(4);
    for (const result of rejected) {
      expect(
        (result as PromiseRejectedResult).reason,
      ).toBeInstanceOf(CircuitBreakerOpenError);
    }
    expect(circuitBreaker.getState().state).toBe("CLOSED");
  });

  it("hydrates library entries in chunks of fifty", async () => {
    const ids = Array.from({ length: 120 }, (_, index) => index + 1);
    const fetchMock = vi.fn<typeof fetch>(async () => pageResponse([media]));
    const { client } = createClient(fetchMock);

    const result = await client.getAnimeByIds(ids);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.size).toBeGreaterThan(0);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      variables: { ids: number[]; perPage: number };
    };
    expect(body.variables.ids).toHaveLength(50);
    expect(body.variables.perPage).toBe(50);
  });
});
