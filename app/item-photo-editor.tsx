"use client";
import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {PHOTO_BUCKET,preparePhoto} from '@/lib/item-photos';
type Props={db:SupabaseClient;item:{id:string;workspace_id:string;name:string;photo_path?:string|null};url?:string;busy:boolean;onBusy:(busy:boolean)=>void;onSaved:()=>Promise<void>};
export default function ItemPhotoEditor({db,item,url,busy,onBusy,onSaved}:Props){
  const [path,setPath]=useState(item.photo_path??null),[preview,setPreview]=useState(url),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function save(file:File|null){
    if(busy)return;onBusy(true);setError('');setMessage('');let uploaded:string|null=null;
    try{
      let next:string|null=null;
      if(file){const photo=await preparePhoto(file);next=`${item.workspace_id}/${item.id}/${crypto.randomUUID()}.jpg`;const result=await db.storage.from(PHOTO_BUCKET).upload(next,photo,{contentType:'image/jpeg',upsert:false});if(result.error)throw result.error;uploaded=next;}
      const result=await db.from('inventory_items').update({photo_path:next}).eq('id',item.id).select('id').single();if(result.error)throw result.error;
      uploaded=null;const old=path;setPath(next);
      if(next){const signed=await db.storage.from(PHOTO_BUCKET).createSignedUrl(next,3600);setPreview(signed.data?.signedUrl);}else setPreview(undefined);
      if(old)await db.storage.from(PHOTO_BUCKET).remove([old]);
      setMessage(next?'Photo saved.':'Photo removed.');await onSaved();
    }catch(e){if(uploaded)await db.storage.from(PHOTO_BUCKET).remove([uploaded]);setError(e instanceof Error?e.message:'Photo could not be saved. Try again.');}
    finally{onBusy(false);}
  }
  return <section className="photo-editor full" aria-label="Item photo"><div>{preview?<img src={preview} alt={item.name} width={92} height={92}/>:<span className="photo-empty" aria-hidden="true">▧</span>}<div><strong>Item photo</strong><p>Add an actual product photo to help staff choose the right item.</p><label className="button photo-upload">{busy?'Saving…':path?'Replace photo':'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-label="Upload item photo" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void save(file);}}/></label>{path&&<button type="button" className="button" disabled={busy} onClick={()=>void save(null)}>Remove photo</button>}</div></div><small>JPG, PNG or WebP · maximum 5 MB. Photos save immediately, separately from the item details.</small>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="photo-error">{error}</p>}</section>;
}
