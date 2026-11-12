import type { User } from "@supabase/supabase-js";

// Display information only; inventory permissions continue to use verified roles.
export function accountRequestor(user: User | null): string | null {
  if (!user) return null;
  for (const name of [user.user_metadata?.full_name, user.user_metadata?.name, user.email]) {
    if (typeof name === "string" && name.trim()) return name.trim().slice(0, 120);
  }
  return user.id;
}
