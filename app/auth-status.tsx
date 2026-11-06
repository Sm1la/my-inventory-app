"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthStatus() {
  const [email,setEmail] = useState<string | null>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  useEffect(() => {
    const query=new URLSearchParams(window.location.search), hash=new URLSearchParams(window.location.hash.slice(1));
    if (query.get("error") || query.get("error_code") || hash.get("error")) {
      window.location.replace("/login?error=confirmation-return");
      return;
    }
    const client=createClient();
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>setEmail(session?.user.email || null));
    return ()=>subscription.unsubscribe();
  },[]);
  async function signOut() {
    setBusy(true); setError("");
    try { const {error}=await createClient().auth.signOut(); if(error) throw error; window.location.assign("/login"); }
    catch { setError("Could not sign out. Please try again."); setBusy(false); }
  }
  return <div className="auth-status">{email ? <><span title={email}>{email}</span><button className="button" disabled={busy} onClick={()=>void signOut()}>{busy ? "Signing out…" : "Sign out"}</button></> : <Link className="button" href="/login">Sign in</Link>}{error && <span role="alert">{error}</span>}</div>;
}
