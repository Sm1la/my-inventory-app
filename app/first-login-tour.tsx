"use client";
import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';

const VERSION='office-stock-v1';
const steps=[
 {title:'Welcome to OfficeStock',icon:'▦',intro:'Your stationery and pantry supplies, in one place.',points:['Browse what is available, request several items together and follow their progress.','This quick demo explains the steps. It will not create requests or change stock.']},
 {title:'Find what you need',icon:'⌕',intro:'Start with Inventory.',points:['Click Inventory to reveal Stationery and Pantry. Choose a category or search by item name, brand or code.','Check the available balance and click an item photo for a closer look.']},
 {title:'Request supplies in one go',icon:'☷',intro:'Open Requests → New request.',points:['Tick the items or sizes you need and enter a quantity for each. Choose colours where available.','Your login fills the requester. Select your department and approver once, add any notes, then submit.','Use Other for an item that is not listed, or Rubber stamp for a custom stamp.']},
 {title:'Follow your request',icon:'◎',intro:'Open My requests to see what happens next.',points:['Follow Submitted → Approved → Ready to collect → Collected. Check the approved quantity and any reason for a reduction or rejection.','Wait until your supplies are ready. Confirm collection only after you physically receive them.']},
 {title:'You’re ready to begin',icon:'✓',intro:'A little less paperwork, a little more peace of mind.',points:['You can reopen this demo any time using Quick demo in the menu.']}
];

export default function FirstLoginTour({db,userId,manager}:{db:SupabaseClient;userId:string;manager:boolean}){
 const [open,setOpen]=useState(false),[step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [acknowledged,setAcknowledged]=useState(false),[checked,setChecked]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),title=useRef<HTMLHeadingElement>(null),saving=useRef(false);
 useEffect(()=>{
  let cancelled=false;
  void db.from('user_guide_progress').select('guide_version').eq('user_id',userId).eq('guide_version',VERSION).maybeSingle().then(({data,error})=>{
   if(cancelled)return;
   if(error){setError('Could not load your demo progress. You can still open the demo below.');setChecked(true);return;}
   setAcknowledged(!!data);setChecked(true);if(!data)setOpen(true);
  });
  return()=>{cancelled=true;};
 },[db,userId]);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open&&dialog.current?.open)dialog.current.close();},[open]);
 useEffect(()=>{if(open)title.current?.focus();},[open,step]);
 async function finish(outcome:'completed'|'skipped'){
  if(saving.current)return;saving.current=true;setBusy(true);setError('');
  try{
   if(!acknowledged){
    const result=await db.from('user_guide_progress').upsert({user_id:userId,guide_version:VERSION,outcome},{onConflict:'user_id,guide_version',ignoreDuplicates:true});
    if(result.error)throw result.error;setAcknowledged(true);
   }
   setOpen(false);setStep(0);
  }catch{setError('Could not save your demo progress. Please try again.');}
  finally{saving.current=false;setBusy(false);}
 }
 const current=steps[step],last=step===steps.length-1;
 return <>
  <button type="button" className="nav quick-demo-button" disabled={!checked} onClick={()=>{setStep(0);setError('');setOpen(true);}}><span className="nav-icon" aria-hidden="true">?</span>Quick demo</button>
  {!open&&error&&<p className="tour-load-error" role="status">{error}</p>}
  <dialog className="first-login-tour" ref={dialog} aria-labelledby="tour-title" aria-describedby="tour-intro" onCancel={event=>{event.preventDefault();if(!busy)void finish('skipped');}}>
   <header className="tour-header"><span>SPB · QUICK DEMO</span><span>Step {step+1} of {steps.length}</span></header>
   <div className="tour-progress" aria-label={'Step '+(step+1)+' of '+steps.length}>{steps.map((item,index)=><span key={item.title} className={index<=step?'done':''}/>)}</div>
   <div className="tour-content">
    <div className="tour-icon tour-spb-logo"><svg viewBox="0 0 110 86" role="img" aria-label="SPB — Selangor Properties"><rect x="2" y="2" width="106" height="82" rx="25" fill="#df252f"/><rect x="10" y="10" width="90" height="66" rx="17" fill="none" stroke="white" strokeWidth="3"/><text x="55" y="64" textAnchor="middle" textLength="80" lengthAdjust="spacingAndGlyphs" fill="white" fontFamily="Arial Narrow,Arial,sans-serif" fontSize="62" fontWeight="700">SPB</text></svg></div>
    <h2 id="tour-title" ref={title} tabIndex={-1}>{current.title}</h2>
    <p id="tour-intro" className="tour-intro">{current.intro}</p>
    {step===2&&<div className="tour-example" aria-label="Example only: choosing request items"><span>Example only</span><div><strong>A4 Paper (White)</strong><span>Qty 2</span><b aria-hidden="true">✓</b></div><div><strong>Sticky Notes — 3″ × 3″</strong><span>Qty 1</span><b aria-hidden="true">✓</b></div></div>}
    <ul>{current.points.map(point=><li key={point}>{point}</li>)}</ul>
    {step===3&&manager&&<aside className="tour-manager"><strong>Your approver tools</strong><p>In Approvals, tick requests and choose Approve selected. Enter how many to approve for each item; enter 0 to reject, and give a reason for reduced quantities. Mark ready issues only the approved amount. Receive stock updates your balances; Reorder list and Reports help you plan.</p></aside>}
    {last&&<p className="tour-contact">If you want further information, kindly contact Sharmila. Thank You :D</p>}
    {error&&<p className="tour-save-error" role="alert">{error}</p>}
   </div>
   <footer className="tour-footer"><button type="button" className="tour-skip" disabled={busy} onClick={()=>void finish('skipped')}>Skip demo</button><div>{step>0&&<button type="button" className="button" disabled={busy} onClick={()=>setStep(previous=>previous-1)}>Back</button>}<button type="button" className="button primary" disabled={busy} onClick={()=>last?void finish('completed'):setStep(previous=>previous+1)}>{busy?'Saving…':last?'Start using OfficeStock':step===0?'Let’s begin':'Next'}</button></div></footer>
  </dialog>
 </>;
}
