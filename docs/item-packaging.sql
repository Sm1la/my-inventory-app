-- Add optional descriptive fields without changing existing stock or units.
alter table public.inventory_items
 add column brand text not null default '' check(length(brand)<=120),
 add column weight text check(weight is null or length(weight)<=60),
 add column units_per_box integer check(units_per_box is null or units_per_box between 1 and 10000000);

-- Preserve existing view column order; append the new fields.
create or replace view public.inventory_balances with (security_invoker=true) as
 select i.id,i.workspace_id,i.name,i.code,i.category,i.unit,i.opening_stock,i.minimum_stock,i.supplier,i.unit_price,i.location,i.expiry_date,i.created_at,
 coalesce(t.received,0)::integer as received,coalesce(t.issued,0)::integer as issued,
 (i.opening_stock+coalesce(t.received,0)-coalesce(t.issued,0))::integer as balance,
 i.brand,i.weight,i.units_per_box
 from public.inventory_items i left join (
 select item_id,sum(quantity) filter(where kind='received') as received,sum(quantity) filter(where kind='issued') as issued
 from public.stock_transactions group by item_id
 ) t on t.item_id=i.id;
