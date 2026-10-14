# order-stuff · Wolt Bucharest POC

A small Next.js (App Router, TypeScript) app that uses Wolt's unofficial API to
browse restaurants in **Bucharest, Romania** and fill your **Wolt basket**.
You then check out yourself in the Wolt app. It never places orders or touches
payment.

Started from the
[unofficial Wolt API doc](https://gist.github.com/OzTamir/7ed2b49b8628d88c086d65b0d1730c36);
the menu and basket endpoints come from community clients (see
[Sources](#sources)).

## Quick start

```bash
npm install
npm run dev   # http://localhost:3000
```

1. **Browse:** nearby venues, venue search and item search work without an account.
2. **Connect your account:** paste a Wolt refresh token on `/token` (see
   [Getting a refresh token](#getting-a-refresh-token)).
3. **Fill the basket:** open a restaurant, add items (the option picker enforces
   required choices), click **Send to my Wolt basket**.
4. **Check out:** open the Wolt app → basket → checkout.

## Features

- **Bucharest only.** The location is fixed server-side to central Bucharest
  (44.4268, 26.1025). Clients can't pass coordinates, results explicitly
  outside Romania are dropped, and prices are shown in RON (`ro-RO`). The
  market is set in `src/lib/config.ts`.
- **Menus.** Categories (including subcategories), prices, photos, option
  groups and availability.
- **Basket.** Add items with options and adjust quantities. The server rebuilds
  the basket from Wolt's current catalog (it never trusts client prices) and
  saves it to your account.
- **Debugging.** Every result view has a "Raw JSON" toggle. After sending, the
  venue page shows the exact payload and Wolt's response, and **Show baskets
  saved on my Wolt account** reads back what Wolt stored.
- **Server-side login.** Tokens never reach the browser. The browser only talks
  to this app's API routes, never to Wolt directly.

## Getting a refresh token

1. Log in on wolt.com and open DevTools → **Network** (tick *Preserve log*).
2. Filter for `access_token`, then reload, or log out and back in.
3. Open the `POST authentication.wolt.com/v1/wauth2/access_token` request →
   **Response**, and copy `refresh_token`.
4. Paste it on `/token`, or put it in `.env.local`:

   ```bash
   WOLT_REFRESH_TOKEN=...
   ```

The server exchanges it, keeps the session in `.wolt-session.json` (gitignored)
and refreshes access tokens automatically. Wolt **rotates** refresh tokens
(each one works once), so the browser session you copied it from will likely be
logged out. Treat the token like a password: anyone holding it can use your
account.

## Basket behaviour (verified)

- **One basket per restaurant.** Sending again *replaces* your basket at that
  restaurant; it doesn't add to it.
- **`price` is the line total** (unit price incl. options × count). Wolt sums
  the item prices into the basket total.
- Baskets show up in the **Wolt mobile app**. wolt.com may need a hard reload
  before it shows them.
- Items whose option setup this app doesn't support (prerequisite options,
  free selections) are marked "Add this one in the Wolt app".

## API routes

| UI | Local route | Wolt endpoint |
| --- | --- | --- |
| Nearby venues | `GET /api/venues` | `GET consumer-api.wolt.com/v1/pages/restaurants` (`sections[1].items`) |
| Search venues | `POST /api/search` `{q, target:"venues"}` | `POST restaurant-api.wolt.com/v1/pages/search` (`sections[0].items`) |
| Search items | `POST /api/search` `{q, target:"items"}` | same, each result's `menu_item` |
| Venue menu (`/venue/[slug]`) | `GET /api/venues/[slug]/menu` | `GET consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/{slug}/assortment`, falling back to `GET restaurant-api.wolt.com/v4/venues/slug/{slug}/menu/data` |
| Connect account (`/token`) | `GET` / `POST /api/token` | `POST authentication.wolt.com/v1/wauth2/access_token` |
| Send basket | `POST /api/basket` `{slug, lines}` | `GET consumer-api.wolt.com/order-xp/web/v1/pages/venue/slug/{slug}/static`, then `POST consumer-api.wolt.com/order-xp/v1/baskets` |
| Saved baskets | `GET /api/basket` | `GET consumer-api.wolt.com/order-xp/web/v1/pages/baskets`, `GET consumer-api.wolt.com/order-xp/v1/baskets/count` |

Basket request body (what wolt.com sends too):

```json
{
  "venue_id": "…",
  "currency": "RON",
  "items": [
    {
      "id": "…",
      "count": 2,
      "name": "Combo Dark 2xSmash",
      "price": 16100,
      "options": [{ "id": "<option group id>", "values": [{ "id": "…", "count": 1, "price": 50 }] }],
      "substitution_settings": { "is_allowed": true }
    }
  ]
}
```

## Code layout

- `src/lib/config.ts`: target market (Bucharest)
- `src/lib/wolt.ts`: server-only Wolt client (venues, search, menus, token refresh)
- `src/lib/session.ts`: server-side Wolt login (refresh, rotation, persistence)
- `src/lib/basket.ts`: builds, validates and saves the Wolt basket
- `src/lib/types.ts`: shared types
- `src/app/api/**`: route handlers that validate input and call the libs
- `src/app/page.tsx`, `src/app/venue/[slug]`, `src/app/token`: pages
- `src/components/`: venue menu + basket, option picker, raw JSON viewer

## Caveats

- Everything here is **unofficial and undocumented**. Endpoints and response
  shapes can change at any time, and automating your account may go against
  Wolt's terms of service.
- The doc's menu endpoint returns an empty body for anonymous callers, which is
  why menus use the assortment endpoint wolt.com itself uses.
- Prices are integers in minor units (`4500` = 45,00 lei).
- Checkout and payment are deliberately not implemented.

## Sources

- [OzTamir's unofficial Wolt API doc](https://gist.github.com/OzTamir/7ed2b49b8628d88c086d65b0d1730c36): venues, search, token refresh
- [NoaMcDa/KetoClub#186](https://github.com/NoaMcDa/KetoClub/pull/186): consumer-assortment menu endpoint
- [skorokithakis/woltapi](https://github.com/skorokithakis/woltapi): basket endpoints and payload shape
