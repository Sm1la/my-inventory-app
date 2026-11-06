-- Applied through Supabase migrations. Browser demo workspaces are capability-scoped.
create function public.demo_workspace_id() returns uuid language sql stable security invoker set search_path = '' as $$
 select nullif(current_setting('request.headers', true)::json ->> 'x-workspace-id', '')::uuid
$$;

create table public.inventory_workspaces (
 id uuid primary key default public.demo_workspace_id(), created_at timestamptz not null default now()
);
create table public.inventory_items (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null default public.demo_workspace_id() references public.inventory_workspaces(id),
 name text not null check(length(trim(name)) between 1 and 120), code text not null check(length(trim(code)) between 1 and 40),
 category text not null check(category in ('Stationery','Pantry')), unit text not null default 'pcs',
 opening_stock integer not null default 0 check(opening_stock >= 0), minimum_stock integer not null default 5 check(minimum_stock >= 0),
 supplier text not null default '', unit_price numeric(12,2) not null default 0 check(unit_price >= 0),
 location text not null default '', expiry_date date, created_at timestamptz not null default now(),
 unique(workspace_id,code), unique(id,workspace_id)
);
create table public.stock_transactions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null default public.demo_workspace_id(),
 item_id uuid not null, kind text not null check(kind in ('received','issued')), quantity integer not null check(quantity > 0),
 requestor text not null default '', department text not null default '', notes text not null default '',
 transaction_date date not null default current_date, created_at timestamptz not null default now(),
 foreign key(item_id,workspace_id) references public.inventory_items(id,workspace_id) on delete cascade
);
create table public.supply_requests (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null default public.demo_workspace_id(), item_id uuid not null,
 quantity integer not null check(quantity > 0), requestor text not null check(length(trim(requestor)) between 1 and 120),
 department text not null check(length(trim(department)) between 1 and 120), notes text not null default '',
 status text not null default 'Pending' check(status in ('Pending','Fulfilled','Rejected')),
 created_at timestamptz not null default now(), resolved_at timestamptz,
 foreign key(item_id,workspace_id) references public.inventory_items(id,workspace_id) on delete cascade
);
create index inventory_items_workspace_idx on public.inventory_items(workspace_id);
create index stock_transactions_item_idx on public.stock_transactions(item_id);
create index stock_transactions_workspace_idx on public.stock_transactions(workspace_id);
create index supply_requests_item_idx on public.supply_requests(item_id);
create index supply_requests_workspace_idx on public.supply_requests(workspace_id);

alter table public.inventory_workspaces enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_transactions enable row level security;
alter table public.supply_requests enable row level security;
create policy workspace_isolation on public.inventory_workspaces for all to anon, authenticated using(id = (select public.demo_workspace_id())) with check(id = (select public.demo_workspace_id()));
create policy workspace_isolation on public.inventory_items for all to anon, authenticated using(workspace_id = (select public.demo_workspace_id())) with check(workspace_id = (select public.demo_workspace_id()));
create policy workspace_isolation on public.stock_transactions for all to anon, authenticated using(workspace_id = (select public.demo_workspace_id())) with check(workspace_id = (select public.demo_workspace_id()));
create policy workspace_isolation on public.supply_requests for all to anon, authenticated using(workspace_id = (select public.demo_workspace_id())) with check(workspace_id = (select public.demo_workspace_id()));
revoke all on public.inventory_workspaces, public.inventory_items, public.stock_transactions, public.supply_requests from anon, authenticated;
grant select, insert on public.inventory_workspaces to anon, authenticated;
grant select, insert, update, delete on public.inventory_items to anon, authenticated;
grant select, insert on public.stock_transactions to anon, authenticated;
grant select, insert, update, delete on public.supply_requests to anon, authenticated;

create view public.inventory_balances with (security_invoker = true) as
 select i.*, coalesce(t.received,0)::integer as received, coalesce(t.issued,0)::integer as issued,
 (i.opening_stock + coalesce(t.received,0) - coalesce(t.issued,0))::integer as balance
 from public.inventory_items i left join (
 select item_id, sum(quantity) filter(where kind='received') as received, sum(quantity) filter(where kind='issued') as issued
 from public.stock_transactions group by item_id
 ) t on t.item_id=i.id;
grant select on public.inventory_balances to anon, authenticated;

create function public.validate_stock_movement() returns trigger language plpgsql security invoker set search_path = '' as $$
declare available integer; opening integer;
begin
 select opening_stock into opening from public.inventory_items where id=new.item_id and workspace_id=new.workspace_id for update;
 if not found then raise exception 'Item not found in this workspace'; end if;
 select opening + coalesce(sum(case when kind='received' then quantity else -quantity end),0) into available
 from public.stock_transactions where item_id=new.item_id;
 if new.kind='issued' and new.quantity>available then raise exception 'Not enough stock. Available: %', available; end if;
 return new;
end $$;
create trigger validate_stock before insert on public.stock_transactions for each row execute function public.validate_stock_movement();
create function public.protect_opening_stock() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.opening_stock <> old.opening_stock and exists(select 1 from public.stock_transactions where item_id=old.id) then
 raise exception 'Opening stock cannot change after movements. Record a receipt or issue instead.'; end if;
 if new.workspace_id <> old.workspace_id then raise exception 'Workspace cannot change'; end if;
 return new;
end $$;
create trigger protect_opening before update on public.inventory_items for each row execute function public.protect_opening_stock();

create function public.resolve_supply_request(request_id uuid, decision text) returns void language plpgsql security invoker set search_path = '' as $$
declare r public.supply_requests;
begin
 if decision not in ('Fulfilled','Rejected') then raise exception 'Invalid decision'; end if;
 select * into r from public.supply_requests where id=request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status <> 'Pending' then raise exception 'Request has already been resolved'; end if;
 if decision='Fulfilled' then
 insert into public.stock_transactions(item_id,kind,quantity,requestor,department,notes)
 values(r.item_id,'issued',r.quantity,r.requestor,r.department,'Supply request: ' || r.notes);
 end if;
 update public.supply_requests set status=decision,resolved_at=now() where id=r.id;
end $$;

create function public.initialize_inventory_demo() returns void language plpgsql security invoker set search_path = '' as $$
declare w uuid := public.demo_workspace_id();
begin
 if w is null then raise exception 'Workspace header required'; end if;
 perform pg_advisory_xact_lock(hashtext(w::text));
 if exists(select 1 from public.inventory_workspaces where id=w) then return; end if;
 insert into public.inventory_workspaces(id) values(w);
 insert into public.inventory_items(name,code,category,unit,opening_stock,minimum_stock,supplier,unit_price,location,expiry_date) values
 ('A4 multipurpose paper','ST-001','Stationery','reams',24,10,'Demo Office Supplies',15.50,'Cabinet A',null),
 ('Blue ballpoint pens','ST-002','Stationery','pcs',8,15,'Demo Office Supplies',1.80,'Cabinet A',null),
 ('Sticky notes','ST-003','Stationery','pads',32,10,'Demo Office Supplies',3.50,'Cabinet B',null),
 ('Instant coffee','PN-001','Pantry','jars',4,6,'Demo Pantry Supplier',22.90,'Pantry shelf 1',current_date+90),
 ('Tea bags','PN-002','Pantry','boxes',16,5,'Demo Pantry Supplier',12.00,'Pantry shelf 1',current_date+180),
 ('Cream crackers','PN-003','Pantry','packs',3,8,'Demo Pantry Supplier',5.20,'Pantry shelf 2',current_date+14);
end $$;
revoke execute on function public.demo_workspace_id(), public.validate_stock_movement(), public.protect_opening_stock(), public.resolve_supply_request(uuid,text), public.initialize_inventory_demo() from public;
grant execute on function public.demo_workspace_id(), public.validate_stock_movement(), public.protect_opening_stock(), public.resolve_supply_request(uuid,text), public.initialize_inventory_demo() to anon, authenticated;
