"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RawJson } from "@/components/RawJson";
import { formatPrice } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

export function VenueMenu({ slug, currency }: { slug: string; currency: string }) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/venues/${encodeURIComponent(slug)}/menu`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error([data.error, data.upstream].filter(Boolean).join("\n"));
        setItems(data);
      })
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();
    for (const item of items ?? []) {
      const key = item.category || "Uncategorized";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return groups;
  }, [items]);

  return (
    <main>
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1>{slug}</h1>
      <p className="muted">GET /v4/venues/slug/{slug}/menu/data</p>

      {error && <p className="error">{error}</p>}
      {!items && !error && <p className="muted">Loading menu…</p>}
      {items && items.length === 0 && (
        <p className="muted">
          No items returned. The doc notes this endpoint can respond 200 with an empty body.
        </p>
      )}

      {[...byCategory].map(([category, list]) => (
        <section key={category}>
          <h2 style={{ fontSize: "1.1rem" }}>
            {category} <span className="muted">({list.length})</span>
          </h2>
          <div className="grid">
            {list.map((item) => (
              <div key={item.id} className="card" style={{ opacity: item.enabled === false ? 0.5 : 1 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item.images?.[0]?.url && <img src={item.images[0].url} alt="" loading="lazy" />}
                <div className="body">
                  <span className="title">{item.name}</span>
                  <span>{formatPrice(item.baseprice, currency)}</span>
                  {item.description && <span className="muted">{item.description}</span>}
                  {!!item.options?.length && (
                    <span className="muted">{item.options.length} option group(s)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {items && <RawJson data={items} />}
    </main>
  );
}
