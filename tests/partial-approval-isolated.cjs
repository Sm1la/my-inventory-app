// In-memory PostgreSQL only. This harness has no production URL or credentials.
const fs=require('fs'),assert=require('node:assert/strict');
let PGlite;try{({PGlite}=require('@electric-sql/pglite'));}catch{({PGlite}=require('../node_modules/.partial-approval-test/package/dist/index.cjs'));}
(async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;
 create function public.inventory_access() returns text language sql as $$select case when current_setting('test.manager',true)='yes' then 'Mila' else null end$$;
 create table inventory_items(id uuid primary key default gen_random_uuid(),workspace_id uuid default '00000000-0000-0000-0000-000000000001',category text default 'Stationery',opening_stock integer default 20);
 create table supply_requests(id uuid primary key default gen_random_uuid(),workspace_id uuid default '00000000-0000-0000-0000-000000000001',item_id uuid,quantity integer not null check(quantity>0),requestor text default 'Local test',department text default 'Finance',notes text default '',other_name text,other_brand text default '',other_category text,requested_colour text default '',status text default 'Pending',assigned_approver text default 'Mila',decided_by text,decided_at timestamptz,resolved_at timestamptz,approval_note text not null default '');
 create table stock_transactions(id uuid primary key default gen_random_uuid(),item_id uuid,kind text,quantity integer check(quantity>0),requestor text,department text,notes text);
 create function stock_guard() returns trigger language plpgsql set search_path=public as $$begin if new.kind='issued' and new.quantity>(select i.opening_stock-coalesce((select sum(quantity) from stock_transactions where item_id=new.item_id and kind='issued'),0) from inventory_items i where id=new.item_id) then raise exception 'Insufficient stock';end if;return new;end$$;
 create trigger stock_guard before insert on stock_transactions for each row execute function stock_guard();
 insert into supply_requests(quantity,status) values(7,'Approved'),(3,'Fulfilled'),(2,'Rejected'),(4,'Pending');`);
 await db.exec(fs.readFileSync('docs/partial-approval.sql','utf8'));
 assert.deepEqual((await db.query('select quantity,status,approved_quantity from supply_requests order by quantity')).rows,[{quantity:2,status:'Rejected',approved_quantity:0},{quantity:3,status:'Fulfilled',approved_quantity:3},{quantity:4,status:'Pending',approved_quantity:null},{quantity:7,status:'Approved',approved_quantity:7}]);
 await db.exec('create trigger enforce_supply_approval before insert or update on supply_requests for each row execute function public.enforce_supply_approval();');
 const item=(await db.query('insert into inventory_items default values returning id')).rows[0].id;
 const request=async quantity=>(await db.query('insert into supply_requests(item_id,quantity) values($1,$2) returning id',[item,quantity])).rows[0].id;
 const a=await request(10),b=await request(4),c=await request(3);
 const decide=(rows,note='')=>db.query('select public.record_supply_approval_quantities($1::jsonb,$2)',[JSON.stringify(rows.map(([request_id,approved_quantity])=>({request_id,approved_quantity}))),note]);
 await assert.rejects(()=>decide([[a,5]],'Reason'),/Only Maznah/);
 await db.exec("set test.manager='yes'");
 await assert.rejects(()=>decide([[a,5]]),/reason/);
 await assert.rejects(()=>decide([[a,5],[b,5]],'Reason'),/exceed/);
 assert.equal((await db.query("select count(*)::integer n from supply_requests where id=any($1::uuid[]) and status='Pending'",[[a,b]])).rows[0].n,2);
 for(const quantity of [-1,1.5,null])await assert.rejects(()=>decide([[a,quantity]],'Reason'));
 await assert.rejects(()=>decide([[a,1],[a,1]],'Reason'),/Duplicate/);
 await decide([[a,5],[b,0],[c,3]],'Limited allocation');
 assert.deepEqual((await db.query('select quantity,approved_quantity,status from supply_requests where id=$1',[a])).rows[0],{quantity:10,approved_quantity:5,status:'Approved'});
 assert.deepEqual((await db.query('select approved_quantity,status from supply_requests where id=$1',[b])).rows[0],{approved_quantity:0,status:'Rejected'});
 assert.equal((await db.query('select count(*)::integer n from stock_transactions')).rows[0].n,0);
 await assert.rejects(()=>db.query('update supply_requests set approved_quantity=6 where id=$1',[a]),/cannot change/);
 await db.query("update supply_requests set status='Fulfilled' where id=$1",[a]);
 assert.equal((await db.query("select sum(quantity)::integer n from stock_transactions where item_id=$1",[item])).rows[0].n,5);
 await db.query("update supply_requests set status='Fulfilled' where id=$1",[c]);
 assert.equal((await db.query("select sum(quantity)::integer n from stock_transactions where item_id=$1",[item])).rows[0].n,8);
 const legacySQL=fs.readFileSync('docs/batch-approvals.sql','utf8');await db.exec(legacySQL.slice(legacySQL.indexOf('create or replace function public.record_supply_approvals')));
 const legacy=await request(2);await db.query("select public.record_supply_approvals($1::uuid[],'Approved','')",[[legacy]]);
 assert.equal((await db.query('select approved_quantity from supply_requests where id=$1',[legacy])).rows[0].approved_quantity,2);
 const shortage=await request(20);await decide([[shortage,20]],'Restocking');await assert.rejects(()=>db.query("update supply_requests set status='Fulfilled' where id=$1",[shortage]),/Insufficient stock/);
 assert.equal((await db.query("select sum(quantity)::integer n from stock_transactions where item_id=$1",[item])).rows[0].n,8);
 console.log('Isolated PostgreSQL: partial quantities, mixed rejection, atomic failure, immutable decisions, approved-only stock issue, shortage guard and legacy approvals passed.');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
