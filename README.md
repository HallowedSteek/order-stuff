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
| Token refresh (`/token`) | `POST /api/token` `{refresh_token}` | `POST authentication.wolt.com/v1/wauth2/access_token` |

Every result view has a "Raw JSON" toggle so you can compare the real responses
against the doc.

## Code layout

- `src/lib/wolt.ts` – typed, server-only Wolt client (one function per endpoint)
- `src/lib/types.ts` – trimmed types from the doc's data models
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
  logged-in wolt.com session. Basket/ordering isn't covered.
