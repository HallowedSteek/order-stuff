"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function TokenPage() {
  const [refreshToken, setRefreshToken] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/token")
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => setConnected(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.upstream].filter(Boolean).join("\n"));
      setConnected(true);
      setRefreshToken("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1>Wolt account</h1>
      <p>
        Status:{" "}
        {connected === null ? "checking…" : connected ? <strong>connected</strong> : <strong>not connected</strong>}
      </p>
      <p className="muted">
        Paste a refresh token from a logged-in wolt.com session. The server exchanges it, keeps the session in
        <code> .wolt-session.json</code> (gitignored) and refreshes it automatically; tokens are never sent back to
        the browser. Wolt rotates refresh tokens, so the one you paste stops working for your browser session.
      </p>
      <form className="panel" onSubmit={submit}>
        <textarea
          rows={3}
          style={{ width: "100%" }}
          value={refreshToken}
          onChange={(e) => setRefreshToken(e.target.value)}
          placeholder="refresh_token"
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button type="submit" disabled={loading || !refreshToken.trim()}>
            {loading ? "Connecting…" : connected ? "Reconnect" : "Connect"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
