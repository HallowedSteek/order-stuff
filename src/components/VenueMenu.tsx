"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OptionPicker } from "@/components/OptionPicker";
import { RawJson } from "@/components/RawJson";
import { formatPrice } from "@/lib/format";
import type { BasketLine, Menu, MenuEntry } from "@/lib/types";

const ENDPOINTS: Record<Menu["source"], string> = {
  assortment: "GET consumer-api /consumer-assortment/v1/venues/slug/{slug}/assortment",
  "menu-data": "GET restaurant-api /v4/venues/slug/{slug}/menu/data",
};

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; total: number; currency: string; payload: unknown; response: unknown }
  | { status: "error"; message: string };

/** Estimated line price from the menu; the server recomputes from Wolt's catalog. */
function linePrice(item: MenuEntry, line: BasketLine) {
  let unit = item.price ?? 0;
  for (const group of item.options) {
    for (const id of line.options[group.id] ?? []) {
      unit += group.values.find((v) => v.id === id)?.price ?? 0;
    }
  }
  return unit * line.count;
}

function optionSummary(item: MenuEntry, line: BasketLine) {
  return item.options
    .flatMap((g) => (line.options[g.id] ?? []).map((id) => g.values.find((v) => v.id === id)?.name))
    .filter(Boolean)
    .join(", ");
}

export function VenueMenu({ slug, currency }: { slug: string; currency: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [cart, setCart] = useState<BasketLine[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const [send, setSend] = useState<SendState>({ status: "idle" });
  const [saved, setSaved] = useState<{ loading: boolean; data?: unknown; error?: string }>({ loading: false });

  async function loadSaved() {
    setSaved({ loading: true });
    try {
      const res = await fetch("/api/basket");
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.upstream].filter(Boolean).join("\n"));
      setSaved({ loading: false, data });
    } catch (e) {
      setSaved({ loading: false, error: (e as Error).message });
    }
  }

  useEffect(() => {
    fetch(`/api/venues/${encodeURIComponent(slug)}/menu`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error([data.error, data.upstream].filter(Boolean).join("\n"));
        setMenu(data);
      })
      .catch((e: Error) => setError(e.message));
    fetch("/api/token")
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => setConnected(false));
  }, [slug]);

  function updateCart(next: BasketLine[]) {
    setCart(next);
    setSend({ status: "idle" });
  }

  const itemsById = useMemo(
    () => new Map(menu?.categories.flatMap((c) => c.items.map((i) => [i.id, i] as const)) ?? []),
    [menu],
  );

  function add(item: MenuEntry, options: Record<string, string[]> = {}) {
    setPicking(null);
    const existing = cart.find((l) => l.itemId === item.id);
    // Wolt keeps one line per item, so adding again with new options replaces them.
    if (existing && JSON.stringify(existing.options) === JSON.stringify(options)) {
      updateCart(cart.map((l) => (l === existing ? { ...l, count: l.count + 1 } : l)));
    } else {
      updateCart([...cart.filter((l) => l.itemId !== item.id), { itemId: item.id, count: existing?.count ?? 1, options }]);
    }
  }

  function setCount(itemId: string, count: number) {
    updateCart(count < 1 ? cart.filter((l) => l.itemId !== itemId) : cart.map((l) => (l.itemId === itemId ? { ...l, count } : l)));
  }

  async function sendToWolt() {
    setSend({ status: "sending" });
    try {
      const res = await fetch("/api/basket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, lines: cart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.upstream].filter(Boolean).join("\n"));
      setSend({ status: "sent", total: data.total, currency: data.currency, payload: data.payload, response: data.response });
    } catch (e) {
      setSend({ status: "error", message: (e as Error).message });
    }
  }

  const estimate = cart.reduce((sum, l) => {
    const item = itemsById.get(l.itemId);
    return sum + (item ? linePrice(item, l) : 0);
  }, 0);

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

          {cart.length > 0 && (
            <section className="panel basket">
              <h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>Basket</h2>
              {cart.map((line) => {
                const item = itemsById.get(line.itemId);
                return (
                  <div key={line.itemId} className="row" style={{ justifyContent: "space-between" }}>
                    <span>
                      {item?.name ?? line.itemId}
                      {item && optionSummary(item, line) && <span className="muted"> · {optionSummary(item, line)}</span>}
                    </span>
                    <span className="row">
                      <button type="button" className="secondary" onClick={() => setCount(line.itemId, line.count - 1)}>
                        −
                      </button>
                      {line.count}
                      <button type="button" className="secondary" onClick={() => setCount(line.itemId, line.count + 1)}>
                        +
                      </button>
                      <span style={{ minWidth: 90, textAlign: "right" }}>
                        {item ? formatPrice(linePrice(item, line), currency) : "—"}
                      </span>
                    </span>
                  </div>
                );
              })}
              <p>
                <strong>Estimated total: {formatPrice(estimate, currency)}</strong>{" "}
                <span className="muted">(before delivery fees; Wolt shows the final price at checkout)</span>
              </p>
              <div className="row">
                <button
                  type="button"
                  disabled={!connected || send.status === "sending"}
                  onClick={sendToWolt}
                >
                  {send.status === "sending" ? "Sending…" : "Send to my Wolt basket"}
                </button>
                <button type="button" className="secondary" onClick={() => updateCart([])}>
                  Clear
                </button>
              </div>
              {connected === false && (
                <p className="muted">
                  Connect your Wolt account on the <Link href="/token">token page</Link> first.
                </p>
              )}
              {send.status === "sent" && (
                <p>
                  ✓ Saved to your Wolt account ({formatPrice(send.total, send.currency)}). Open the Wolt app →
                  Basket to check out. This replaced any earlier basket you had at this restaurant.
                </p>
              )}
              {send.status === "sent" && (
                <details>
                  <summary>What we sent / what Wolt answered</summary>
                  <pre>{JSON.stringify({ sent: send.payload, response: send.response }, null, 2)}</pre>
                </details>
              )}
              {send.status === "error" && <p className="error">{send.message}</p>}
            </section>
          )}

          {connected && (
            <section className="panel">
              <div className="row">
                <button type="button" className="secondary" onClick={loadSaved} disabled={saved.loading}>
                  {saved.loading ? "Loading…" : "Show baskets saved on my Wolt account"}
                </button>
              </div>
              {saved.error && <p className="error">{saved.error}</p>}
              {saved.data !== undefined && (
                <details open>
                  <summary>GET /order-xp/v1/baskets/count + /order-xp/web/v1/pages/baskets</summary>
                  <pre>{JSON.stringify(saved.data, null, 2)}</pre>
                </details>
              )}
            </section>
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
                        <span className="muted">Options: {item.options.map((o) => o.name).join(", ")}</span>
                      )}
                      {item.disabled && <span className="muted">Unavailable</span>}
                      {picking === item.id ? (
                        <OptionPicker
                          item={item}
                          currency={currency}
                          onAdd={(options) => add(item, options)}
                          onCancel={() => setPicking(null)}
                        />
                      ) : item.basketable ? (
                        <button
                          type="button"
                          onClick={() => (item.options.length ? setPicking(item.id) : add(item))}
                        >
                          {cart.some((l) => l.itemId === item.id) ? "Add another" : "Add to basket"}
                        </button>
                      ) : (
                        !item.disabled && <span className="muted">Add this one in the Wolt app</span>
                      )}
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
