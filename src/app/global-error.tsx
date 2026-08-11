"use client";

/**
 * Last resort: fires when the root layout itself fails, so it cannot rely on
 * any of the app's styling or components.
 */
export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="mn">
      <body
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
          display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center",
          margin: 0, padding: 24, background: "#fff", color: "#0a0a0a", textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 10px" }}>Алдаа гарлаа</h1>
          <p style={{ color: "#737373", margin: "0 0 20px", fontSize: 15 }}>
            Хуудсыг ачаалахад асуудал гарлаа. Дахин оролдоно уу.
          </p>
          {error.digest && (
            <p style={{ color: "#a3a3a3", fontSize: 12, fontFamily: "monospace", margin: "0 0 20px" }}>
              {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: "#0a0a0a", color: "#fff", border: 0, borderRadius: 999,
              padding: "12px 26px", fontSize: 15, cursor: "pointer",
            }}
          >
            Дахин оролдох
          </button>
        </div>
      </body>
    </html>
  );
}
