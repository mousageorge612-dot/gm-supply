# GM Supply

سوق مكملات رياضية لكل سوريا — https://supply.georgemousa.com  
لوحة الإدارة: /admin/ · لوحة التجار: /vendor/

- Static site (GitHub Pages), vanilla JS, no build.
- Backend: Supabase (same project as GM Coach). Tables `supply_products`, `supply_orders`, `supply_codes`, `supply_settings`; bucket `supply-media`.
- Orders are created by the `supply_place_order` RPC (prices + discount computed server-side), then the customer sends the order to WhatsApp.
- `?code=GM15` on the store URL pre-applies a discount code; `?p=<id>` opens a product.
- Vendors (`supply_vendors`) log in at /vendor/ as `<username>@vendors.georgemousa.com` (accounts created by the `supply-admin` edge function from the admin Vendors tab). A vendor insert/edit is forced hidden (`active=false`) by the `supply_products_guard` trigger until an admin approves it. All orders go to the admin WhatsApp; each order line carries its vendor.
- Products with `price_usd = 0` show "السعر عند الطلب" and an ask-on-WhatsApp button; they can't be ordered.
- `assets/p/` holds the initial catalog images; `assets/p/catalog-import.json` was the one-time import list.
