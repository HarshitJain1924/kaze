"use client";

/**
 * Last-resort boundary for failures in the root layout itself. It replaces
 * that layout, so it must render its own document and cannot rely on the
 * design-system styles having loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090a10",
          color: "#f4f6fb",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Kaze couldn&apos;t start</h1>
          <p
            style={{
              marginTop: "0.75rem",
              lineHeight: 1.6,
              color: "#9ba7be",
              fontSize: "0.9rem",
            }}
          >
            Something failed before the app could load. Your library and
            progress are stored safely in your account.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.65rem 1.1rem",
              borderRadius: "0.6rem",
              border: "1px solid #a78bfa",
              background: "#8b5cf6",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p
            style={{
              marginTop: "1rem",
              color: "#6e7a92",
              fontSize: "0.75rem",
            }}
          >
            Reference: {error.digest ?? "unknown"}
          </p>
        </main>
      </body>
    </html>
  );
}
