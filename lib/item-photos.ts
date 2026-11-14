"use client";
import {useEffect,useMemo,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {itemPhotoUrl} from './catalog-photo-reference';
export const PHOTO_BUCKET='inventory-photos';
export function useItemPhotos(db:SupabaseClient|null,items:readonly {id:string;code?:string;photo_path?:string|null}[]) {
  const [urls,setUrls]=useState<Record<string,string>>({});
  useEffect(()=>{
    let cancelled=false;
    const photos=items.filter(item=>item.photo_path);
    async function refresh(){
      if(!db || !photos.length){setUrls({});return;}
      const {data,error}=await db.storage.from(PHOTO_BUCKET).createSignedUrls(photos.map(item=>item.photo_path!),3600);
      if(cancelled)return;
      setUrls(error?{}:Object.fromEntries(photos.flatMap(item=>{const photo=data?.find(row=>row.path===item.photo_path);return photo?.signedUrl?[[item.id,photo.signedUrl]]:[];})));
    }
    void refresh();const timer=setInterval(()=>void refresh(),45*60*1000);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[db,items]);
  return useMemo(()=>Object.fromEntries(items.flatMap(item=>{const url=itemPhotoUrl(item,urls);return url?[[item.id,url]]:[];})),[items,urls]);
}
export async function preparePhoto(file:File):Promise<Blob>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP photo.');
  if(file.size>5*1024*1024)throw new Error('Choose a photo smaller than 5 MB.');
  const image=await createImageBitmap(file);
  try{
    const scale=Math.min(1,1200/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not prepare this photo.');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare the photo.')),'image/jpeg',0.85));
  }finally{image.close();}
}
