import "server-only";
import { BUCHAREST } from "./config";
import type {
  ItemSearchResult,
  Menu,
  MenuCategory,
  MenuEntry,
  MenuItem,
  MenuOptionGroup,
  TokenPair,
  VenueData,
} from "./types";

export const CONSUMER_API = "https://consumer-api.wolt.com";
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

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
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

export type Json = Record<string, unknown>;

export const asArray = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
export const asString = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const asInt = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : undefined);

/** Names can be plain strings or translations ([{lang, value}] / {lang: value}). */
export function text(v: unknown): string | undefined {
  if (typeof v === "string") return v || undefined;
  if (Array.isArray(v)) {
    const list = v as Json[];
    const en = list.find((t) => t.lang === "en") ?? list[0];
    return asString(en?.value);
  }
  if (v && typeof v === "object") {
    const map = v as Json;
    return asString(map.en) ?? Object.values(map).map(asString).find(Boolean);
  }
  return undefined;
}

// Headers wolt.com's own web client sends.
export const WEB_HEADERS = { platform: "Web", "app-language": "en" };

export const assortmentUrl = (slug: string) =>
  `${CONSUMER_API}/consumer-api/consumer-assortment/v1/venues/slug/${encodeURIComponent(slug)}/assortment`;

/** Raw assortment, as returned by Wolt. */
export function getRawAssortment(slug: string) {
  return request<Json>(assortmentUrl(slug), { headers: WEB_HEADERS });
}

/**
 * Resolve an item's option configurations against the assortment's root
 * options. Returns null when the item uses option features this POC doesn't
 * handle (prerequisites, free selections, unknown types).
 */
export function resolveOptions(item: Json, rootOptions: Map<string, Json>): MenuOptionGroup[] | null {
  const groups: MenuOptionGroup[] = [];
  for (const config of asArray(item.options)) {
    const id = asString(config.id);
    const root = rootOptions.get(asString(config.option_id) ?? "");
    const rules = (config.multi_choice_config ?? {}) as Json;
    const range = (rules.total_range ?? {}) as Json;
    const min = asInt(range.min);
    const max = asInt(range.max);
    const maxSingle = asInt(rules.max_single_selections);
    if (
      !id ||
      !root ||
      (root.type !== "choice" && root.type !== "multi_choice") ||
      asArray(config.prerequisite_values).length > 0 ||
      (asInt(rules.free_selections) ?? 0) !== 0 ||
      min === undefined ||
      max === undefined ||
      maxSingle === undefined
    ) {
      return null;
    }
    groups.push({
      id,
      name: text(config.name) ?? text(root.name) ?? "Options",
      min,
      max,
      maxSingle,
      values: asArray(root.values).flatMap((v) => {
        const vid = asString(v.id);
        return vid ? [{ id: vid, name: text(v.name) ?? vid, price: asInt(v.price) ?? 0 }] : [];
      }),
    });
  }
  return groups;
}

/**
 * GET consumer-assortment/.../assortment — the endpoint wolt.com itself uses.
 * Not in the doc: its menu/data endpoint answers anonymous callers with an
 * empty body (see https://github.com/NoaMcDa/KetoClub/pull/186).
 */
async function getAssortment(slug: string): Promise<Menu> {
  const data = await getRawAssortment(slug);

  const rootOptions = new Map<string, Json>();
  for (const o of asArray(data.options)) {
    const id = asString(o.id);
    if (id) rootOptions.set(id, o);
  }

  const items = new Map<string, MenuEntry>();
  for (const i of asArray(data.items)) {
    const id = asString(i.id);
    if (!id) continue;
    const images = asArray(i.images);
    const options = resolveOptions(i, rootOptions);
    const price = typeof i.price === "number" ? i.price : null;
    const disabled = i.disabled_info != null;
    items.set(id, {
      id,
      name: text(i.name) ?? "(unnamed)",
      description: text(i.description),
      price,
      imageUrl: asString(images[0]?.url),
      disabled,
      options: options ?? [],
      basketable: !disabled && price !== null && options !== null,
    });
  }

  // Categories reference items by id and can nest subcategories.
  const categories: MenuCategory[] = [];
  const placed = new Set<string>();
  const walk = (cats: Json[], prefix: string) => {
    for (const c of cats) {
      const name = prefix + (text(c.name) ?? "Untitled");
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
        options: [],
        basketable: false,
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
