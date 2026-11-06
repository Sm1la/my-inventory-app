"use client";
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Line = { brand:string; weight:string|null; units_per_box:number|null; id:string; code:string; name:string; category:string; balance:number; minimum_stock:number; unit:string; supplier:string; unit_price:number; location:string; order_quantity:number };
type Form = { reference:string; created:string; lines:Line[] };
const RECIPIENT="sharmila@selangorproperties.com.my";
const currency=(n:number)=>new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);
const escape=(v:unknown)=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");

export default function ReplenishmentForm({db,disabled}:{db:SupabaseClient|null;disabled:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [open,setOpen]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const [form,setForm]=useState<Form|null>(null);
  useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open&&dialog.current?.open)dialog.current?.close()},[open]);
  async function generate() {
    if(!db||busy)return;setBusy(true);setError("");setForm(null);setOpen(true);
    try {
      const rows:Line[]=[];
      for(let offset=0;;offset+=1000){
        const {data,error}=await db.from("inventory_balances").select("*").lt("balance",3).order("name").order("id").range(offset,offset+999);
        if(error)throw error;
        rows.push(...data.map(i=>({...i,order_quantity:Math.max(i.minimum_stock,3)-i.balance})));
        if(data.length<1000)break;
      }
      const now=new Date();
      setForm({reference:"REPL-"+now.toLocaleDateString("en-CA",{timeZone:"Asia/Kuala_Lumpur"}).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase(),created:now.toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"}),lines:rows});
    }catch(e){setError(e instanceof Error?e.message:"Could not generate the form. Please try again.")}
    finally{setBusy(false)}
  }
  function download() {
    if(!form?.lines.length)return;
    if(form.lines.some(i=>!Number.isInteger(i.order_quantity)||i.order_quantity<1||i.order_quantity>10000000)){setError("Enter a whole order quantity between 1 and 10,000,000 for every item.");return}
    const total=form.lines.reduce((s,i)=>s+i.order_quantity*Number(i.unit_price),0);
    const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(form.reference)+'</title><style>body{font:13px Arial,sans-serif;margin:40px;color:#243f36}h1{font-size:24px}p{line-height:1.7}table{border-collapse:collapse;width:100%;margin-top:24px}td,th{border:1px solid #ccd7cc;padding:9px;text-align:left}th{background:#edf3e9}small{color:#6e806b}@media print{body{margin:12mm}table{font-size:10px}}</style></head><body><h1>Inventory Replenishment Form</h1><p>Selangor Properties Sdn. Bhd.<br>Reference: '+escape(form.reference)+'<br>Prepared: '+escape(form.created)+' (Malaysia time)<br>To: '+escape(RECIPIENT)+'</p><p>Items with a stock balance below 3 at generation time. Quantities are in each item’s own unit.</p><table><thead><tr><th>Code</th><th>Item</th><th>Category</th><th>Brand</th><th>Weight</th><th>Units per box</th><th>Balance</th><th>Unit</th><th>Minimum</th><th>Order quantity</th><th>Supplier</th><th>Location</th><th>Estimated cost</th></tr></thead><tbody>'+form.lines.map(i=>'<tr><td>'+escape(i.code)+'</td><td>'+escape(i.name)+'</td><td>'+escape(i.category)+'</td><td>'+escape(i.brand)+'</td><td>'+escape(i.category==='Pantry'?i.weight||'':'')+'</td><td>'+escape(i.category==='Stationery'?i.units_per_box??'':'')+'</td><td>'+i.balance+'</td><td>'+escape(i.unit)+'</td><td>'+i.minimum_stock+'</td><td>'+i.order_quantity+'</td><td>'+escape(i.supplier||'Not specified')+'</td><td>'+escape(i.location||'Not specified')+'</td><td>'+escape(currency(i.order_quantity*Number(i.unit_price)))+'</td></tr>').join('')+'</tbody></table><p><strong>Total estimated cost: '+escape(currency(total))+'</strong></p><p>Prepared by: ____________________ &nbsp; Approved by: ____________________</p><small>This form does not place an order or change inventory balances. Estimates use recorded unit prices.</small></body></html>';
    const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=form.reference+".html";a.click();URL.revokeObjectURL(url);
  }
  return <><button className="button" disabled={disabled||busy} onClick={()=>void generate()}>↧ Create form: stock below 3</button><dialog className="replenishment-dialog" ref={dialog} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}><div className="dialog-heading"><div><p className="eyebrow">STOCK REPLENISHMENT</p><h2>Inventory Replenishment Form</h2></div><button className="close" aria-label="Close replenishment form" onClick={()=>setOpen(false)}>×</button></div>{busy?<p role="status">Checking current stock balances…</p>:error?<div className="alert error" role="alert">{error}</div>:null}{form&&<><div className="replenishment-meta"><span><strong>{form.reference}</strong><small>{form.created} · Malaysia time</small></span><span>To: <strong>{RECIPIENT}</strong></span></div>{!form.lines.length?<div className="empty"><h3>No items have a balance below 3</h3><p>No replenishment form is needed. Items with exactly 3 units are excluded.</p></div>:<><p className="report-caption">Includes every item below 3, regardless of the current search or category filter. Suggested quantities restore the greater of 3 or the item’s minimum level; edit them as needed.</p><div className="table-wrap"><table aria-label="Replenishment items"><thead><tr><th>Item</th><th>Balance</th><th>Minimum</th><th>Order quantity</th><th>Supplier</th><th>Estimated cost</th></tr></thead><tbody>{form.lines.map(i=><tr key={i.id}><td><strong>{i.name}</strong><small>{i.code} · {i.category}</small><small>{[i.brand,i.category === "Pantry" ? i.weight : i.units_per_box ? i.units_per_box + " units/box" : null].filter(Boolean).join(" · ")}</small></td><td>{i.balance} {i.unit}</td><td>{i.minimum_stock}</td><td><input className="order-quantity" aria-label={"Order quantity for "+i.name} type="number" min={1} max={10000000} step={1} value={i.order_quantity} onChange={e=>{setError("");setForm({...form,lines:form.lines.map(l=>l.id===i.id?{...l,order_quantity:Number(e.target.value)}:l)})}}/></td><td>{i.supplier||"—"}</td><td>{currency(i.order_quantity*Number(i.unit_price))}</td></tr>)}</tbody></table></div><p className="replenishment-total">Total estimated cost: <strong>{currency(form.lines.reduce((s,i)=>s+i.order_quantity*Number(i.unit_price),0))}</strong></p><p className="form-help">Download this form to print it or attach it to an email yourself. Creating the form does not send email, place an order or change stock.</p></>}</>}<div className="dialog-footer"><button className="button" onClick={()=>setOpen(false)}>Close</button>{!!form?.lines.length&&<button className="button primary" onClick={download}>Download printable form</button>}</div></dialog></>;
}
