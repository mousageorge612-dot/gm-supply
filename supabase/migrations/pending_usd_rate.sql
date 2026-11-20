-- NOT YET APPLIED (2026-11-20). Apply before deploying commit "Show prices in USD and SYP".
alter table fs_settings add column if not exists usd_rate numeric not null default 150 check (usd_rate > 0);
alter table fs_products add column if not exists price_usd numeric check (price_usd >= 0);
alter table fs_variants add column if not exists price_usd numeric check (price_usd >= 0);
alter table fs_orders add column if not exists usd_rate numeric;

create or replace function public.fs_price_from_usd() returns trigger language plpgsql security definer set search_path to '' as $$
declare r numeric := (select usd_rate from public.fs_settings where id = 1);
begin
  if new.price_usd is not null then new.price_syp := round(new.price_usd * r); end if;
  return new;
end $$;
drop trigger if exists fs_products_usd on fs_products;
create trigger fs_products_usd before insert or update of price_usd, price_syp on fs_products for each row execute function public.fs_price_from_usd();
drop trigger if exists fs_variants_usd on fs_variants;
create trigger fs_variants_usd before insert or update of price_usd, price_syp on fs_variants for each row execute function public.fs_price_from_usd();

create or replace function public.fs_rate_changed() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.usd_rate is distinct from old.usd_rate then
    update public.fs_products set price_syp = round(price_usd * new.usd_rate) where price_usd is not null;
    update public.fs_variants set price_syp = round(price_usd * new.usd_rate) where price_usd is not null;
  end if;
  return new;
end $$;
drop trigger if exists fs_settings_rate on fs_settings;
create trigger fs_settings_rate after update of usd_rate on fs_settings for each row execute function public.fs_rate_changed();

create or replace function public.fs_order_rate() returns trigger language plpgsql security definer set search_path to '' as $$
begin new.usd_rate := (select usd_rate from public.fs_settings where id = 1); return new; end $$;
drop trigger if exists fs_orders_rate on fs_orders;
create trigger fs_orders_rate before insert on fs_orders for each row execute function public.fs_order_rate();

-- tiny public RPC used by merchant/admin pages
create or replace function public.fs_rate() returns numeric language sql stable security definer set search_path to '' as $$ select usd_rate from public.fs_settings where id = 1 $$;
grant execute on function public.fs_rate() to anon, authenticated;

-- fs_catalog must also return 'usd_rate': add  'usd_rate', (select usd_rate from st),  to its jsonb_build_object.
