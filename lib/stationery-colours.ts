export const COLOURS: Record<string, readonly string[]> = {
  Paper: ["Blue", "Green", "Yellow", "Red", "Other"],
  "Ball pen": ["Black", "Blue", "Red"],
  "Marker pen": ["Black", "Red", "Blue", "Green", "Other"],
  Highlighter: ["Yellow", "Green", "Pink", "Lilac", "Blue"],
};
export function stationeryType(item: { name: string; category: string; stationery_type?: string }): string {
  if (item.category !== "Stationery") return "";
  if (item.stationery_type && COLOURS[item.stationery_type]) return item.stationery_type;
  if (/\bhighlighters?\b/i.test(item.name)) return "Highlighter";
  if (/\bmarkers?\b/i.test(item.name)) return "Marker pen";
  if (/\bball\s*point\b|\bball\s*pens?\b/i.test(item.name)) return "Ball pen";
  if (/\bpaper\b/i.test(item.name) && !/\bclips?\b/i.test(item.name)) return "Paper";
  return "";
}
export function fixedColour(item: { name: string; category: string }): string {
  if (item.category !== "Stationery") return "";
  if (/^A4\s+Paper\s*\(White\)$/i.test(item.name.trim())) return "White";
  const variant = /^(?:A4\s+)?Colou?r\s+Paper\b.*[—-]\s*(Blue|Green|Yellow|Red)\s*$/i.exec(item.name.trim());
  return variant ? variant[1][0].toUpperCase() + variant[1].slice(1).toLowerCase() : "";
}
export function defaultColour(item: { name: string; colour?: string; category: string; stationery_type?: string }): string {
  if (fixedColour(item)) return fixedColour(item);
  if (item.colour) return item.colour;
  const choices = COLOURS[stationeryType(item)] ?? [];
  return choices.find(colour => colour !== "Other" && new RegExp("\\b" + colour + "\\b", "i").test(item.name)) ?? "";
}
export function validateColour(kind: string, value: string, required = false): string {
  const colour = value.trim();
  if (!colour && !required) return "";
  if (!colour || colour === "Other" || colour.length > 60 || !COLOURS[kind] || (!COLOURS[kind].includes(colour) && !COLOURS[kind].includes("Other"))) throw new Error("Choose a valid colour" + (COLOURS[kind]?.includes("Other") ? " or enter the Other colour." : "."));
  return colour;
}
