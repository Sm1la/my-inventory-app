import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const workspace = typeof window !== "undefined" ? window.localStorage.getItem("office-stock-workspace-v1") : null;
      if (workspace) headers.set("x-workspace-id", workspace);
      return fetch(input, { ...init, headers });
    } } },
  );
}
