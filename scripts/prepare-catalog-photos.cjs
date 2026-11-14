// Download reviewed public product references, then optimise first-party thumbnails.
const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const candidates=JSON.parse(fs.readFileSync('docs/catalog-photo-sources.json','utf8')).map(row=>({...row,candidates:row.candidates??[{image:row.imageSource,page:row.source}]}));
const target='public/catalog-photos';fs.mkdirSync(target,{recursive:true});
const rank=(source)=>source.preferred?-1000:/pacificwise/.test(source.image)?100:/nescafe.com/.test(source.image)?-100:/bites.com|jayagrocer|deliveryhero|dhmedia|cdn.shopify|npcdn|beconmy|premio/.test(source.image)?-20:/susercontent|slatic|amazon|ebay/.test(source.image)?30:0;
const only=process.argv.slice(2);
const done=only.length&&fs.existsSync('docs/catalog-photo-downloads.json')?JSON.parse(fs.readFileSync('docs/catalog-photo-downloads.json','utf8')).filter(row=>!only.includes(row.code)):[];
async function download(item){
 const output=path.join(target,item.code+'.jpg');
 const options=[...item.candidates].sort((a,b)=>rank(a)-rank(b));
 if(item.code==='PAN-LIPTON-TEA')options.unshift({image:'https://d11vuao38tfjvv.cloudfront.net/files/6aa0b19329e105c2d23675ebd09028f6364218777dbd74e21ce9c66966b88699.jpg',page:'https://shop.redtick.com/store/lipton-teabags-in-envelope'});
 const errors=[];
 for(const source of options.slice(0,7)){
  try{
   const response=await fetch(source.image,{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'Mozilla/5.0','Accept':'image/*'}});
   if(!response.ok)throw Error('HTTP '+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length<2000 || bytes.length>12*1024*1024)throw Error('Image size rejected');
   const info=await sharp(bytes).metadata();if(!info.width||!info.height||Math.min(info.width,info.height)<90)throw Error('Image dimensions too small');
   const result=await sharp(bytes).rotate().resize(360,360,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).jpeg({quality:80,mozjpeg:true}).toBuffer();
   fs.writeFileSync(output,result);
   done.push({code:item.code,name:item.name,category:item.category,brand:item.brand||'',src:'/catalog-photos/'+item.code+'.jpg',source:source.page,imageSource:source.image,kind:'reference',sha256:crypto.createHash('sha256').update(result).digest('hex')});
   console.log('OK '+item.code+' '+result.length+' bytes');return;
  }catch(e){errors.push(new URL(source.image).hostname+': '+e.message);}
 }
 done.push({code:item.code,error:errors.join('; ')});console.log('FAILED '+item.code+' '+errors.join('; '));
}
(async()=>{const selected=only.length?candidates.filter(row=>only.includes(row.code)):candidates;for(let start=0;start<selected.length;start+=8)await Promise.all(selected.slice(start,start+8).map(download));done.sort((a,b)=>a.code.localeCompare(b.code));fs.writeFileSync('docs/catalog-photo-downloads.json',JSON.stringify(done,null,2));console.log(JSON.stringify({success:done.filter(row=>row.src).length,failed:done.filter(row=>row.error).map(row=>row.code)}));})().catch(e=>{console.error(e);process.exitCode=1;});
