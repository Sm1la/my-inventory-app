"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Account = { id:string; email:string; name:string; created_at:string; last_sign_in_at:string|null; owner:boolean };
type Edit = { mode:"create" } | { mode:"edit"|"delete"; user:Account } | null;
const formatDate = (value:string|null) => value ? new Date(value).toLocaleDateString("en-MY",{timeZone:"Asia/Kuala_Lumpur"}) : "Never";

export default function UserManagement() {
  const [users,setUsers]=useState<Account[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[edit,setEdit]=useState<Edit>(null),[showPassword,setShowPassword]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),locked=useRef(false);
  const invoke=useCallback(async(body:Record<string,unknown>)=>{
    const result=await createClient().functions.invoke("inventory-user-admin",{body});
    if(result.error) {
      let message="Unable to manage accounts. Please sign in again and retry.";
      if(result.error.context instanceof Response) { const details=await result.error.context.json().catch(()=>null); if(typeof details?.error==="string") message=details.error; }
      throw new Error(message);
    }
    if(result.data?.error) throw new Error(result.data.error);
    return result.data;
  },[]);
  const refresh=useCallback(async()=>{
    setLoading(true);
    try {const data=await invoke({action:"list"});setUsers(data.users);}
    catch(e){setError(e instanceof Error?e.message:"Unable to load users.");}
    finally{setLoading(false);}
  },[invoke]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{if(edit&&!dialog.current?.open)dialog.current?.showModal();if(!edit&&dialog.current?.open)dialog.current?.close();},[edit]);
  function open(next:Edit){setError("");setNotice("");setShowPassword(false);setEdit(next);}
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!edit||locked.current)return;
    const data=new FormData(event.currentTarget),text=(key:string)=>String(data.get(key)??"");
    const password=text("password");
    if(edit.mode!=="delete"&&password!==text("confirm_password")){setError("The passwords do not match.");return;}
    const body:Record<string,unknown>=edit.mode==="delete"?{action:"delete",id:edit.user.id}:{action:edit.mode==="create"?"create":"update",name:text("name").trim(),email:text("email").trim(),password};
    if(edit.mode==="edit")body.id=edit.user.id;
    locked.current=true;setBusy(true);setError("");
    try {const result=await invoke(body);setEdit(null);setNotice(result.message);await refresh();}
    catch(e){setError(e instanceof Error?e.message:"Unable to save account.");}
    finally{locked.current=false;setBusy(false);}
  }
  return <main className="user-management"><Link className="button" href="/">← Back to inventory</Link><div className="page-heading"><div><p className="eyebrow">SPB · ADMINISTRATION</p><h1>User management</h1><p className="subtitle">Only sharmila@selangorproperties.com.my can create, edit or delete accounts.</p></div><div className="heading-actions"><button className="button" disabled={loading||busy} onClick={()=>{setError("");void refresh();}}>Refresh</button><button className="button primary" disabled={busy} onClick={()=>open({mode:"create"})}>＋ Create user</button></div></div>
    <p className="user-help">User ID is the work email address. New accounts open the same saved inventory. Passwords are never displayed; enter a new password to replace one.</p>
    {!edit&&error&&<div role="alert" className="alert error">{error}</div>}{notice&&<div role="status" className="alert success">{notice}</div>}
    <section className="panel"><div className="panel-title"><h2>Staff accounts</h2><span>{loading?"Loading…":`${users.length} accounts`}</span></div><div className="table-wrap"><table aria-label="Staff user accounts"><thead><tr><th>Name</th><th>User ID / email</th><th>Last sign-in</th><th>Actions</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><strong>{user.name||"Not set"}</strong>{user.owner&&<small>Administrator · Protected account</small>}</td><td>{user.email}</td><td>{formatDate(user.last_sign_in_at)}</td><td><div className="row-actions"><button disabled={busy||user.owner} onClick={()=>open({mode:"edit",user})}>Edit</button><button disabled={busy||user.owner} onClick={()=>open({mode:"delete",user})}>Delete</button></div></td></tr>)}</tbody></table></div>{!loading&&!users.length&&<div className="empty">No staff accounts found.</div>}</section>
    <dialog ref={dialog} onCancel={event=>{if(busy)event.preventDefault();else setEdit(null);}} onClose={()=>setEdit(null)}><form key={edit?.mode+((edit&&"user"in edit)?edit.user.id:"")} onSubmit={event=>void submit(event)}><div className="dialog-heading"><h2>{edit?.mode==="delete"?"Delete user account":edit?.mode==="edit"?"Edit user account":"Create user account"}</h2><button type="button" className="close" disabled={busy} aria-label="Close dialog" onClick={()=>setEdit(null)}>×</button></div>{error&&<div className="alert error" role="alert">{error}</div>}
    {edit?.mode==="delete"?<div className="delete-confirm"><p>Delete the login for <strong>{edit.user.email}</strong>?</p><p>The user will lose access. Saved inventory and transaction history will remain.</p></div>:<fieldset disabled={busy} className="request-fields"><div className="form-grid"><label className="field full"><span>Full name *</span><input name="name" required maxLength={120} autoComplete="off" defaultValue={edit?.mode==="edit"?edit.user.name:""}/></label><label className="field full"><span>User ID / work email *</span><input name="email" type="email" required maxLength={254} pattern="[^@\s]+@selangorproperties\.com\.my" autoComplete="off" placeholder="name@selangorproperties.com.my" defaultValue={edit?.mode==="edit"?edit.user.email:""}/></label><label className="field"><span>{edit?.mode==="edit"?"New password (optional)":"Password *"}</span><input name="password" type={showPassword?"text":"password"} required={edit?.mode==="create"} minLength={8} maxLength={128} autoComplete="new-password" placeholder={edit?.mode==="edit"?"Leave blank to keep password":"At least 8 characters"}/></label><label className="field"><span>Confirm password{edit?.mode==="create"?" *":""}</span><input name="confirm_password" type={showPassword?"text":"password"} required={edit?.mode==="create"} minLength={8} maxLength={128} autoComplete="new-password"/></label><label className="user-show-password full"><input type="checkbox" checked={showPassword} onChange={event=>setShowPassword(event.target.checked)}/> Show password</label><p className="form-help">Use 8–128 characters. New accounts are ready to sign in; no email is sent. Changing an email or password signs the user out.</p></div></fieldset>}
    <div className="dialog-footer"><button className="button" type="button" disabled={busy} onClick={()=>setEdit(null)}>Cancel</button><button className={edit?.mode==="delete"?"button danger":"button primary"} disabled={busy} type="submit">{busy?"Saving…":edit?.mode==="delete"?"Delete account":edit?.mode==="edit"?"Save changes":"Create account"}</button></div></form></dialog>
  </main>;
}
