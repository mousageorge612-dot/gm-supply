# سبلاي | Forma Supply

An Arabic-first, mobile-first, multi-vendor marketplace for sports equipment (and, after review, eligible supplements) in Syria.
Static front end (plain HTML/CSS/JS, no build step) served by GitHub Pages, with Supabase (Postgres, Auth, Storage, Edge Functions) as the backend.

## Views

| View | URL | Who |
|---|---|---|
| Storefront | `/` | Guests. Search, category, seller, city, availability and price filters. |
| Seller store | `/s/<slug>` | Guests. Public, shareable link per approved seller (served by `404.html`, a copy of `index.html`). |
| Order page | `/o/<number>?k=<token>` | The customer who placed the order. It reads the order back from the database. |
| Merchant dashboard | `/merchant/` | Merchant accounts. Each merchant sees only their own store, products and orders. |
| Support and admin | `/admin/` | `fs_staff` accounts. Support sees the help queue and orders. Admin sees everything. |

## Backend (Supabase project `lwnjdcwlxbanjbkmbvoc`, tables prefixed `fs_`)

- **Roles.** Merchant = `fs_sellers.owner_id`. Staff = `fs_staff.role` (`admin` or `support`). Guests have no table access. They use the RPCs `fs_catalog`, `fs_place_order` and `fs_order_public`.
- **Server rules.**
  - Row Level Security is on every table.
  - Guard triggers stop a merchant from changing their own approval status, supplement permission or moderation flags.
  - Support can only create drafts, or products waiting for the merchant's approval.
- **Orders.**
  - `fs_place_order` re-prices every item on the server, checks stock and decrements it.
  - It records the source (`seller_link` if the cart started on that seller's `/s/` link, otherwise `marketplace`) and the commission rate at checkout.
  - It is idempotent per `client_ref`, so a retried submit cannot create a second order.
- **Status flow.**
  - `new → confirmed → shipping → delivered`. A delivered order can become `returned`.
  - `cancelled` is allowed before delivery.
  - Delivery requires evidence (a text note or a private photo).
- **Commission.**
  - Rates default to 3% (seller link) and 7% (marketplace). They are editable in admin settings and apply to future orders only.
  - The commission is calculated on delivered merchandise after discounts, excluding shipping.
  - Each change is written to `fs_commission_entries`: `delivered`, then `return_adjustment` (partial return) or `full_return_reversal`.
  - Weekly statements come from `fs_statement` (merchant) and `fs_settlements_overview` (admin). The week starts on Monday, Asia/Damascus time.
- **Storage.**
  - `fs-media` is public and holds product images. Only the store owner or staff can write to `s<seller_id>/`.
  - `fs-private` is private and holds help-request uploads and delivery evidence. It is read through signed URLs.
- **Supplements.** Categories of kind `supplement` stay out of search and checkout unless all three conditions hold:
  - `fs_settings.supplements_enabled` is on.
  - The seller's `supplements_allowed` is on.
  - The product's `supplement_approved` is on.
- **Edge function `fs-auth`** (source in `supabase/functions/fs-auth/`):
  - `register` (public merchant sign-up, which creates a pending store).
  - `create_staff`, `create_merchant_login` and `reset_password` (admin only).
  - Logins are usernames. Internal email addresses are never mailed.

## Brand

- The logo is `assets/brand/forma-supply-logo.png`, used as supplied. `forma-supply-logo-900.png` is the same image scaled for the web.
- The app icon is `Forma-Supply-Avatar.png`, which produces `icon-192.png`, `icon-512.png` and `apple-touch-icon.png`. The favicon is `/favicon.ico`.
- Fonts are Cairo (400, 600, 700) and Inter (400, 500, 700), self-hosted from the OFL builds on fontsource.

## Demo data

- **Demo stores.** `demo-quwwa` (Damascus) and `demo-homs` (Homs). Both are marked as demo, and their products and prices are fictional.
- **Supplement drafts.** Creatine, whey and omega-3 are unpublished drafts in `demo-quwwa`.
- **Scoop House.** The real merchant "Scoop House Gym || Supplements" (`scoop-house`) holds the 287 products imported from the earlier catalogue. They are drafts without prices, and the store is pending until the admin approves it and creates its login.
