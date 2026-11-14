"use client";
import {useEffect,useRef,useState} from 'react';
import {catalogPhotoByUrl} from '@/lib/catalog-photo-reference';
export default function ItemPhoto({name,category,url}:{name:string;category:string;url?:string}) {
  const [failed,setFailed]=useState('');
  const [expanded,setExpanded]=useState(false),dialog=useRef<HTMLDialogElement>(null);
  const reference=catalogPhotoByUrl(url);
  useEffect(()=>{if(expanded&&!dialog.current?.open)dialog.current?.showModal();if(!expanded&&dialog.current?.open)dialog.current?.close();},[expanded]);
  return <span className="item-photo">{url && failed!==url ? <button type="button" className="item-photo-trigger" aria-label={'View photo of '+name} title={reference?'Reference photo · click to enlarge':'Click to enlarge photo'} onClick={()=>setExpanded(true)}><img src={url} alt={reference?name+' — reference photo':name} width={52} height={52} loading="lazy" onError={()=>setFailed(url)}/></button> : <span aria-hidden="true">{category==='Pantry'?'☕':'▤'}</span>}<dialog ref={dialog} className="item-photo-dialog" onCancel={event=>{event.preventDefault();event.stopPropagation();setExpanded(false);}} onClose={event=>{event.stopPropagation();setExpanded(false);}} onClick={event=>{if(event.target===event.currentTarget)setExpanded(false);}}>{expanded&&<><div className="photo-preview-heading"><h3>{name}</h3><button type="button" className="close" aria-label="Close photo" onClick={()=>setExpanded(false)}>×</button></div><img src={url} alt={name} width={360} height={360}/><p>{reference?'Reference product photo. Brand, colour or packaging may vary; check the saved item details.':'Photo uploaded by an inventory manager.'}{reference?.source&&<> <a href={reference.source} target="_blank" rel="noreferrer">Photo source ↗</a></>}</p></>}</dialog></span>;
}
