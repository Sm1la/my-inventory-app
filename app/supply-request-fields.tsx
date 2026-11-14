"use client";

import { useState, type ReactNode } from "react";
import ColourSelect from "./colour-select";
import ColourChecklist from "./colour-checklist";
import { COLOURS, stationeryType, defaultColour, fixedColour } from "@/lib/stationery-colours";
import type { RequestLine } from "@/lib/request-lines";

type RequestItem = { stationery_type?: string; colour?: string; id: string; name: string; code: string; brand: string; category: string; balance: number; unit: string };
type Props = { requestorIdentity: string | null; items: RequestItem[]; initialCategory: string; initialItemId?: string; approvers: readonly string[]; departments: readonly string[]; busy: boolean };
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }

export default function SupplyRequestFields({ requestorIdentity, items, initialCategory, initialItemId, approvers, departments, busy }: Props) {
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>(() => initialItemId ? { [initialItemId]: "1" } : {});
  const [colours, setColours] = useState<Record<string,string>>({});
  const [highlighterColours,setHighlighterColours] = useState<Record<string,Record<string,string>>>({});
  const [otherColour,setOtherColour] = useState("");
  const [other, setOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherBrand, setOtherBrand] = useState("");
  const [otherCategory, setOtherCategory] = useState(initialCategory === "Pantry" ? "Pantry" : "Stationery");
  const [otherQuantity, setOtherQuantity] = useState("1");
  const [stamp, setStamp] = useState(false);
  const [stampType, setStampType] = useState("Ink pad");
  const [stampColour, setStampColour] = useState("");
  const [stampSize, setStampSize] = useState("");
  const [stampDetails, setStampDetails] = useState("");
  const [stampQuantity, setStampQuantity] = useState("1");
  const selectedItems = items.filter(item => selected[item.id] !== undefined);
  const visibleItems = items.filter(item => (category === "All categories" || item.category === category) && [item.name, item.code, item.brand].join(" ").toLowerCase().includes(search.toLowerCase()));
  const missingHighlighterColours = selectedItems.some(item => stationeryType(item) === "Highlighter" && !Object.keys(highlighterColours[item.id] ?? {}).length);
  const lines: RequestLine[] = selectedItems.flatMap(item => {
    const base = { item_id: item.id, other_name: null, other_brand: "", other_category: null };
    return stationeryType(item) === "Highlighter" ? Object.entries(highlighterColours[item.id] ?? {}).map(([requested_colour,quantity]) => ({...base,requested_colour,quantity:Number(quantity)})) : [{...base,requested_colour:fixedColour(item) || (colours[item.id] ?? defaultColour(item)),quantity:Number(selected[item.id])}];
  });
  if (other) lines.push({ requested_colour: otherColour, item_id: null, other_name: otherName, other_brand: otherBrand, other_category: otherCategory, quantity: Number(otherQuantity) });
  if (stamp) lines.push({ requested_colour: "", item_id: null, other_name: "Rubber stamp — " + stampType, other_brand: "", other_category: "Stationery", quantity: Number(stampQuantity), rubber_stamp: { type: stampType, size: stampSize, details: stampDetails, colour: stampColour } });
  function toggle(id: string, checked: boolean) {
    if (!checked) setHighlighterColours(previous => { const next={...previous}; delete next[id]; return next; });
    setSelected(previous => {
      const next = { ...previous };
      if (checked) next[id] = "1"; else delete next[id];
      return next;
    });
  }
  function setHighlighterQuantity(id: string, colour: string, quantity: string | null) {
    setHighlighterColours(previous => { const next={...(previous[id] ?? {})}; if(quantity === null) delete next[colour]; else next[colour]=quantity; return {...previous,[id]:next}; });
  }
  function selectionSummary(item: RequestItem) {
    if(stationeryType(item) === "Highlighter") return " · " + Object.entries(highlighterColours[item.id] ?? {}).map(([colour,quantity]) => colour + " × " + (quantity || "?")).join(", ");
    const colour=colours[item.id] ?? defaultColour(item);
    return (colour ? " · " + colour : "") + " × " + (selected[item.id] || "?");
  }
  return <fieldset disabled={busy} className="request-fields">
    <input type="hidden" name="request_lines" value={JSON.stringify(lines)}/>
    <input type="hidden" name="request_colour_error" value={missingHighlighterColours ? "Tick at least one colour for each selected highlighter." : ""}/>
    <div className="request-picker-heading"><h3>Choose items</h3><span aria-live="polite">{lines.length} selected</span></div>
    <p className="request-picker-help">Tick the boxes on the right and enter a quantity for each item. Your signed-in account fills the requestor. Choose the department and approver once below.</p>
    <div className="request-picker-filters"><Field label="Category"><select value={category} onChange={event => setCategory(event.target.value)}><option>All categories</option><option>Stationery</option><option>Pantry</option></select></Field><Field label="Search items"><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Item name, code or brand"/></Field></div>
    <div className="request-pick-list" role="group" aria-label="Items to request">
      <div className="request-pick-labels"><span>Item / available stock</span><span>Qty</span><span>Tick</span></div>
      {visibleItems.map(item => <div className={selected[item.id] !== undefined ? "request-pick-row selected" : "request-pick-row"} key={item.id}>
        <div><label htmlFor={"request-pick-" + item.id}><strong>{item.name}</strong><small>{item.category}{item.brand ? " · " + item.brand : ""} · {item.balance} {item.unit} available</small></label>{selected[item.id] !== undefined && stationeryType(item) && stationeryType(item) !== "Highlighter" && <ColourSelect fixed={fixedColour(item)} kind={stationeryType(item)} value={colours[item.id] ?? defaultColour(item)} onChange={value => setColours(previous => ({...previous,[item.id]:value}))} label={"Colour for " + item.name} required/>}</div>
        {stationeryType(item) === "Highlighter" ? <span className="highlighter-total" aria-label={"Total quantity for " + item.name}>{Object.values(highlighterColours[item.id] ?? {}).reduce((sum,quantity) => sum + Number(quantity || 0),0)}</span> : <input className="request-line-qty" type="number" min={1} max={10000000} step={1} required={selected[item.id] !== undefined} disabled={selected[item.id] === undefined} aria-label={"Quantity for " + item.name} value={selected[item.id] ?? "1"} onChange={event => setSelected(previous => ({ ...previous, [item.id]: event.target.value }))}/> }
        <input id={"request-pick-" + item.id} type="checkbox" aria-label={"Select " + item.name} checked={selected[item.id] !== undefined} onChange={event => toggle(item.id, event.target.checked)}/>{selected[item.id] !== undefined && stationeryType(item) === "Highlighter" && <ColourChecklist label={item.name} choices={COLOURS.Highlighter} values={highlighterColours[item.id] ?? {}} onChange={(colour,quantity) => setHighlighterQuantity(item.id,colour,quantity)}/>}
      </div>)}
      {!visibleItems.length && <p className="request-no-matches">No matching items. Try another search or choose Other below.</p>}
    </div>
    {(category !== "Pantry" || stamp) && <label className="request-other-toggle"><span><strong>Rubber stamp</strong><small>Choose Ink pad or Self ink rubber stamp and enter your specifications.</small></span><input type="checkbox" aria-label="Select Rubber stamp" checked={stamp} onChange={event => setStamp(event.target.checked)}/></label>}
    {stamp && <div className="form-grid request-other-details" role="group" aria-label="Rubber stamp specifications"><Field label="Rubber stamp type *"><select value={stampType} onChange={event => setStampType(event.target.value)}><option>Ink pad</option><option>Self ink rubber stamp</option></select></Field><Field label="Rubber stamp quantity *"><input type="number" min={1} max={10000000} step={1} required value={stampQuantity} onChange={event => setStampQuantity(event.target.value)}/></Field>{stampType === "Self ink rubber stamp" && <Field label="Ink colour *"><select required value={stampColour} onChange={event => setStampColour(event.target.value)}><option value="" disabled>Select ink colour</option><option>Black</option><option>Blue</option></select></Field>}<div className="full"><Field label="Size / dimensions *"><input required maxLength={40} value={stampSize} onChange={event => setStampSize(event.target.value)} placeholder="e.g. 60 × 30 mm, or pad size No. 2"/></Field></div><div className="full"><Field label="Custom stamp details *"><textarea required rows={4} maxLength={300} value={stampDetails} onChange={event => setStampDetails(event.target.value)} placeholder="Enter the exact wording, layout, ink colour, shape and any other requirements."/></Field><small>These specifications are saved with this request for approval and reordering.</small></div></div>}
    <label className="request-other-toggle"><span><strong>Other — item not in the list</strong><small>Add an unlisted item to the reorder list for review.</small></span><input type="checkbox" aria-label="Select Other item" checked={other} onChange={event => { setOther(event.target.checked); if (event.target.checked && !otherName.trim()) setOtherCategory(category === "Pantry" ? "Pantry" : "Stationery"); }}/></label>
    {lines.length > 0 && <div className="request-selection-summary" aria-label="Selected items"><strong>Selected items</strong><ul>{selectedItems.map(item => <li key={item.id}>{item.name}{selectionSummary(item)} <button type="button" aria-label={"Remove selected " + item.name} onClick={() => toggle(item.id, false)}>×</button></li>)}{stamp && <li>Rubber stamp — {stampType}{stampType === "Self ink rubber stamp" && stampColour ? " · " + stampColour : ""}{stampSize ? " · " + stampSize : ""} × {stampQuantity || "?"}</li>}{other && <li>Other: {otherName || "enter item name below"} × {otherQuantity || "?"}</li>}</ul><small>Selections are kept when you change category or search.</small></div>}
    {other && <div className="form-grid request-other-details"><div className="full"><Field label="Other item name *"><input required maxLength={120} value={otherName} onChange={event => setOtherName(event.target.value)} placeholder="Enter the item you need"/></Field></div><Field label="Brand"><input maxLength={120} value={otherBrand} onChange={event => setOtherBrand(event.target.value)} placeholder="Enter brand, if known"/></Field><Field label="Other category *"><select value={otherCategory} onChange={event => setOtherCategory(event.target.value)}><option>Stationery</option><option>Pantry</option></select></Field><Field label="Other quantity *"><input type="number" min={1} max={10000000} step={1} required value={otherQuantity} onChange={event => setOtherQuantity(event.target.value)}/></Field></div>}
    {other && stationeryType({name:otherName,category:otherCategory}) && <ColourSelect kind={stationeryType({name:otherName,category:otherCategory})} value={otherColour} onChange={setOtherColour} label="Other item colour" required/>}
    <h3 className="request-shared-heading">Request details — applies to all selected items</h3>
    <div className="form-grid"><Field label="Requestor *"><input key={requestorIdentity ?? "guest"} name="requestor" required maxLength={120} defaultValue={requestorIdentity ?? ""} readOnly={!!requestorIdentity} placeholder="Your name"/>{requestorIdentity && <small>Automatically set from your signed-in account.</small>}</Field><Field label="Department *"><select name="department" required defaultValue=""><option value="" disabled>Select department</option>{departments.map(name => <option key={name}>{name}</option>)}</select></Field><div className="full"><Field label="Assigned approver *"><select name="assigned_approver" required defaultValue=""><option value="" disabled>Select approver</option>{approvers.map(name => <option key={name} value={name}>{name === "Mila" ? "Sharmila" : name}</option>)}</select></Field></div><div className="full"><Field label="Notes"><textarea name="notes" rows={2} maxLength={500}/></Field></div></div>
  </fieldset>;
}
