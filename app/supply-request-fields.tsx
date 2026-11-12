"use client";

import { useState, type ReactNode } from "react";
import type { RequestLine } from "@/lib/request-lines";

type RequestItem = { id: string; name: string; code: string; brand: string; category: string; balance: number; unit: string };
type Props = { items: RequestItem[]; initialCategory: string; initialItemId?: string; approvers: readonly string[]; departments: readonly string[]; busy: boolean };
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }

export default function SupplyRequestFields({ items, initialCategory, initialItemId, approvers, departments, busy }: Props) {
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>(() => initialItemId ? { [initialItemId]: "1" } : {});
  const [other, setOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherBrand, setOtherBrand] = useState("");
  const [otherCategory, setOtherCategory] = useState(initialCategory === "Pantry" ? "Pantry" : "Stationery");
  const [otherQuantity, setOtherQuantity] = useState("1");
  const selectedItems = items.filter(item => selected[item.id] !== undefined);
  const visibleItems = items.filter(item => (category === "All categories" || item.category === category) && [item.name, item.code, item.brand].join(" ").toLowerCase().includes(search.toLowerCase()));
  const lines: RequestLine[] = selectedItems.map(item => ({ item_id: item.id, quantity: Number(selected[item.id]), other_name: null, other_brand: "", other_category: null }));
  if (other) lines.push({ item_id: null, other_name: otherName, other_brand: otherBrand, other_category: otherCategory, quantity: Number(otherQuantity) });
  function toggle(id: string, checked: boolean) {
    setSelected(previous => {
      const next = { ...previous };
      if (checked) next[id] = "1"; else delete next[id];
      return next;
    });
  }
  return <fieldset disabled={busy} className="request-fields">
    <input type="hidden" name="request_lines" value={JSON.stringify(lines)}/>
    <div className="request-picker-heading"><h3>Choose items</h3><span aria-live="polite">{lines.length} selected</span></div>
    <p className="request-picker-help">Tick the boxes on the right and enter a quantity for each item. Choose the requestor, department and approver once below.</p>
    <div className="request-picker-filters"><Field label="Category"><select value={category} onChange={event => setCategory(event.target.value)}><option>All categories</option><option>Stationery</option><option>Pantry</option></select></Field><Field label="Search items"><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Item name, code or brand"/></Field></div>
    <div className="request-pick-list" role="group" aria-label="Items to request">
      <div className="request-pick-labels"><span>Item / available stock</span><span>Qty</span><span>Tick</span></div>
      {visibleItems.map(item => <div className={selected[item.id] !== undefined ? "request-pick-row selected" : "request-pick-row"} key={item.id}>
        <label htmlFor={"request-pick-" + item.id}><strong>{item.name}</strong><small>{item.category}{item.brand ? " · " + item.brand : ""} · {item.balance} {item.unit} available</small></label>
        <input className="request-line-qty" type="number" min={1} max={10000000} step={1} required={selected[item.id] !== undefined} disabled={selected[item.id] === undefined} aria-label={"Quantity for " + item.name} value={selected[item.id] ?? "1"} onChange={event => setSelected(previous => ({ ...previous, [item.id]: event.target.value }))}/>
        <input id={"request-pick-" + item.id} type="checkbox" aria-label={"Select " + item.name} checked={selected[item.id] !== undefined} onChange={event => toggle(item.id, event.target.checked)}/>
      </div>)}
      {!visibleItems.length && <p className="request-no-matches">No matching items. Try another search or choose Other below.</p>}
    </div>
    <label className="request-other-toggle"><span><strong>Other — item not in the list</strong><small>Add an unlisted item to the reorder list for review.</small></span><input type="checkbox" aria-label="Select Other item" checked={other} onChange={event => { setOther(event.target.checked); if (event.target.checked && !otherName.trim()) setOtherCategory(category === "Pantry" ? "Pantry" : "Stationery"); }}/></label>
    {lines.length > 0 && <div className="request-selection-summary" aria-label="Selected items"><strong>Selected items</strong><ul>{selectedItems.map(item => <li key={item.id}>{item.name} × {selected[item.id] || "?"} <button type="button" aria-label={"Remove selected " + item.name} onClick={() => toggle(item.id, false)}>×</button></li>)}{other && <li>Other: {otherName || "enter item name below"} × {otherQuantity || "?"}</li>}</ul><small>Selections are kept when you change category or search.</small></div>}
    {other && <div className="form-grid request-other-details"><div className="full"><Field label="Other item name *"><input required maxLength={120} value={otherName} onChange={event => setOtherName(event.target.value)} placeholder="Enter the item you need"/></Field></div><Field label="Brand"><input maxLength={120} value={otherBrand} onChange={event => setOtherBrand(event.target.value)} placeholder="Enter brand, if known"/></Field><Field label="Other category *"><select value={otherCategory} onChange={event => setOtherCategory(event.target.value)}><option>Stationery</option><option>Pantry</option></select></Field><Field label="Other quantity *"><input type="number" min={1} max={10000000} step={1} required value={otherQuantity} onChange={event => setOtherQuantity(event.target.value)}/></Field></div>}
    <h3 className="request-shared-heading">Request details — applies to all selected items</h3>
    <div className="form-grid"><Field label="Requestor *"><input name="requestor" required maxLength={120} placeholder="Your name"/></Field><Field label="Department *"><select name="department" required defaultValue=""><option value="" disabled>Select department</option>{departments.map(name => <option key={name}>{name}</option>)}</select></Field><div className="full"><Field label="Assigned approver *"><select name="assigned_approver" required defaultValue=""><option value="" disabled>Select approver</option>{approvers.map(name => <option key={name}>{name}</option>)}</select></Field></div><div className="full"><Field label="Notes"><textarea name="notes" rows={2} maxLength={500}/></Field></div></div>
  </fieldset>;
}
