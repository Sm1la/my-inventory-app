"use client";

import { useState } from "react";

type Item = { id: string; name: string; code: string; brand: string; category: string; balance: number; unit: string };
type Props = { items: Item[]; initialCategory: string; initialItemId?: string; today: string; receivedBy: string | null; departments: readonly string[]; busy: boolean; onCreateItem: () => void };

export default function StockReceiptFields({ items, initialCategory, initialItemId, today, receivedBy, departments, busy, onCreateItem }: Props) {
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>(() => initialItemId ? { [initialItemId]: "1" } : {});
  const selectedItems = items.filter(item => selected[item.id] !== undefined);
  const visibleItems = items.filter(item => (category === "All categories" || item.category === category) && `${item.name} ${item.code} ${item.brand}`.toLowerCase().includes(search.toLowerCase()));
  function toggle(id: string, checked: boolean) {
    setSelected(previous => { const next = { ...previous }; if (checked) next[id] = "1"; else delete next[id]; return next; });
  }
  return <fieldset disabled={busy} className="request-fields">
    <input type="hidden" name="receipt_lines" value={JSON.stringify(selectedItems.map(item => ({ item_id: item.id, quantity: Number(selected[item.id]) })))}/>
    <label className="field receipt-date"><span>Date received *</span><input name="transaction_date" type="date" required defaultValue={today} max={today}/></label>
    <div className="request-picker-heading"><h3>Tick items received</h3><span aria-live="polite">{selectedItems.length} selected</span></div>
    <p className="request-picker-help">Tick the items, enter the quantity received for each, then save. All selected items use the date above.</p>
    <div className="request-picker-filters"><label className="field"><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option>All categories</option><option>Stationery</option><option>Pantry</option></select></label><label className="field"><span>Search items</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Item name, code or brand"/></label></div>
    <div className="request-pick-list" role="group" aria-label="Items received">
      <div className="request-pick-labels"><span>Item / current stock</span><span>Qty received</span><span>Tick</span></div>
      {visibleItems.map(item => <div key={item.id} className={selected[item.id] !== undefined ? "request-pick-row selected" : "request-pick-row"}>
        <label htmlFor={"receipt-pick-" + item.id}><strong>{item.name}</strong><small>{item.category}{item.brand ? " · " + item.brand : ""} · {item.balance} {item.unit} in stock</small></label>
        <input className="request-line-qty" type="number" min={1} max={10000000} step={1} required={selected[item.id] !== undefined} disabled={selected[item.id] === undefined} aria-label={"Quantity received for " + item.name} value={selected[item.id] ?? "1"} onChange={event => setSelected(previous => ({ ...previous, [item.id]: event.target.value }))}/>
        <input id={"receipt-pick-" + item.id} type="checkbox" aria-label={"Receive " + item.name} checked={selected[item.id] !== undefined} onChange={event => toggle(item.id,event.target.checked)}/>
      </div>)}
      {!visibleItems.length && <p className="request-no-matches">No matching items. Change the category or search, or create a new item below.</p>}
    </div>
    {selectedItems.length > 0 && <div className="request-selection-summary" aria-label="Selected receipts"><strong>Stock to add</strong><ul>{selectedItems.map(item => <li key={item.id}>{item.name} + {selected[item.id] || "?"} {item.unit} <button type="button" aria-label={"Remove receipt for " + item.name} onClick={() => toggle(item.id,false)}>×</button></li>)}</ul><small>Selections are kept when you change category or search.</small></div>}
    <details className="receipt-details"><summary>Optional details</summary><div className="form-grid"><label className="field"><span>Received by</span><input name="requestor" defaultValue={receivedBy ?? ""} readOnly={!!receivedBy} maxLength={120}/></label><label className="field"><span>Department</span><select name="department" defaultValue=""><option value="">Select department</option>{departments.map(name => <option key={name}>{name}</option>)}</select></label><label className="field full"><span>Notes</span><textarea name="notes" rows={2} maxLength={500}/></label></div></details>
    <button type="button" className="button receipt-create" onClick={onCreateItem}>＋ Create a brand-new item</button>
  </fieldset>;
}
