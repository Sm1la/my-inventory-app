import { fixedColour } from "./stationery-colours";
export const PAPER_REQUEST_COLOURS = ["Blue", "Yellow", "Red", "Green"] as const;
export function paperRequestVariants<T extends { name: string; category: string }>(items: readonly T[]): T[] {
  return PAPER_REQUEST_COLOURS.flatMap(colour => items.filter(item => item.category === "Stationery" && /^A4\s+Colou?r\s+Paper\b/i.test(item.name) && fixedColour(item) === colour));
}
