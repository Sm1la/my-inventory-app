const SIZES: Record<string,string> = { "ST-LIST-014-2X2": "2″ × 2″", "ST-LIST-014-2X3": "2″ × 3″", "ST-LIST-014": "3″ × 3″" };
export function stickyNoteSize(item: { code: string; category: string }): string {
  return item.category === "Stationery" ? SIZES[item.code] ?? "" : "";
}
export function stickyNoteVariants<T extends { code: string; category: string }>(items: readonly T[]): T[] {
  return Object.keys(SIZES).flatMap(code => items.filter(item => item.code === code && !!stickyNoteSize(item)));
}
