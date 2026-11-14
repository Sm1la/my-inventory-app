const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('crypto');
const photos=require('../lib/catalog-photos.json'),sources=require('../docs/catalog-photo-sources.json');
const mod={exports:{}};new Function('exports','require',ts.transpileModule(fs.readFileSync('lib/catalog-photo-reference.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(mod.exports,key=>key==='./catalog-photos.json'?photos:require(key));
const {itemPhotoUrl,catalogPhoto,catalogPhotoByUrl}=mod.exports;
assert.equal(Object.keys(photos).length,57);
assert.equal(sources.filter(row=>row.category==='Stationery').length,45);
assert.equal(sources.filter(row=>row.category==='Pantry').length,12);
for(const row of sources){const bytes=fs.readFileSync('public'+row.src);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(photos[row.code].src,row.src);assert.equal(new URL(row.source).protocol,'https:');assert.ok(bytes.length>1000);assert.equal(catalogPhotoByUrl(row.src).name,row.name);}
assert.equal(itemPhotoUrl({id:'test',code:'PAN-LIPTON-TEA',photo_path:null},{}),'/catalog-photos/PAN-LIPTON-TEA.jpg');
assert.equal(itemPhotoUrl({id:'test',code:'PAN-LIPTON-TEA',photo_path:'private/photo.jpg'},{test:'signed-upload'}),'signed-upload');
assert.equal(itemPhotoUrl({id:'test',code:'PAN-LIPTON-TEA',photo_path:'private/photo.jpg'},{}),undefined);
assert.equal(catalogPhoto('PHOTO-VERIFY-20261114'),undefined);
assert.equal(catalogPhoto('UNKNOWN-ITEM'),undefined);
console.log('57 photo assets, source records, category coverage and private-upload priority verified.');
