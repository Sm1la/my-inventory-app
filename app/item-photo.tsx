"use client";
import {useState} from 'react';
export default function ItemPhoto({name,category,url}:{name:string;category:string;url?:string}) {
  const [failed,setFailed]=useState('');
  return <span className="item-photo">{url && failed!==url ? <img src={url} alt={name} width={52} height={52} loading="lazy" onError={()=>setFailed(url)}/> : <span aria-hidden="true">{category==='Pantry'?'☕':'▤'}</span>}</span>;
}
