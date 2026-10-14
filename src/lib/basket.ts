import "server-only";
import { getAccessToken } from "./session";
import type { BasketLine } from "./types";
import {
  CONSUMER_API,
  WEB_HEADERS,
  WoltError,
  asArray,
  asString,
  getRawAssortment,
  request,
  resolveOptions,
  text,
  type Json,
} from "./wolt";

export class BasketError extends Error {}

/** Wolt endpoints that need the logged-in account, retried once on a 401. */
async function authed<T>(url: string, init: RequestInit = {}): Promise<T> {
  const call = async (token: string) =>
    request<T>(url, {
      ...init,
      headers: { ...WEB_HEADERS, ...init.headers, Authorization: `Bearer ${token}` },
    });
  try {
    return await call(await getAccessToken());
  } catch (err) {
    if (err instanceof WoltError && err.status === 401) return call(await getAccessToken({ force: true }));
    throw err;
  }
}

/** Build the basket payload from Wolt's current catalog; client prices are never trusted. */
export function buildBasketPayload(
  assortment: Json,
  venue: { id: string; currency: string },
  lines: BasketLine[],
) {
  const catalog = new Map(asArray(assortment.items).map((i) => [asString(i.id), i]));
  const rootOptions = new Map<string, Json>();
  for (const o of asArray(assortment.options)) {
    const id = asString(o.id);
    if (id) rootOptions.set(id, o);
  }

  const seen = new Set<string>();
  const items = lines.map((line) => {
    const item = catalog.get(line.itemId);
    if (!item) throw new BasketError(`Item ${line.itemId} is no longer on the menu.`);
    const name = text(item.name) ?? line.itemId;
    if (seen.has(line.itemId)) {
      // Wolt's basket holds one line per item id.
      throw new BasketError(`"${name}" is in the basket twice with different options; keep one.`);
    }
    seen.add(line.itemId);
    if (item.disabled_info != null) throw new BasketError(`"${name}" is currently unavailable.`);
    if (!Number.isInteger(line.count) || line.count < 1) throw new BasketError(`Bad quantity for "${name}".`);
    if (typeof item.price !== "number") throw new BasketError(`"${name}" has no price.`);
    const groups = resolveOptions(item, rootOptions);
    if (!groups) throw new BasketError(`"${name}" uses options this POC can't handle; add it in the Wolt app.`);

    let unitPrice = item.price;
    // Every configuration is sent, with an empty value list when nothing is picked.
    const options = groups.map((group) => {
      const picked = line.options[group.id] ?? [];
      const counts = new Map<string, number>();
      for (const id of picked) counts.set(id, (counts.get(id) ?? 0) + 1);
      const values = [...counts].map(([id, count]) => {
        const value = group.values.find((v) => v.id === id);
        if (!value) throw new BasketError(`Unknown choice for "${group.name}" on "${name}".`);
        if (count > group.maxSingle) throw new BasketError(`Too many "${value.name}" on "${name}".`);
        unitPrice += value.price * count;
        return { id, count, price: value.price };
      });
      if (picked.length < group.min || picked.length > group.max) {
        throw new BasketError(
          `"${name}": pick ${group.min === group.max ? group.min : `${group.min}–${group.max}`} for "${group.name}".`,
        );
      }
      return { id: group.id, values };
    });

    return {
      id: line.itemId,
      count: line.count,
      name,
      price: unitPrice * line.count,
      options,
      substitution_settings: { is_allowed: false },
    };
  });

  if (!items.length) throw new BasketError("The basket is empty.");
  return { venue_id: venue.id, currency: venue.currency, items };
}

/** Venue id and currency from the venue's static page. */
async function getVenueContext(slug: string) {
  const data = await request<Json>(
    `${CONSUMER_API}/order-xp/web/v1/pages/venue/slug/${encodeURIComponent(slug)}/static`,
    { headers: WEB_HEADERS },
  );
  const venue = (data.venue ?? {}) as Json;
  const id = asString(venue.id);
  const currency = asString(venue.currency);
  if (!id || !currency) throw new BasketError("Couldn't read the venue's id/currency from Wolt.");
  return { id, currency };
}

/**
 * POST /order-xp/v1/baskets — replaces the account's whole basket for this
 * venue. It does not place an order: checkout happens in the Wolt app.
 */
export async function saveBasket(slug: string, lines: BasketLine[]) {
  const [assortment, venue] = await Promise.all([getRawAssortment(slug), getVenueContext(slug)]);
  const payload = buildBasketPayload(assortment, venue, lines);
  const res = await authed<Json>(`${CONSUMER_API}/order-xp/v1/baskets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return {
    basketId: asString(res.id),
    items: payload.items.length,
    total: payload.items.reduce((sum, i) => sum + i.price, 0),
    currency: venue.currency,
  };
}
