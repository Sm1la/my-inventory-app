"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth.module.css";

const DOMAIN_VERIFICATION_MESSAGE = "Kindly email your ID to sharmila@selangorproperties.com.my for verification";
const isCompanyEmail = (email: string) => /^[^@\s]+@selangorproperties\.com\.my$/i.test(email.trim());

type Mode = "login" | "signup" | "forgot" | "reset" | "verify";
export default function AuthForm({ mode }: { mode: Mode }) {
  const [showPassword,setShowPassword] = useState(false);
  const [busy,setBusy] = useState(false), [error,setError] = useState(""), [message,setMessage] = useState("");
  const [help,setHelp] = useState(false), [recoveryReady,setRecoveryReady] = useState(false);
  const lock = useRef(false);
  const hasPassword = mode === "login" || mode === "signup" || mode === "reset";
  useEffect(() => {
    const query=new URLSearchParams(window.location.search), hash=new URLSearchParams(window.location.hash.slice(1));
    if (query.get("error") === "invalid-link" || query.get("error_code") === "otp_expired" || hash.get("error_code") === "otp_expired") setError("This email link has expired or has already been used. Enter your email address to request a fresh link, then open only the newest email.");
    if (query.get("error") === "confirmation-return") setError("This email link has expired, was already used, or was opened in a different browser. If your email is already confirmed, sign in below. Otherwise, use Resend confirmation email.");
    if (mode === "reset") {
      const client = createClient();
      void client.auth.getUser().then(({data,error}) => {
        if (error || !data.user) setError("Open the password reset link from your email before setting a new password.");
        else setRecoveryReady(true);
      });
    }
  },[mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (mode === "signup" && !isCompanyEmail(email)) { setError(DOMAIN_VERIFICATION_MESSAGE); setMessage(""); return; }
    if ((mode === "signup" || mode === "reset") && password !== String(form.get("confirmPassword") || "")) { setError("The passwords do not match."); return; }
    lock.current=true; setBusy(true); setError(""); setMessage("");
    try {
      const client=createClient();
      if (mode === "login") {
        const {error} = await client.auth.signInWithPassword({email,password});
        if (error) throw new Error(error.code === "invalid_credentials" ? "The email address or password is incorrect." : error.code === "email_not_confirmed" ? "Your email address is not confirmed. Use Resend confirmation email below to get a fresh link." : error.message);
        window.location.assign("/");
      } else if (mode === "signup") {
        const {data,error} = await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin + "/auth/callback"}});
        if (error) throw error;
        if (data.session) window.location.assign("/");
        else setMessage("Check your email for an account confirmation link. Once confirmed, return here to sign in.");
      } else if (mode === "verify") {
        const {error}=await client.auth.resend({type:"signup",email,options:{emailRedirectTo:window.location.origin + "/auth/callback"}});
        if (error) throw error;
        setMessage("If this address has an unconfirmed account, a fresh confirmation email will arrive shortly. Open only the newest email. If your account is already confirmed, return to sign in.");
      } else if (mode === "forgot") {
        const {error} = await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin + "/auth/callback?next=/reset-password"});
        if (error) throw error;
        setMessage("If an account exists for this address, a password reset email will arrive shortly. Check your inbox and spam folder.");
      } else {
        const {data,error:sessionError} = await client.auth.getUser();
        if (sessionError || !data.user) throw new Error("Your reset session has expired. Request a new password reset email.");
        const {error} = await client.auth.updateUser({password}); if (error) throw error;
        await client.auth.signOut(); setRecoveryReady(false);
        setMessage("Your password has been updated. You can now sign in with your new password.");
      }
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to complete the request. Please try again."); }
    finally { setBusy(false); lock.current=false; }
  }

  return <div className={styles.page}><section className={styles.card} aria-labelledby="auth-title">
    <div className={styles.logo} role="img" aria-label="SPB — Selangor Properties"><svg viewBox="0 0 110 86" aria-hidden="true"><rect x="2" y="2" width="106" height="82" rx="25" fill="#df252f"/><rect x="10" y="10" width="90" height="66" rx="17" fill="none" stroke="white" strokeWidth="3"/><text x="55" y="64" textAnchor="middle" textLength="80" lengthAdjust="spacingAndGlyphs" fill="white" fontFamily="Arial Narrow,Arial,sans-serif" fontSize="62" fontWeight="700">SPB</text></svg></div>
    <h1 id="auth-title" className={styles.title}>{mode === "verify" ? "Resend confirmation email" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Forgot password?" : mode === "reset" ? "Set a new password" : "Office Inventory Management"}</h1>
    <p className={styles.company}>Selangor Properties Sdn. Bhd.</p>
    <p className={mode === "signup" ? `${styles.intro} ${styles.domainNotice}` : styles.intro}>{mode === "verify" ? "Enter your account email to receive a fresh confirmation link." : mode === "login" ? "Sign in to manage stationery and pantry supplies." : mode === "signup" ? "Register with your @selangorproperties.com.my work email." : mode === "forgot" ? "Enter your email address to receive a reset link." : "Choose a strong password for your account."}</p>
    {error && <div role="alert" className={styles.error}><span className={error === DOMAIN_VERIFICATION_MESSAGE ? styles.domainNotice : undefined}>{error}</span></div>}{message && <div role="status" className={styles.success}>{message}</div>}
    <form onSubmit={submit} className={styles.form}>
      {mode !== "reset" && <label className={styles.field}><span>Username</span><input type="email" name="email" autoComplete="username" placeholder={mode === "signup" ? "name@selangorproperties.com.my" : "Email address"} required maxLength={254} disabled={busy} onBlur={event => { if (mode === "signup" && event.target.value.trim() && !isCompanyEmail(event.target.value)) { setError(DOMAIN_VERIFICATION_MESSAGE); setMessage(""); } }} onChange={() => { if (error === DOMAIN_VERIFICATION_MESSAGE) setError(""); }}/></label>}
      {hasPassword && <label className={styles.field}><span>{mode === "reset" ? "New password" : "Password"}</span><div className={styles.password}><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 8} maxLength={128} disabled={busy}/><button type="button" aria-controls="password" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(v=>!v)}>{showPassword ? "Hide" : "Show"}</button></div></label>}
      {(mode === "signup" || mode === "reset") && <><label className={styles.field}><span>Confirm password</span><input type={showPassword ? "text" : "password"} name="confirmPassword" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy}/></label><p className={styles.hint}>Use at least 8 characters.</p></>}
      {mode === "login" && <Link className={styles.forgot} href="/forgot-password">Forgot password?</Link>}
      <button className={styles.submit} disabled={busy || (mode === "reset" && !recoveryReady)} type="submit">{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "verify" ? "Resend confirmation email" : "Update password"}</button>
    </form>
    <div className={styles.links}>{(mode === "login" || mode === "signup") && <Link className={styles.support} href="/verify-email">Resend confirmation email</Link>}{mode === "login" ? <Link className={styles.account} href="/signup">New user? Create an account</Link> : <Link className={styles.account} href="/login">Back to sign in</Link>}<button type="button" className={styles.support} onClick={()=>setHelp(v=>!v)} aria-expanded={help}>Need help? Contact IT Support</button>{help && <p className={styles.help}>Please contact your IT Department for account access, password assistance, or inventory support.</p>}</div>
    <p className={styles.footer}>© 2026 Selangor Properties Sdn. Bhd. · Developed by IT Department</p>
    <Link className={styles.demo} href="/">Open inventory demo →</Link>
  </section></div>;
}
