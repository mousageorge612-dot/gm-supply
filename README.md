# GM Supply

متجر مكملات GM Supply — https://supply.georgemousa.com  
لوحة التحكم: https://supply.georgemousa.com/admin/ (حساب المدرب نفسه تبع GM Coach)

- Static site (GitHub Pages), vanilla JS, no build.
- Backend: Supabase (same project as GM Coach). Tables `supply_products`, `supply_orders`, `supply_codes`, `supply_settings`; bucket `supply-media`.
- Orders are created by the `supply_place_order` RPC (prices + discount computed server-side), then the customer sends the order to WhatsApp.
- `?code=GM15` on the store URL pre-applies a discount code; `?p=<id>` opens a product.
