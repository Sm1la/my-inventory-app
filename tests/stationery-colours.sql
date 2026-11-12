begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where lower(email)='sharmila@selangorproperties.com.my'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare item uuid; req uuid; other_req uuid; linked uuid; denied boolean; suffix text:=left(gen_random_uuid()::text,20);
begin
 insert into public.inventory_items(name,code,category,unit,opening_stock,minimum_stock,stationery_type,colour)
 values('Colour test paper '||suffix,'COLOUR-'||suffix,'Stationery','reams',10,0,'Paper','Green') returning id into item;
 if (select colour from public.inventory_balances where id=item)<>'Green' or (select balance from public.inventory_balances where id=item)<>10 then raise exception 'Item colour/view/balance not saved'; end if;
 insert into public.supply_requests(item_id,quantity,requestor,department,assigned_approver,requested_colour)
 values(item,2,'Colour integration test','Finance','Maznah','Blue') returning id into req;
 denied:=false; begin update public.supply_requests set requested_colour='Red' where id=req; exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Saved requested colour could be changed'; end if;
 perform public.record_supply_approvals(array[req],'Approved','Colour approval');
 perform public.resolve_supply_request(req,'Fulfilled');
 if (select balance from public.inventory_balances where id=item)<>8 or not exists(select 1 from public.stock_transactions where item_id=item and kind='issued' and notes like '%Requested colour: Blue.%') then raise exception 'Fulfilment lost colour or balance'; end if;
 insert into public.supply_requests(other_name,other_category,quantity,requestor,department,assigned_approver,requested_colour)
 values('Marker pen '||suffix,'Stationery',1,'Colour integration test','Finance','Ira','Purple') returning id into other_req;
 linked:=public.add_requested_inventory(other_req,jsonb_build_object('name','Marker colour test '||suffix,'code','MARK-'||suffix,'unit','pcs','opening_stock',0,'minimum_stock',1,'stationery_type','Marker pen','colour','Purple'));
 if (select colour from public.inventory_items where id=linked)<>'Purple' or (select requested_colour from public.supply_requests where id=other_req)<>'Purple' then raise exception 'Other conversion lost colour'; end if;
 denied:=false; begin insert into public.inventory_items(name,code,category,unit,colour) values('Invalid colour test','INVALID-'||suffix,'Pantry','pcs','Red'); exception when check_violation then denied:=true; end;
 if not denied then raise exception 'Pantry accepted stationery colour'; end if;
end $$;
select 'Colour persistence, immutable requests, fulfilment notes and Other conversion passed; rolled back' as result;
rollback;
