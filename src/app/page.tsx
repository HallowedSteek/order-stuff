"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { DEFAULT_LOCATION as DEFAULT } from "@/lib/config";
import { RawJson } from "@/components/RawJson";
import type { City, ItemSearchResult, VenueData } from "@/lib/types";

type Tab = "nearby" | "venues" | "items";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error([data.error, data.upstream].filter(Boolean).join("\n"));
  return data as T;
}

export default function Home() {
  const [lat, setLat] = useState<number>(DEFAULT.lat);
  const [lon, setLon] = useState<number>(DEFAULT.lon);
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");
  const [tab, setTab] = useState<Tab>("nearby");
  const [query, setQuery] = useState("shaorma");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venues, setVenues] = useState<VenueData[] | null>(null);
  const [items, setItems] = useState<ItemSearchResult[] | null>(null);

  useEffect(() => {
    call<City[]>("/api/cities")
      .then((list) => {
        // Romanian cities first, then the rest alphabetically.
        const ro = (c: City) => (c.country_code_alpha2 === DEFAULT.countryAlpha2 ? 0 : 1);
        setCities([...list].sort((a, b) => ro(a) - ro(b) || a.name.localeCompare(b.name)));
        const home = list.find((c) => c.slug === DEFAULT.citySlug);
        if (home) setCityId(home.id);
      })
      .catch((e: Error) => setError(`Cities: ${e.message}`));
  }, []);

  function pickCity(id: string) {
    setCityId(id);
    const coords = cities.find((c) => c.id === id)?.location?.coordinates;
    if (coords) {
      setLon(coords[0]);
      setLat(coords[1]);
    }
  }

  async function run() {
    setLoading(true);
    setError(null);
    setVenues(null);
    setItems(null);
    try {
      if (tab === "nearby") {
        setVenues(await call<VenueData[]>(`/api/venues?lat=${lat}&lon=${lon}`));
      } else {
        const results = await call<VenueData[] | ItemSearchResult[]>("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: query, target: tab, lat, lon }),
        });
        if (tab === "venues") setVenues(results as VenueData[]);
        else setItems(results as ItemSearchResult[]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Wolt API POC</h1>
      <p className="muted">
        Exercises the{" "}
        <a href="https://gist.github.com/OzTamir/7ed2b49b8628d88c086d65b0d1730c36">
          unofficial Wolt API doc
        </a>{" "}
        through Next.js route handlers. · <Link href="/token">Token refresh</Link>
      </p>

      <section className="panel">
        <div className="row">
          <select value={cityId} onChange={(e) => pickCity(e.target.value)}>
            <option value="" disabled>
              {cities.length ? `Pick a city (${cities.length})` : "Loading cities…"}
            </option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.country_code_alpha2})
              </option>
            ))}
          </select>
          <label>
            lat <input type="number" step="any" value={lat} onChange={(e) => setLat(Number(e.target.value))} />
          </label>
          <label>
            lon <input type="number" step="any" value={lon} onChange={(e) => setLon(Number(e.target.value))} />
          </label>
        </div>

        <div className="tabs" role="tablist">
          {(
            [
              ["nearby", "Nearby venues"],
              ["venues", "Search venues"],
              ["items", "Search items"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        <form
          className="row"
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          {tab !== "nearby" && (
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
          )}
          <button type="submit" disabled={loading}>
            {loading ? "Loading…" : tab === "nearby" ? "Load venues" : "Search"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      {venues && <VenueGrid venues={venues} />}
      {items && <ItemGrid items={items} />}
    </main>
  );
}

function VenueGrid({ venues }: { venues: VenueData[] }) {
  return (
    <section>
      <p className="muted">{venues.length} venues</p>
      <div className="grid">
        {venues.map(({ venue, image, overlay_v2, overlay }) => (
          <Link
            key={venue.id}
            href={`/venue/${venue.slug}?currency=${venue.currency ?? ""}`}
            className="card"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image?.url && <img src={image.url} alt="" loading="lazy" />}
            <div className="body">
              <span className="title">{venue.name}</span>
              {venue.short_description && <span className="muted">{venue.short_description}</span>}
              <span className="muted">
                {venue.online ? "Open" : "Closed"}
                {venue.estimate_range && ` · ${venue.estimate_range} min`}
                {venue.rating && ` · ★ ${venue.rating.score}`}
              </span>
              {(overlay_v2?.primary_text || overlay) && (
                <span className="muted">{overlay_v2?.primary_text ?? overlay}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
      <RawJson data={venues} />
    </section>
  );
}

function ItemGrid({ items }: { items: ItemSearchResult[] }) {
  return (
    <section>
      <p className="muted">{items.length} items</p>
      <div className="grid">
        {items.map((item) => (
          <div key={`${item.venue_id}-${item.id}`} className="card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image?.url && <img src={item.image.url} alt="" loading="lazy" />}
            <div className="body">
              <span className="title">{item.name}</span>
              <span>{formatPrice(item.price, item.currency)}</span>
              <span className="muted">
                {item.venue_name}
                {item.is_available === false && " · unavailable"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <RawJson data={items} />
    </section>
  );
}
