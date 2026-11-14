type SearchItem = { name?: string; code?: string; brand?: string; colour?: string; category?: string; supplier?: string; location?: string; weight?: string | null; unit?: string; stationery_type?: string };
export function normaliseSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/colours?/g,'color').replace(/ballpoint/g,'ball pen')
    .replace(/post[\s-]*it/g,'sticky notes').replace(/×/g,'x')
    .replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/)
    .map(word=>({pens:'pen',markers:'marker',highlighters:'highlighter',reams:'ream',pads:'pad',notes:'note'}[word] ?? word)).join(' ');
}
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const terms=normaliseSearch(query).split(' ').filter(Boolean);
  if(!terms.length) return true;
  const text=normaliseSearch(fields.filter(Boolean).join(' '));
  if(terms.every(term=>text.includes(term))) return true;
  // Match a complete item code entered without its separators.
  const compact=normaliseSearch(query).replaceAll(' ','');
  return compact.length>=3 && fields.some(field=>field && normaliseSearch(field).replaceAll(' ','')===compact);
}
export function searchInventory(item: SearchItem, query: string, extra = ''): boolean {
  return matchesSearch(query,item.name,item.code,item.brand,item.colour,item.category,item.supplier,item.location,item.weight,item.unit,item.stationery_type,extra);
}
