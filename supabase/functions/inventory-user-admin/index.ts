import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { makeHandler } from "./handler.mjs";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
Deno.serve(makeHandler({
  userClient: (authorization: string) => createClient(url, anon, { ...options, global: { headers: { Authorization: authorization } } }),
  adminClient: () => createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, options),
}));
