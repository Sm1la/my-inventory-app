import assert from 'node:assert/strict';
import {makeHandler,OWNER} from '../supabase/functions/inventory-user-admin/handler.mjs';
const actor={id:'11111111-1111-4111-8111-111111111111',email:OWNER,email_confirmed_at:'2026-01-01'};
const target={id:'22222222-2222-4222-8222-222222222222',email:'staff@selangorproperties.com.my',user_metadata:{full_name:'Staff',retained:'yes'}};
function fixture(user=actor,access=true){const calls=[];const admin={auth:{admin:{listUsers:async()=>({data:{users:[actor,target,{...target,email:'external@example.com'}]}}),createUser:async attrs=>{calls.push(['create',attrs]);return {data:{user:{...target,...attrs}}};},getUserById:async id=>({data:{user:id===actor.id?actor:target}}),updateUserById:async(id,attrs)=>{calls.push(['update',attrs]);return {data:{user:{...target,...attrs}}};},deleteUser:async(id,soft)=>{calls.push(['delete',soft]);return {data:{}};}}},rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data:null};}};return {calls,handler:makeHandler({userClient:()=>({auth:{getUser:async()=>({data:{user}})},rpc:async()=>({data:access})}),adminClient:()=>admin})};}
async function send(f,body,headers={}){return f.handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer mock-test-token','content-type':'application/json',...headers},body:JSON.stringify(body)}));}
let f=fixture({...actor,email:'nazira@selangorproperties.com.my'});assert.equal((await send(f,{action:'list'})).status,403);assert.equal(f.calls.length,0);
f=fixture(null);assert.equal((await send(f,{action:'list'})).status,401);
f=fixture(actor,false);assert.equal((await send(f,{action:'list'})).status,403);
f=fixture({...actor,is_anonymous:true});assert.equal((await send(f,{action:'list'})).status,401);
f=fixture();let response=await send(f,{action:'list'});assert.equal((await response.json()).users.length,2);assert.equal(response.headers.get('cache-control'),'no-store');
assert.equal((await send(f,{action:'list'},{origin:'https://untrusted.example'})).status,403);
assert.equal((await send(f,{action:'create',name:'Test',email:'bad@example.com',password:'mock-password-long'})).status,400);
assert.equal((await send(f,{action:'create',name:'Test',email:target.email,password:'short'})).status,400);
response=await send(f,{action:'create',name:'Test Staff',email:'STAFF@selangorproperties.com.my',password:'mock-password-long'});assert.equal(response.status,200);let created=f.calls.find(c=>c[0]==='create')[1];assert.equal(created.app_metadata.inventory_created_by,actor.id);assert.equal(created.email,target.email);assert.equal(created.email_confirm,true);assert.equal((await response.json()).user.password,undefined);
f=fixture();response=await send(f,{action:'update',id:target.id,email:target.email,name:'New name',password:'mock-password-long'});assert.equal(response.status,200);assert.equal(f.calls[0][0],'rpc');assert.equal(f.calls[1][1].user_metadata.retained,'yes');
f=fixture();assert.equal((await send(f,{action:'delete',id:actor.id})).status,400);assert.equal(f.calls.length,0);
assert.equal((await send(f,{action:'delete',id:target.id})).status,200);assert.deepEqual(f.calls.map(c=>c[0]),['rpc','update','delete']);assert.equal(f.calls[2][1],true);
console.log('User management authentication, validation, CRUD, session revocation and owner protection checks passed');
