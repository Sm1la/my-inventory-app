export const OWNER = "sharmila@selangorproperties.com.my";
const companyEmail = email => typeof email === "string" && /^[^@\s]+@selangorproperties\.com\.my$/i.test(email) && email.length <= 254;
const allowedOrigins = new Set(["https://my-inventory-app-smoky-three.vercel.app", "https://my-inventory-app-spb16.vercel.app", "http://localhost:3000"]);
const publicUser = user => ({ id:user.id,email:user.email,name:typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "",created_at:user.created_at,last_sign_in_at:user.last_sign_in_at,owner:user.email?.toLowerCase()===OWNER });

export function makeHandler({ userClient, adminClient }) {
  return async request => {
    const origin = request.headers.get("origin");
    const headers = { "Content-Type":"application/json", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff", "Vary":"Origin" };
    if (origin && allowedOrigins.has(origin)) Object.assign(headers,{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, x-workspace-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version","Access-Control-Allow-Methods":"POST, OPTIONS"});
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if (origin && !allowedOrigins.has(origin)) return reply({error:"Origin not allowed"},403);
    if (request.method==="OPTIONS") return new Response(null,{status:204,headers});
    if (request.method!=="POST") return reply({error:"Use POST"},405);
    const authorization=request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return reply({error:"Sign in required"},401);
    try {
      // Validate with Auth and a live-session database check before service access.
      const client=userClient(authorization);
      const {data,error}=await client.auth.getUser();
      const actor=data?.user;
      if(error || !actor || actor.is_anonymous || !actor.email_confirmed_at) return reply({error:"Sign in required"},401);
      if(actor.email?.toLowerCase()!==OWNER) return reply({error:"Only Sharmila can manage user accounts"},403);
      const access=await client.rpc("inventory_user_admin_access");
      if(access.error || access.data!==true) return reply({error:"Administrator session expired. Sign in again."},403);
      if(Number(request.headers.get("content-length") ?? 0)>12000) return reply({error:"Request too large"},413);
      const raw=await request.text();
      if(raw.length>12000) return reply({error:"Request too large"},413);
      let input; try {input=JSON.parse(raw);} catch {return reply({error:"Invalid request"},400);}
      if(!input || typeof input!=="object" || Array.isArray(input)) return reply({error:"Invalid request"},400);
      const admin=adminClient();
      const fail=result=>{if(result.error) throw new Error(result.error.message);return result.data;};
      if(input.action==="list") {
        const users=[];
        for(let page=1;page<=100;page++) {
          const result=fail(await admin.auth.admin.listUsers({page,perPage:200}));
          users.push(...result.users.filter(u=>companyEmail(u.email) && !u.deleted_at).map(publicUser));
          if(result.users.length<200) return reply({users:users.sort((a,b)=>a.email.localeCompare(b.email))});
        }
        return reply({error:"User list is too large. Contact support."},400);
      }
      if(!["create","update","delete"].includes(input.action)) return reply({error:"Unknown action"},400);
      const email=typeof input.email==="string" ? input.email.trim().toLowerCase() : "";
      const name=typeof input.name==="string" ? input.name.trim() : "";
      const password=typeof input.password==="string" ? input.password : "";
      if(input.action!=="delete") {
        if(!companyEmail(email)) return reply({error:"Use an @selangorproperties.com.my email address"},400);
        if(!name || name.length>120) return reply({error:"Enter a name of 1–120 characters"},400);
        if((input.action==="create" || password) && (password.length<12 || password.length>128)) return reply({error:"Use a password of 12–128 characters"},400);
      }
      if(input.action==="create") {
        const result=fail(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name},app_metadata:{inventory_created_by:actor.id}}));
        return reply({user:publicUser(result.user),message:"Account created. The user can sign in with this email and password."});
      }
      if(typeof input.id!=="string" || !/^[0-9a-f-]{36}$/i.test(input.id)) return reply({error:"Choose an existing account"},400);
      const target=fail(await admin.auth.admin.getUserById(input.id)).user;
      if(!target || target.deleted_at || !companyEmail(target.email)) return reply({error:"Account not found"},404);
      if(target.id===actor.id || target.email.toLowerCase()===OWNER) return reply({error:"The administrator account is protected. Use Forgot password for your own password."},400);
      if(input.action==="delete") {
        fail(await admin.rpc("inventory_admin_revoke_sessions",{actor_id:actor.id,target_id:target.id}));
        fail(await admin.auth.admin.updateUserById(target.id,{ban_duration:"876000h"}));
        // Soft deletion removes login access without purging historical inventory.
        fail(await admin.auth.admin.deleteUser(target.id,true));
        return reply({message:"Account deleted. Inventory history is retained."});
      }
      if(password || email!==target.email.toLowerCase()) fail(await admin.rpc("inventory_admin_revoke_sessions",{actor_id:actor.id,target_id:target.id}));
      const attributes={email,email_confirm:true,user_metadata:{...target.user_metadata,full_name:name}};
      if(password) attributes.password=password;
      const result=fail(await admin.auth.admin.updateUserById(target.id,attributes));
      return reply({user:publicUser(result.user),message:"Account updated."});
    } catch(error) {
      // Never log request bodies, credentials, tokens or full Auth records.
      const message=error instanceof Error ? error.message : "Unable to manage accounts";
      return reply({error:message},400);
    }
  };
}
