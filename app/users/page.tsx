import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UserManagement from "./user-management";

export const metadata = { title: "User management | OfficeStock" };
export const dynamic = "force-dynamic";
export default async function UsersPage() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  if (user.email?.toLowerCase() !== "sharmila@selangorproperties.com.my") return <main><h1>Access restricted</h1><p>Only Sharmila can manage user accounts.</p><Link className="button" href="/">Back to inventory</Link></main>;
  const access = await client.rpc("inventory_user_admin_access");
  if (access.error || access.data !== true) return <main><h1>Administrator sign-in required</h1><p>Please sign in again to manage user accounts.</p><Link className="button" href="/login">Sign in</Link></main>;
  return <UserManagement/>;
}
