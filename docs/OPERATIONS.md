# OfficeStock

This project implements the office stationery and pantry workflow in PRD.md.

## Using the app

- Add or edit an inventory item, including its opening balance, minimum level, supplier, price, expiry and location.
- Receive stock to increase its balance. Issue stock to decrease it. Overselling is rejected by the database.
- Department dropdowns in supply requests and stock receipts/issues list MD's Office, CEO Office, Finance, Kayin Holdings Sdn Bhd, Credit Control, HR & Admin, Investment Property and IT Department, in that order. Department is required for requests and issues, optional for receipts. Existing department values in saved records are preserved.
- Create a supply request and assign Maznah, Ira or Mila. In Approvals, filter by assigned name, approve with optional comments or reject with a required reason. The decision name and date are saved. Approval leaves stock unchanged; only an Approved request can be fulfilled, which deducts stock atomically. Completed decisions cannot be changed.
- Reorder list includes items at or below their minimum level. Suggested orders target twice the minimum.
- Inventory and Reorder list have a Create form: stock below 3 button. It refreshes all qualifying balances from Supabase and generates a printable replenishment form addressed to sharmila@selangorproperties.com.my. Exactly 3 is excluded, regardless of the screen's search or category. Suggested quantities restore the greater of 3 or the item's minimum and can be edited. Downloading the HTML form does not place an order, alter stock or send email. As requested, this feature creates the form only; it does not send email.
- Reports shows an inventory table selected by All inventory, Stationery or Pantry, with opening, received, issued, current balance, minimum, status, location, supplier, price, value and expiry. Its summary and CSV export follow the selected category and search. This is a current stock snapshot using the complete ledger.
- Transactions retains date filters and CSV export for stock movement history. History loads the newest 5,000 records.
- Deleting a demo item deletes its associated requests and movements after confirmation. Export first if required. Opening stock is locked after the first movement.

## Demo access model

The SPB-style login page is at `/login`, with Supabase email/password sign-in, Show/Hide password, `/signup`, `/forgot-password` and `/reset-password`. The inventory header links to sign-in and shows the signed-in email and sign-out control. These authenticate an account; they do not yet replace the demo workspace access model below or verify approver identity.

Supabase's Site URL is configured as `https://my-inventory-app-smoky-three.vercel.app`, with the exact live `/auth/callback` and `/auth/callback?next=/reset-password` redirects allowed. Supabase uses default email templates; editing templates requires custom SMTP. Confirmation and recovery use PKCE via `/auth/callback`, so open links in the browser that requested them. If signup confirmation has already succeeded but the return fails, the account can still sign in with its password. Failed or reused confirmation links now show sign-in guidance and a `/verify-email` resend action rather than an unreachable localhost destination. Recovery failures return to the reset-email request form. Old emailed links cannot be repaired; use the live login page if already confirmed, otherwise request a new link and use only the latest email.

A working Supabase email sender is required for confirmation and reset emails. No test credentials are embedded in the app. IT Support displays contact guidance without inventing a support mailbox. Email confirmation remains enabled; no account is manually marked verified by this fix.

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
