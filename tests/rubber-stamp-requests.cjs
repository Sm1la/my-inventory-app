const fs = require('fs'), ts = require('typescript'), assert = require('node:assert/strict');
function load(path, deps={}) { const mod={exports:{}}; const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText; new Function('exports','require',code)(mod.exports,key=>deps[key] ?? require(key)); return mod.exports; }
const colours=load('lib/stationery-colours.ts');
const {readRequestLines,requestNotes}=load('lib/request-lines.ts',{'./stationery-colours':colours});
const stamp=(type='Ink pad')=>({item_id:null,quantity:2,rubber_stamp:{type,colour:'Blue',size:'60 × 30 mm',details:'ACCOUNTS RECEIVED\nBlue ink; rectangular'}});
const read=rows=>readRequestLines(JSON.stringify(rows),[],true);
for(const type of ['Ink pad','Self ink rubber stamp']) {
  const line=read([stamp(type)])[0];
  assert.equal(line.other_name,'Rubber stamp — '+type);
  assert.equal(line.other_category,'Stationery');
  assert.equal(line.quantity,2);
  assert.equal(line.item_id,null);
  assert.match(line.notes,/60 × 30 mm/);
  assert.match(line.notes,/ACCOUNTS RECEIVED\nBlue ink/);
  assert.equal(line.rubber_stamp,undefined); // only persisted database columns remain
  assert.match(requestNotes(line,'Deliver to Finance'),/Blue ink; rectangular\n\nDeliver to Finance/);
}
assert.equal(read([stamp(),{item_id:null,quantity:1,other_name:'Custom folder',other_category:'Stationery'}]).length,2);
assert.throws(()=>read([stamp(),stamp()]));
for(const change of [{type:'Unknown'},{size:''},{details:''},{size:'x'.repeat(41)},{details:'x'.repeat(301)}]) {
  const row=stamp();Object.assign(row.rubber_stamp,change);assert.throws(()=>read([row]));
}
assert.throws(()=>read([{...stamp(),quantity:0}]));
assert.throws(()=>requestNotes(read([stamp()])[0],'x'.repeat(500)));
assert.equal(requestNotes({notes:undefined},'Shared notes'),'Shared notes');
for(const colour of ['Black','Blue']) {
  const row=stamp('Self ink rubber stamp');row.rubber_stamp.colour=colour;
  assert.match(read([row])[0].notes,new RegExp('Ink colour: '+colour));
}
for(const colour of ['',undefined,'Red','Green']) {
  const row=stamp('Self ink rubber stamp');row.rubber_stamp.colour=colour;
  assert.throws(()=>read([row]),/Choose Black or Blue/);
}
assert.doesNotMatch(read([stamp('Ink pad')])[0].notes,/Ink colour:/);
console.log('Stamp types, specifications, mixed requests, persistence payload and note limits passed');
