"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RawJson } from "@/components/RawJson";
import { formatPrice } from "@/lib/format";
import type { Menu } from "@/lib/types";

const ENDPOINTS: Record<Menu["source"], string> = {
  assortment: "GET consumer-api /consumer-assortment/v1/venues/slug/{slug}/assortment",
  "menu-data": "GET restaurant-api /v4/venues/slug/{slug}/menu/data",
};

export function VenueMenu({ slug, currency }: { slug: string; currency: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/venues/${encodeURIComponent(slug)}/menu`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error([data.error, data.upstream].filter(Boolean).join("\n"));
        setMenu(data);
      })
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  return (
    <main>
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1>{slug}</h1>

      {error && <p className="error">{error}</p>}
      {!menu && !error && <p className="muted">Loading menu…</p>}

      {menu && (
        <>
          <p className="muted">
            {menu.itemCount} items in {menu.categories.length} categories · via{" "}
            {ENDPOINTS[menu.source].replace("{slug}", slug)}
          </p>
          {menu.loadingStrategy === "partial" && (
            <p className="muted">Wolt returned a partial menu; some items may be missing.</p>
          )}
          {menu.itemCount === 0 && (
            <p className="error">
              Both menu endpoints returned no items. Check &ldquo;Raw JSON&rdquo; below for what Wolt sent.
            </p>
          )}

          {menu.categories.length > 1 && (
            <nav className="row" style={{ margin: "12px 0" }}>
              {menu.categories.map((c, i) => (
                <a key={i} href={`#cat-${i}`} className="muted">
                  {c.name}
                </a>
              ))}
            </nav>
          )}

          {menu.categories.map((category, i) => (
            <section key={i} id={`cat-${i}`}>
              <h2 style={{ fontSize: "1.1rem" }}>
                {category.name} <span className="muted">({category.items.length})</span>
              </h2>
              <div className="grid">
                {category.items.map((item) => (
                  <div key={item.id} className="card" style={{ opacity: item.disabled ? 0.5 : 1 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" />}
                    <div className="body">
                      <span className="title">{item.name}</span>
                      <span>{formatPrice(item.price, currency)}</span>
                      {item.description && <span className="muted">{item.description}</span>}
                      {item.options.length > 0 && (
                        <span className="muted">Options: {item.options.join(", ")}</span>
                      )}
                      {item.disabled && <span className="muted">Unavailable</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <RawJson data={menu.raw ?? menu} />
        </>
      )}
    </main>
  );
}
