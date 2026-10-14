import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { refreshToken } from "./wolt";

/**
 * Server-side Wolt login. Wolt rotates the refresh token on every use, so the
 * newest one is saved to SESSION_FILE (gitignored) and survives restarts.
 * The first one comes from WOLT_REFRESH_TOKEN in .env.local or the /token page.
 * Tokens never leave the server.
 */
const SESSION_FILE = path.join(process.cwd(), ".wolt-session.json");

interface Session {
  refreshToken: string;
  accessToken?: string;
  /** Epoch ms after which the access token should be renewed. */
  expiresAt?: number;
}

let session: Session | null = null;
let pending: Promise<string> | null = null;

async function load(): Promise<Session | null> {
  if (session) return session;
  try {
    const saved = JSON.parse(await readFile(SESSION_FILE, "utf8")) as { refreshToken?: string };
    if (saved.refreshToken) return (session = { refreshToken: saved.refreshToken });
  } catch {
    // no saved session yet
  }
  const fromEnv = process.env.WOLT_REFRESH_TOKEN?.trim();
  return fromEnv ? (session = { refreshToken: fromEnv }) : null;
}

async function renew(current: Session): Promise<string> {
  const tokens = await refreshToken(current.refreshToken);
  // Default to 25 min if Wolt omits expires_in; renew a minute early.
  const ttl = (tokens.expires_in ?? 1500) * 1000;
  session = {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + ttl - 60_000,
  };
  await writeFile(SESSION_FILE, JSON.stringify({ refreshToken: tokens.refresh_token }), { mode: 0o600 });
  return tokens.access_token;
}

export class NotLoggedInError extends Error {
  constructor() {
    super("Not connected to a Wolt account. Add a refresh token on the /token page or in .env.local.");
  }
}

/** A valid access token, refreshing (once, even under concurrent calls) when needed. */
export async function getAccessToken({ force = false } = {}): Promise<string> {
  const current = await load();
  if (!current) throw new NotLoggedInError();
  if (!force && current.accessToken && current.expiresAt && Date.now() < current.expiresAt) {
    return current.accessToken;
  }
  pending ??= renew(current).finally(() => (pending = null));
  return pending;
}

/** Start a session from a refresh token copied out of wolt.com. */
export async function connect(refreshTokenValue: string): Promise<void> {
  session = null;
  pending = null;
  await renew({ refreshToken: refreshTokenValue });
}

export async function isConnected(): Promise<boolean> {
  return (await load()) !== null;
}
