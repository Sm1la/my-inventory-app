export type InsightItem = { id: string; code: string; name: string; category: string; unit: string; balance: number; minimum_stock: number; unit_price: number | string; expiry_date: string | null };
type InsightMovement = { item_id: string; kind: string; quantity: number; transaction_date: string };
type InsightRequest = { status: string; created_at: string };
export type StockFilter = "all" | "low" | "out" | "expiry" | "prices" | "units";
const DAY = 86400000;
const day = (date: string) => Date.parse(date + "T00:00:00Z");
export const unclearUnit = (unit: string) => !unit.trim() || /^\d+(?:[.,]\d+)?$/.test(unit.trim());
export function expiringSoon(item: InsightItem, asOf: string): boolean {
  return item.category === "Pantry" && item.balance > 0 && !!item.expiry_date && day(item.expiry_date) <= day(asOf) + 30 * DAY;
}
export function matchesStockFilter(item: InsightItem, filter: StockFilter, asOf: string): boolean {
  switch(filter) {
    case "low": return item.balance <= item.minimum_stock;
    case "out": return item.balance <= 0;
    case "expiry": return expiringSoon(item,asOf);
    case "prices": return Number(item.unit_price) <= 0;
    case "units": return unclearUnit(item.unit);
    default: return true;
  }
}
export function inventoryInsights(items: readonly InsightItem[], movements: readonly InsightMovement[], requests: readonly InsightRequest[], asOf: string) {
  const end=day(asOf), start=end-29*DAY;
  const out=items.filter(item=>item.balance<=0);
  const low=items.filter(item=>item.balance>0 && item.balance<=item.minimum_stock);
  const expiry=items.filter(item=>expiringSoon(item,asOf)).sort((a,b)=>(a.expiry_date ?? "").localeCompare(b.expiry_date ?? ""));
  const missingPrices=items.filter(item=>Number(item.unit_price)<=0);
  const unclearUnits=items.filter(item=>unclearUnit(item.unit));
  const usage=new Map<string,{quantity:number;events:number;dates:Set<string>}>();
  for(const move of movements) {
    const when=day(move.transaction_date);
    if(move.kind!=="issued" || !Number.isFinite(when) || when<start || when>end || move.quantity<=0) continue;
    const entry=usage.get(move.item_id) ?? {quantity:0,events:0,dates:new Set<string>()};
    entry.quantity+=move.quantity;entry.events++;entry.dates.add(move.transaction_date);usage.set(move.item_id,entry);
  }
  const usageItems=items.flatMap(item=>{
    const entry=usage.get(item.id); if(!entry) return [];
    // A cautious estimate: at least three issue events over two separate dates.
    const coverDays=entry.events>=3 && entry.dates.size>=2 && item.balance>0 ? Math.floor(item.balance/(entry.quantity/30)) : null;
    return [{item,quantity:entry.quantity,events:entry.events,coverDays}];
  }).sort((a,b)=>b.events-a.events || a.item.name.localeCompare(b.item.name));
  const coverageRisks=usageItems.filter(row=>row.coverDays!==null && row.coverDays<=30).sort((a,b)=>a.coverDays!-b.coverDays!);
  const pending=requests.filter(request=>request.status==="Pending");
  const pendingAges=pending.map(request=>{
    const timestamp=Date.parse(request.created_at);
    if(!Number.isFinite(timestamp)) return 0;
    const localDate=new Date(timestamp).toLocaleDateString("en-CA",{timeZone:"Asia/Kuala_Lumpur"});
    return Math.max(0,Math.floor((end-day(localDate))/DAY));
  });
  const healthy=items.length-out.length-low.length;
  return {total:items.length,healthy,healthPercent:items.length?Math.round(healthy/items.length*100):0,out,low,expiry,missingPrices,unclearUnits,usage:usageItems,coverageRisks,pending:pending.length,oldestPendingDays:Math.max(0,...pendingAges),windowStart:new Date(start).toISOString().slice(0,10),asOf};
}
