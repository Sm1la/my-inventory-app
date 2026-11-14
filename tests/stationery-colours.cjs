const fs = require('fs'), ts = require('typescript'), assert = require('node:assert/strict');
function load(path, deps={}) { const mod={exports:{}}; const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText; new Function('exports','require',code)(mod.exports,key=>deps[key] ?? require(key)); return mod.exports; }
const colours=load('lib/stationery-colours.ts');
assert.equal(colours.stationeryType({name:'A4 Copy Paper (80gsm)',category:'Stationery'}),'Paper');
assert.equal(colours.defaultColour({name:'A4 Paper (White)',category:'Stationery'}),'White');
assert.equal(colours.defaultColour({name:'A4 Colour Paper',category:'Stationery'}),'');
assert.equal(colours.fixedColour({name:'A4 Paper (White)',category:'Stationery'}),'White');
assert.equal(colours.fixedColour({name:'A4 Colour Paper',category:'Stationery'}),'');
assert.equal(colours.COLOURS.Paper.includes('White'),false);
for(const colour of ['Blue','Green','Yellow','Red']) {
  const variant={name:'A4 Colour Paper (80gm) — '+colour,category:'Stationery'};
  assert.equal(colours.fixedColour(variant),colour);
  assert.equal(colours.defaultColour({...variant,colour:'Other'}),colour);
}
assert.equal(colours.defaultColour({name:'A4 Paper (White)',colour:'Blue',category:'Stationery'}),'White');
assert.equal(colours.validateColour('Paper','White',true),'White');
assert.equal(colours.stationeryType({name:'Paper Clips',category:'Stationery'}),'');
assert.equal(colours.stationeryType({name:'Black Ballpoint Pens',category:'Stationery'}),'Ball pen');
assert.equal(colours.stationeryType({name:'Whiteboard Markers (Assorted)',category:'Stationery'}),'Marker pen');
assert.equal(colours.stationeryType({name:'Paper cup',category:'Pantry'}),'');
assert.equal(colours.stationeryType({name:'Highlighters',category:'Stationery'}),'Highlighter');
assert.deepEqual(colours.COLOURS.Highlighter,['Yellow','Green','Pink','Lilac','Blue']);
assert.throws(()=>colours.validateColour('Highlighter','Purple',true));
for(const kind of Object.keys(colours.COLOURS)) for(const colour of colours.COLOURS[kind].filter(v=>v!=='Other')) assert.equal(colours.validateColour(kind,colour,true),colour);
assert.equal(colours.validateColour('Paper','Pink',true),'Pink');
assert.equal(colours.validateColour('Marker pen','Purple',true),'Purple');
assert.throws(()=>colours.validateColour('Ball pen','Green',true));
assert.throws(()=>colours.validateColour('Paper','Other',true));
assert.throws(()=>colours.validateColour('Paper','',true));
const {readRequestLines}=load('lib/request-lines.ts',{'./stationery-colours':colours});
const items=[{id:'paper',name:'A4 Paper',category:'Stationery'}];
for(const colour of colours.COLOURS.Highlighter) assert.equal(readRequestLines(JSON.stringify([{item_id:'highlighter',quantity:1,requested_colour:colour}]),[{id:'highlighter',name:'Highlighters',category:'Stationery'}],true)[0].requested_colour,colour);
assert.throws(()=>readRequestLines(JSON.stringify([{item_id:'highlighter',quantity:1}]),[{id:'highlighter',name:'Highlighters',category:'Stationery'}],true));
const highlighterItems=[{id:'highlighter',name:'Highlighters',category:'Stationery'}];
const multiColour=[{item_id:'highlighter',quantity:2,requested_colour:'Yellow'},{item_id:'highlighter',quantity:3,requested_colour:'Pink'}];
assert.deepEqual(readRequestLines(JSON.stringify(multiColour),highlighterItems,true).map(row=>[row.requested_colour,row.quantity]),[['Yellow',2],['Pink',3]]);
assert.throws(()=>readRequestLines(JSON.stringify([multiColour[0],multiColour[0]]),highlighterItems,true));
assert.throws(()=>readRequestLines(JSON.stringify(multiColour),highlighterItems,false)); // receipts still reject duplicate item IDs
const whitePaper=[{id:'white-paper',name:'A4 Paper (White)',category:'Stationery'}];
assert.equal(readRequestLines(JSON.stringify([{item_id:'white-paper',quantity:2,requested_colour:'Blue'}]),whitePaper,true)[0].requested_colour,'White');
assert.equal(readRequestLines(JSON.stringify([{item_id:'white-paper',quantity:2}]),whitePaper,true)[0].requested_colour,'White');
const bluePaper=[{id:'blue-paper',name:'A4 Colour Paper (80gm) — Blue',category:'Stationery'}];
assert.equal(readRequestLines(JSON.stringify([{item_id:'blue-paper',quantity:1,requested_colour:'Yellow'}]),bluePaper,true)[0].requested_colour,'Blue');
assert.equal(readRequestLines(JSON.stringify([{item_id:'paper',quantity:2,requested_colour:'Green'}]),items,true)[0].requested_colour,'Green');
assert.throws(()=>readRequestLines(JSON.stringify([{item_id:'paper',quantity:2}]),items,true));
assert.equal(readRequestLines(JSON.stringify([{item_id:'paper',quantity:2}]),items)[0].quantity,2);
assert.equal(readRequestLines(JSON.stringify([{item_id:null,quantity:1,other_name:'Marker pen',other_category:'Stationery',requested_colour:'Purple'}]),items,true)[0].requested_colour,'Purple');
console.log('Stationery colour option and request validation checks passed');
