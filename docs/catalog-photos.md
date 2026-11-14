# Item reference photos

The current shared inventory has 45 real Stationery items and 12 Pantry items. Each now has a locally hosted product reference photo, indexed by item code in `lib/catalog-photos.json`. Uploaded manager photos always take priority and remain in the existing private Supabase bucket. The retained temporary verification item keeps its uploaded test photo.

Reference photos identify product types and named brands where available; exact supplier packaging, colours, quantities and sizes may differ. They do not certify the product physically held in the office. The interface labels references, shows a larger preview, links to the source and advises staff to check saved item details. Inventory managers can upload their actual product photos to replace references.

`docs/catalog-photo-sources.json` records every selected source page, original image URL, item code and saved image hash. Assets are optimised to 360 × 360 JPEG images and hosted from `public/catalog-photos`, so browsers do not hotlink retailer images. No balances, prices, requests or existing uploaded photos were changed.

Reference photos appear through the shared photo resolver in inventory, request and receipt pickers, grouped paper/size choices, approvals and My requests. Newly created item codes without an indexed reference retain the category placeholder until a manager uploads a photo.

Validation: `node tests/catalog-photos.cjs` checks all 57 files, category counts, source records and uploaded-photo precedence. The import helper `scripts/prepare-catalog-photos.cjs` can rebuild references from the recorded public sources; historical URLs may change, so review results before publishing replacements.
