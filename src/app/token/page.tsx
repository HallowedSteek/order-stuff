"use client";

import Link from "next/link";
import { useState } from "react";
import { RawJson } from "@/components/RawJson";
import type { TokenPair } from "@/lib/types";

export default function TokenPage() {
  const [refreshToken, setRefreshToken] = useState("");
  const [result, setResult] = useState<TokenPair | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.upstream].filter(Boolean).join("\n"));
      setResult(data);
      // Wolt rotates refresh tokens; keep the new one ready for the next call.
      if (data.refresh_token) setRefreshToken(data.refresh_token);
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
      <h1>Token refresh</h1>
      <p className="muted">
        POST authentication.wolt.com/v1/wauth2/access_token with grant_type=refresh_token. Grab a
        refresh token from a logged-in wolt.com session (browser storage / network tab).
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
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
      {result && <RawJson data={{ ...result, access_token: `${result.access_token.slice(0, 24)}…` }} />}
    </main>
  );
}
