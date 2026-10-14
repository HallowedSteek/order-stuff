import "server-only";
import { BUCHAREST } from "./config";
import type {
  ItemSearchResult,
  Menu,
  MenuCategory,
  MenuEntry,
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

/** Wolt queries are location-based, but drop anything explicitly outside Romania. */
function inRomania(country: string | undefined) {
  return !country || country === BUCHAREST.countryAlpha3;
}

interface SectionsResponse<T> {
  sections?: { items?: T[] }[];
}

/** GET /v1/pages/restaurants — venues near a location (from sections[1].items). */
export async function getVenues(): Promise<VenueData[]> {
  const params = new URLSearchParams({ lat: String(BUCHAREST.lat), lon: String(BUCHAREST.lon) });
  const data = await request<SectionsResponse<VenueData>>(
    `${CONSUMER_API}/v1/pages/restaurants?${params}`,
  );
  return (data.sections?.[1]?.items ?? []).filter((i) => i.venue && inRomania(i.venue.country));
}

type Json = Record<string, unknown>;

const asArray = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const asString = (v: unknown) => (typeof v === "string" && v ? v : undefined);

// Headers wolt.com's own web client sends.
const WEB_HEADERS = { platform: "Web", "app-language": "en" };

/**
 * GET consumer-assortment/.../assortment — the endpoint wolt.com itself uses.
 * Not in the doc: its menu/data endpoint answers anonymous callers with an
 * empty body (see https://github.com/NoaMcDa/KetoClub/pull/186).
 */
async function getAssortment(slug: string): Promise<Menu> {
  const data = await request<Json>(
    `${CONSUMER_API}/consumer-api/consumer-assortment/v1/venues/slug/${encodeURIComponent(slug)}/assortment`,
    { headers: WEB_HEADERS },
  );

  const optionNames = new Map<string, string>();
  for (const o of asArray(data.options)) {
    const id = asString(o.id);
    const name = asString(o.name);
    if (id && name) optionNames.set(id, name);
  }

  const items = new Map<string, MenuEntry>();
  for (const i of asArray(data.items)) {
    const id = asString(i.id);
    if (!id) continue;
    const images = asArray(i.images);
    items.set(id, {
      id,
      name: asString(i.name) ?? "(unnamed)",
      description: asString(i.description),
      price: typeof i.price === "number" ? i.price : null,
      imageUrl: asString(images[0]?.url),
      disabled: i.disabled_info != null,
      options: asArray(i.options)
        .map((o) => asString(o.name) ?? optionNames.get(asString(o.option_id) ?? asString(o.id) ?? ""))
        .filter((n): n is string => !!n),
    });
  }

  // Categories reference items by id and can nest subcategories.
  const categories: MenuCategory[] = [];
  const placed = new Set<string>();
  const walk = (cats: Json[], prefix: string) => {
    for (const c of cats) {
      const name = prefix + (asString(c.name) ?? "Untitled");
      const list = (Array.isArray(c.item_ids) ? c.item_ids : [])
        .map((id) => items.get(String(id)))
        .filter((i): i is MenuEntry => !!i);
      list.forEach((i) => placed.add(i.id));
      if (list.length) categories.push({ name, items: list });
      walk(asArray(c.subcategories), `${name} › `);
    }
  };
  walk(asArray(data.categories), "");

  const rest = [...items.values()].filter((i) => !placed.has(i.id));
  if (rest.length) categories.push({ name: "Other", items: rest });

  return {
    source: "assortment",
    categories,
    itemCount: items.size,
    loadingStrategy: asString(data.loading_strategy),
    raw: items.size ? undefined : data,
  };
}

/** GET /v4/venues/slug/{slug}/menu/data — the endpoint from the doc (often empty). */
async function getMenuData(slug: string): Promise<Menu> {
  const params = new URLSearchParams({
    unit_prices: "true",
    show_weighted_items: "true",
    show_subcategories: "true",
  });
  const data = await request<{ items?: MenuItem[] }>(
    `${RESTAURANT_API}/v4/venues/slug/${encodeURIComponent(slug)}/menu/data?${params}`,
  );
  const groups = new Map<string, MenuEntry[]>();
  for (const i of data.items ?? []) {
    const key = i.category || "Other";
    groups.set(key, [
      ...(groups.get(key) ?? []),
      {
        id: i.id,
        name: i.name,
        description: i.description || undefined,
        price: i.baseprice ?? null,
        imageUrl: i.images?.[0]?.url,
        disabled: i.enabled === false,
        options: (i.options ?? []).map((o) => o.name),
      },
    ]);
  }
  return {
    source: "menu-data",
    categories: [...groups].map(([name, items]) => ({ name, items })),
    itemCount: data.items?.length ?? 0,
  };
}

/** Venue menu: try the assortment endpoint, fall back to the documented one. */
export async function getMenu(slug: string): Promise<Menu> {
  let assortment: Menu | undefined;
  let firstError: unknown;
  try {
    assortment = await getAssortment(slug);
    if (assortment.itemCount) return assortment;
  } catch (err) {
    firstError = err;
  }
  try {
    const legacy = await getMenuData(slug);
    if (legacy.itemCount) return legacy;
  } catch (err) {
    firstError ??= err;
  }
  if (assortment) return assortment; // empty, but carries `raw` for debugging
  throw firstError;
}

function search<T>(q: string, target: "venues" | "items") {
  return request<SectionsResponse<T>>(`${RESTAURANT_API}/v1/pages/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, target, lat: BUCHAREST.lat, lon: BUCHAREST.lon }),
  });
}

/** POST /v1/pages/search with target=venues (results in sections[0].items). */
export async function searchVenues(q: string): Promise<VenueData[]> {
  const data = await search<VenueData>(q, "venues");
  return (data.sections?.[0]?.items ?? []).filter((i) => i.venue && inRomania(i.venue.country));
}

/** POST /v1/pages/search with target=items (each result's `menu_item`). */
export async function searchItems(q: string): Promise<ItemSearchResult[]> {
  const data = await search<{ menu_item?: ItemSearchResult }>(q, "items");
  return (data.sections?.[0]?.items ?? [])
    .map((i) => i.menu_item)
    .filter((i): i is ItemSearchResult => !!i && inRomania(i.country));
}

/** POST auth form — exchange a refresh token for a new access/refresh pair. */
export async function refreshToken(refresh_token: string): Promise<TokenPair> {
  return request<TokenPair>(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token, grant_type: "refresh_token" }),
  });
}
