export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const obj = payload as Record<string, unknown>;
  if (typeof obj.error === "string") {
    return obj.error;
  }
  if (
    obj.error &&
    typeof obj.error === "object" &&
    typeof (obj.error as Record<string, unknown>).message === "string"
  ) {
    return (obj.error as Record<string, unknown>).message as string;
  }
  if (typeof obj.message === "string") {
    return obj.message;
  }
  if (typeof obj.details === "string") {
    return obj.details;
  }
  return null;
}

/**
 * Fetches JSON and surfaces API error messages. Abort errors are rethrown
 * untouched so search components can cancel obsolete requests.
 */
export async function apiFetch<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    throw new ApiRequestError(
      "Could not reach the server. Check your connection and try again.",
      0,
      { cause: error },
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = readErrorMessage(payload);
    console.error("[apiFetch error]", response.status, payload);
    throw new ApiRequestError(
      errorMsg ?? "The request could not be completed.",
      response.status,
    );
  }

  return payload as T;
}
