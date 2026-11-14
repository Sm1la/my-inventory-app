-- Migration allow_highlighter_stationery_type. Existing types remain valid.
alter table public.inventory_items drop constraint inventory_items_stationery_type_check;
alter table public.inventory_items add constraint inventory_items_stationery_type_check
 check(stationery_type in ('','Paper','Ball pen','Marker pen','Highlighter'));

-- The existing Highlighters item is classified as Highlighter without changing stock.
-- Request colour is saved in requested_colour and copied to issue notes by the existing workflow.
-- Supported choices: Yellow, Green, Pink, Lilac, Blue.
