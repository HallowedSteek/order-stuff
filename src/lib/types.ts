// Types based on the unofficial Wolt API doc:
// https://gist.github.com/OzTamir/7ed2b49b8628d88c086d65b0d1730c36
// Only the fields this POC uses are required; the rest are optional/loose.

export interface Image {
  url: string;
  blurhash?: string | null;
}

export interface VenueRating {
  rating: number;
  score: number;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  delivers?: boolean;
  delivery_price_int?: number | null;
  estimate?: number;
  estimate_range?: string;
  online?: boolean;
  price_range?: number;
  rating?: VenueRating | null;
  short_description?: string | null;
  tags?: string[];
}

export interface OverlayV2 {
  primary_text: string;
  secondary_text?: string | null;
  variant?: string;
}

/** An item in `sections[1].items` of /v1/pages/restaurants. */
export interface VenueData {
  title?: string;
  image?: Image;
  venue: Venue;
  overlay?: string | null;
  overlay_v2?: OverlayV2 | null;
}

export interface MenuItemOption {
  id: string;
  name: string;
  minimum_total_selections?: number;
  maximum_total_selections?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  /** Integer price, assumed to be in minor units (e.g. 4500 = 45.00). Unconfirmed by the doc. */
  baseprice: number;
  category?: string;
  enabled?: boolean;
  images?: Image[];
  options?: MenuItemOption[];
}

export interface ItemSearchResult {
  id: string;
  name: string;
  price: number;
  currency?: string;
  image?: Image | null;
  is_available?: boolean;
  venue_id?: string;
  venue_name?: string;
  venue_rating?: VenueRating;
  estimate_range?: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  country_code_alpha2?: string;
  country_code_alpha3?: string;
  timezone?: string;
  /** GeoJSON-ish point; coordinates are [lon, lat]. */
  location?: { type?: string; coordinates: [number, number] };
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}
