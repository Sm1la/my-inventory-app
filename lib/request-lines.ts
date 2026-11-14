import { stationeryType, validateColour, fixedColour } from "./stationery-colours";
export type RequestLine = {
  item_id: string | null;
  requested_colour: string;
  other_name: string | null;
  other_brand: string;
  other_category: string | null;
  quantity: number;
  notes?: string;
  rubber_stamp?: { type: string; size: string; details: string; colour?: string };
};

export function requestNotes(line: RequestLine, sharedNotes: string): string {
  const notes = [line.notes, sharedNotes.trim()].filter(Boolean).join("\n\n");
  if (notes.length > 500) throw new Error("Stamp details and shared notes together must be 500 characters or fewer. Shorten the notes and try again.");
  return notes;
}

export function readRequestLines(value: string, items: ReadonlyArray<{ id: string; name?: string; category?: string; stationery_type?: string }>, requireColours = false): RequestLine[] {
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { throw new Error("Select at least one item to request."); }
  if (!Array.isArray(raw) || !raw.length) throw new Error("Tick at least one item to request.");
  const available = new Set(items.map(item => item.id));
  const seen = new Set<string>();
  return raw.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("Please check your selected items.");
    const row = entry as Record<string, unknown>;
    if (typeof row.quantity !== "number" || !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 10000000) {
      throw new Error("Enter a whole-number quantity from 1 to 10,000,000 for each selected item.");
    }
    const item = items.find(item => item.id === row.item_id);
    const kind = stationeryType({ name: item?.name ?? String(row.other_name ?? ""), category: item?.category ?? String(row.other_category ?? ""), stationery_type: item?.stationery_type });
    const requested_colour = requireColours && kind ? fixedColour({name:item?.name ?? String(row.other_name ?? ""),category:item?.category ?? String(row.other_category ?? "")}) || validateColour(kind,typeof row.requested_colour === "string" ? row.requested_colour : "",true) : "";
    const key = row.rubber_stamp ? "__rubber_stamp__" : row.item_id === null ? "__other__" : JSON.stringify([row.item_id,requireColours && kind === "Highlighter" ? requested_colour : ""]);
    if (seen.has(key)) throw new Error("Each item can only be selected once.");
    seen.add(key);
    if (row.rubber_stamp) {
      const stamp = row.rubber_stamp as Record<string, unknown>;
      const size = typeof stamp.size === "string" ? stamp.size.trim() : "";
      const details = typeof stamp.details === "string" ? stamp.details.trim() : "";
      if (row.item_id !== null || !["Ink pad", "Self ink rubber stamp"].includes(String(stamp.type)) || !size || size.length > 40 || !details || details.length > 300) {
        throw new Error("Choose a rubber stamp type, enter its size (up to 40 characters) and details (up to 300 characters).");
      }
      const colour = stamp.type === "Self ink rubber stamp" ? stamp.colour : "";
      if (stamp.type === "Self ink rubber stamp" && colour !== "Black" && colour !== "Blue") throw new Error("Choose Black or Blue for the self ink rubber stamp.");
      return { item_id: null, requested_colour: "", other_name: "Rubber stamp — " + stamp.type, other_brand: "", other_category: "Stationery", quantity: row.quantity, notes: (colour ? "Ink colour: " + colour + "\n" : "") + "Size: " + size + "\nStamp details: " + details };
    }
    if (row.item_id === null) {
      const name = typeof row.other_name === "string" ? row.other_name.trim() : "";
      const brand = typeof row.other_brand === "string" ? row.other_brand.trim() : "";
      if (!name || name.length > 120 || brand.length > 120 || !["Stationery", "Pantry"].includes(String(row.other_category))) {
        throw new Error("Enter the Other item name and select Stationery or Pantry.");
      }
      return { requested_colour, item_id: null, other_name: name, other_brand: brand, other_category: String(row.other_category), quantity: row.quantity };
    }
    if (typeof row.item_id !== "string" || !available.has(row.item_id)) throw new Error("A selected item is no longer available. Refresh and try again.");
    return { requested_colour, item_id: row.item_id, other_name: null, other_brand: "", other_category: null, quantity: row.quantity };
  });
}
