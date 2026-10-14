import "server-only";
import type {
  City,
  ItemSearchResult,
  MenuItem,
  TokenPair,
  VenueData,
} from "./types";

const CONSUMER_API = "https://consumer-api.wolt.com";
const RESTAURANT_API = "https://restaurant-api.wolt.com";
const AUTH_URL = "https://authentication.wolt.com/v1/wauth2/access_token";

export class WoltError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new WoltError(`Wolt responded ${res.status} for ${url}`, res.status, text.slice(0, 500));
  }
  // The doc notes the menu endpoint sometimes returns 200 with an empty body.
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

interface SectionsResponse<T> {
  sections?: { items?: T[] }[];
}

/** GET /v1/pages/restaurants — venues near a location (from sections[1].items). */
export async function getVenues(lat: number, lon: number): Promise<VenueData[]> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const data = await request<SectionsResponse<VenueData>>(
    `${CONSUMER_API}/v1/pages/restaurants?${params}`,
  );
  return (data.sections?.[1]?.items ?? []).filter((i) => i.venue);
}

/** GET /v4/venues/slug/{slug}/menu/data — menu items for a venue. */
export async function getMenu(slug: string): Promise<MenuItem[]> {
  const params = new URLSearchParams({
    unit_prices: "true",
    show_weighted_items: "true",
    show_subcategories: "true",
  });
  const data = await request<{ items?: MenuItem[] }>(
    `${RESTAURANT_API}/v4/venues/slug/${encodeURIComponent(slug)}/menu/data?${params}`,
  );
  return data.items ?? [];
}

function search<T>(q: string, target: "venues" | "items", lat: number, lon: number) {
  return request<SectionsResponse<T>>(`${RESTAURANT_API}/v1/pages/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, target, lat, lon }),
  });
}

/** POST /v1/pages/search with target=venues (results in sections[0].items). */
export async function searchVenues(q: string, lat: number, lon: number): Promise<VenueData[]> {
  const data = await search<VenueData>(q, "venues", lat, lon);
  return (data.sections?.[0]?.items ?? []).filter((i) => i.venue);
}

/** POST /v1/pages/search with target=items (each result's `menu_item`). */
export async function searchItems(q: string, lat: number, lon: number): Promise<ItemSearchResult[]> {
  const data = await search<{ menu_item?: ItemSearchResult }>(q, "items", lat, lon);
  return (data.sections?.[0]?.items ?? [])
    .map((i) => i.menu_item)
    .filter((i): i is ItemSearchResult => !!i);
}

/** GET /v1/cities */
export async function getCities(): Promise<City[]> {
  const data = await request<{ results?: City[] }>(`${RESTAURANT_API}/v1/cities`);
  return data.results ?? [];
}

/** POST auth form — exchange a refresh token for a new access/refresh pair. */
export async function refreshToken(refresh_token: string): Promise<TokenPair> {
  return request<TokenPair>(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token, grant_type: "refresh_token" }),
  });
}
