# Wolt API POC

A small Next.js (App Router, TypeScript) proof of concept for the
[unofficial Wolt API doc](https://gist.github.com/OzTamir/7ed2b49b8628d88c086d65b0d1730c36).

Tracks **Bucharest, Romania only**. The location is fixed server-side to
central Bucharest (44.4268, 26.1025); clients can't pass coordinates, results
explicitly outside Romania are dropped, and prices are shown in RON. The
market lives in `src/lib/config.ts`.

The browser never calls Wolt directly: Next.js route handlers proxy the requests
(avoids CORS and keeps tokens server-side).

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

## What's covered

| UI | Local route | Wolt endpoint |
| --- | --- | --- |
| Nearby venues | `GET /api/venues` | `GET consumer-api.wolt.com/v1/pages/restaurants` (`sections[1].items`) |
| Search venues | `POST /api/search` `{q, target:"venues"}` | `POST restaurant-api.wolt.com/v1/pages/search` (`sections[0].items`) |
| Search items | `POST /api/search` `{q, target:"items"}` | same, each result's `menu_item` |
| Venue menu (`/venue/[slug]`) | `GET /api/venues/[slug]/menu` | `GET consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/{slug}/assortment`, falling back to the doc's `GET restaurant-api.wolt.com/v4/venues/slug/{slug}/menu/data` |
| Connect account (`/token`) | `GET/POST /api/token` | `POST authentication.wolt.com/v1/wauth2/access_token` |
| Send basket (venue page) | `POST /api/basket` `{slug, lines}` | `GET consumer-api /order-xp/web/v1/pages/venue/slug/{slug}/static`, then `POST consumer-api /order-xp/v1/baskets` |

Every result view has a "Raw JSON" toggle so you can compare the real responses
against the doc.

## Basket → Wolt app

The app **never places orders**. On a venue page, add items (with their
options) and click **Send to my Wolt basket**: the server rebuilds the basket
from Wolt's current catalog prices and saves it to your account. Then open the
Wolt app, go to the basket and check out yourself. Saving replaces any basket
you already had at that restaurant.

To connect your account, paste a refresh token on `/token`, or put it in
`.env.local`:

```bash
WOLT_REFRESH_TOKEN=...
```

The server keeps the session in `.wolt-session.json` (gitignored), refreshes
access tokens automatically, and never sends tokens to the browser. Wolt
rotates refresh tokens, so the one you hand over stops working for the browser
session you copied it from.

The basket endpoint and payload shape come from the community
[skorokithakis/woltapi](https://github.com/skorokithakis/woltapi) client, not
the gist. Items with option features this POC doesn't model (prerequisite
options, free selections) are marked "Add this one in the Wolt app".

## Code layout

- `src/lib/wolt.ts` – typed, server-only Wolt client (one function per endpoint)
- `src/lib/types.ts` – trimmed types from the doc's data models
- `src/lib/session.ts` – server-side Wolt login (token refresh + rotation)
- `src/lib/basket.ts` – builds and saves the Wolt basket
- `src/app/api/**` – route handlers that validate input and call the client
- `src/app/page.tsx`, `src/app/venue/[slug]`, `src/app/token` – UI

## Caveats (from the doc)

- Unofficial and undocumented: endpoints/shapes can change any time.
- The doc's menu endpoint returns 200 with an empty body for anonymous callers, so
  menus come from the (also undocumented) assortment endpoint wolt.com itself uses
  ([reference](https://github.com/NoaMcDa/KetoClub/pull/186)). It's normalized into
  categories → items in `getMenu` (`src/lib/wolt.ts`).
- Prices are integers, assumed to be minor units (e.g. `4500` = 45,00 lei).
- Only token *refresh* is documented; get an initial refresh token from a
  logged-in wolt.com session. Checkout/payment is intentionally not implemented.
