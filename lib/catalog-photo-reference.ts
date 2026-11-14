import photos from './catalog-photos.json';
type ReferencePhoto={src:string;source:string;name:string};
const references:Record<string,ReferencePhoto>=photos;
const byUrl=new Map(Object.values(references).map(photo=>[photo.src,photo]));
export function catalogPhoto(code?:string):ReferencePhoto|undefined{return code?references[code]:undefined;}
export function catalogPhotoByUrl(url?:string):ReferencePhoto|undefined{return url?byUrl.get(url):undefined;}
export function itemPhotoUrl(item:{id:string;code?:string;photo_path?:string|null},signedUrls:Record<string,string>):string|undefined{
  // Uploaded photos remain private and always take priority over product references.
  return item.photo_path?signedUrls[item.id]:catalogPhoto(item.code)?.src;
}
