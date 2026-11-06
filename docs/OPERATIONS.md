# OfficeStock

This project implements the office stationery and pantry workflow in PRD.md.

## Using the app

- Add or edit an inventory item, including its opening balance, minimum level, supplier, price, expiry and location.
- Receive stock to increase its balance. Issue stock to decrease it. Overselling is rejected by the database.
- Department dropdowns in supply requests and stock receipts/issues list Corporate, Finance, HR & Admin, Project, Credit Control, Investment Property, IT Department and Philanthropist. Department is required for requests and issues, optional for receipts. Existing department values in saved records are preserved.
- Create a supply request and assign Maznah, Ira or Mila. In Approvals, filter by assigned name, approve with optional comments or reject with a required reason. The decision name and date are saved. Approval leaves stock unchanged; only an Approved request can be fulfilled, which deducts stock atomically. Completed decisions cannot be changed.
- Reorder list includes items at or below their minimum level. Suggested orders target twice the minimum.
- Reports shows an inventory table selected by All inventory, Stationery or Pantry, with opening, received, issued, current balance, minimum, status, location, supplier, price, value and expiry. Its summary and CSV export follow the selected category and search. This is a current stock snapshot using the complete ledger.
- Transactions retains date filters and CSV export for stock movement history. History loads the newest 5,000 records.
- Deleting a demo item deletes its associated requests and movements after confirmation. Export first if required. Opening stock is locked after the first movement.

## Demo access model

There is no login wall in this version, as required by AGENTS.md. The browser generates a random workspace UUID, stores it under `office-stock-workspace-v1`, and sends it in `x-workspace-id`. Supabase row-level security limits every table and balance view to that workspace. A workspace identifier acts as a capability: do not share it. Clearing browser storage starts a new demo workspace. Different browsers do not share inventory.

Use sample data only. Shared employee inventory requires a later authentication and role-based authorization sprint. Do not use this demo for real staff records. No service-role key is used in the browser or required by this implementation.

The approver names are recorded workflow labels, not verified identities. Anyone with access to a demo workspace can select its assigned approver name; real approver-only access requires authenticated staff accounts. Existing pending requests remain intact and unassigned until a named decision is recorded.

## Database

`docs/database.sql` records the `create_inventory_demo` migration applied to the existing Supabase project. It creates four tables, a security-invoker balance view, a stock validation trigger, an opening-stock protection trigger, and atomic request fulfilment. No existing tables or data were removed.

`docs/approvals.sql` records the additive `add_named_supply_approvals` migration. It adds named assignment and decision fields, an Approved status, a named-decision RPC, and a trigger that prevents issuing unapproved requests even through direct status updates. Run `tests/approvals.sql` as one transaction for the approval integration suite; its rows are rolled back.

Balance = opening stock + receipts - issues. The item row is locked while each movement is validated, preventing concurrent over-issuance. Movements are append-only through the public API. Workspace policies, check constraints and foreign keys apply to direct API access as well as the UI.

## Development and deployment

1. Install Node.js 24 and run `npm ci`.
2. Configure `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the existing project. Never commit `.env.local`.
3. Run `npm run typecheck`, `npm run build`, then `npm start`.
4. Commit and push to GitHub main. Deploy the committed Git source to the existing Vercel project; never deploy a divergent local snapshot.

## Verification performed

- TypeScript and production build.
- SQL integration checks under the anonymous API role, rolled back after testing: sample initialization, balance calculation, oversell rejection, request fulfilment, duplicate-fulfilment rejection, opening-stock protection and cross-workspace isolation.
- Supabase security advisors: no findings after migration.
- Browser against live Supabase: create item with opening 10, receive 5, issue 3, fulfil request for 2, verify final balance 10; export report CSV; delete disposable test item and its history.
