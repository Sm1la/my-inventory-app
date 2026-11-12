# OfficeStock

This project implements the office stationery and pantry workflow in PRD.md.

## Using the app

- Supply requests automatically use the signed-in account’s profile name (or login email if no name is saved). The requestor field is read-only while signed in, and submission rechecks the current account before saving the same requestor on every selected line. Anonymous demo requests retain a manual name field.

- Inventory has Stationery and Pantry submenu buttons. Selecting one filters the item list, updates the heading and defaults new items to that category. Clicking Inventory shows all categories.

- Add or edit an inventory item, including its opening balance, minimum level, supplier, price, expiry and location. Brand is available for both categories; pantry items have a Weight field (for example, 500 g or 1 kg), and stationery items have a positive whole-number Units per box field. These optional details appear in item rows, inventory reports, CSV exports and replenishment forms. Units per box is packaging information; it does not convert stock balances automatically.
- Receive stock has a required Stationery/Pantry category selector before the item dropdown. It defaults to the current inventory category or the item used to open the form. Changing category clears the previous item selection; only matching items can be received. Receive stock to increase its balance. Issue stock to decrease it. Overselling is rejected by the database.
- Department dropdowns in supply requests and stock receipts/issues list MD's Office, CEO Office, Finance, Kayin Holdings Sdn Bhd, Credit Control, HR & Admin, Investment Property and IT Department, in that order. Department is required for requests and issues, optional for receipts. Existing department values in saved records are preserved.
- Requests has Stationery and Pantry submenus. Each filters saved requests and sets the initial category of the New request checklist. The parent Requests button returns to all categories; CSV follows the selected list.
- When the requested item is missing, tick Other in New request and enter the item name, optional brand, category and quantity. The request appears under Requests/Approvals and in Reorder list → Other requested items (including its Stationery/Pantry filter and separate CSV export). Pending and Approved unlisted requests appear; rejected ones are excluded. This does not create inventory or change balances. A signed-in inventory manager uses Add to inventory to create and link the item atomically. The form is prefilled with the requested name/brand/category, zero opening stock and the requested quantity as its editable minimum. Approval is still required, stock must be received, and fulfilment then issues stock normally. Duplicate conversions and cross-workspace linkage are blocked.
- Request supplies supports multiple items in one submission: tick boxes on the right, enter a quantity per selected item, and enter Requestor, Department, Assigned approver and Notes once. Category/search filters retain existing selections, with a visible selection summary. Other can be included with existing inventory items. All selected rows are inserted in one database statement (all or none); each item then keeps its own approval/fulfilment status. Opening a fresh form starts a fresh selection.
- Requests and Approvals have right-hand tick boxes on pending rows and a select-all box for the current filtered view. Tick several rows, then Approve selected or Reject selected and review the list before confirming. Only selected pending rows visible in the current view are included. Any signed-in, verified Maznah, Ira or Sharmila account can decide regardless of assigned approver. Identity is derived by the database, including direct updates and the legacy single-request RPC. Decisions are atomic: any unavailable/already decided row aborts the entire batch. Rejections require a reason. Sharmila displays in the UI; her legacy stored label remains Mila for compatibility. The decision name and date are saved. Approval leaves stock unchanged; only an Approved request can be fulfilled, which deducts stock atomically. Completed decisions cannot be changed.
- Reorder list has a Request supplies button using the same multi-item checklist as Requests, including Other. Item choices follow the current Stationery/Pantry submenu and Other defaults to that category. Existing-item requests use the usual approval workflow; Other requests also enter the unlisted reorder queue.
- Reorder list includes items at or below their minimum level. Stationery and Pantry submenus filter that list, its heading and CSV export by category; clicking the parent Reorder list button shows all categories. Its category selection is independent of Inventory and Requests. Suggested orders target twice the minimum.
- Inventory and Reorder list have a Create form: stock below 3 button. It refreshes all qualifying balances from Supabase and generates a printable replenishment form addressed to sharmila@selangorproperties.com.my. Exactly 3 is excluded, regardless of the screen's search or category. Suggested quantities restore the greater of 3 or the item's minimum and can be edited. Downloading the HTML form does not place an order, alter stock or send email. As requested, this feature creates the form only; it does not send email.
- Reports shows an inventory table selected by All inventory, Stationery or Pantry, with opening, received, issued, current balance, minimum, status, location, supplier, price, value and expiry. Its summary and CSV export follow the selected category and search. This is a current stock snapshot using the complete ledger.
- Transactions shows a received/issued bar graph grouped by year, month or day, totals by transaction count, and the detailed movement table. Graph, totals, table and CSV follow the same date and search filters (including item codes). The graph counts transactions instead of combining incompatible stock units. Only periods with activity are plotted; no data displays an empty state. History loads the newest 5,000 records.
- Deleting a demo item deletes its associated requests and movements after confirmation. Export first if required. Opening stock is locked after the first movement.

## Inventory permissions and workspace access

Only confirmed Supabase accounts using the following exact addresses can add, edit or delete inventory items, receive/issue stock, or fulfil requests:

- Maznah: maznah.bahudin@selangorproperties.com.my
- Ira: nazira@selangorproperties.com.my
- Mila: sharmila@selangorproperties.com.my

The database checks the signed-in user ID against the verified Auth account email, not an editable display name or user metadata. Other visitors get a view-only inventory. Supply request creation and existing read/export/form features remain available. The UI uses the same signed-in Supabase browser client as login, with the existing workspace header added at request time. `docs/other-requests.sql` and `tests/other-requests.sql` record and verify the additive Other-request workflow. `docs/inventory-access.sql` records the permission migration: restrictive write policies are combined with workspace isolation, and the initializer only creates an empty workspace. Existing items, balances, requests and transaction history remain intact. New browsers no longer auto-create sample stock. Run `tests/inventory-access.sql` as one transaction; its fixture items/movements are rolled back. Manager test cases run for accounts already registered; Maznah and Ira must register and verify their emails before their access becomes active.

New registrations are restricted to the exact `selangorproperties.com.my` email domain (case-insensitive). The signup form shows “Kindly email your ID to sharmila@selangorproperties.com.my for verification” in red blinking text when an external email loses focus or is submitted. The animation respects reduced-motion preferences. The Auth API returns the same message for blocked domains. Supabase's enabled Before User Created Postgres hook calls `public.restrict_inventory_signup_domain(jsonb)` to enforce the same rule for direct Auth API calls; only Supabase Auth can execute the function. Subdomains and lookalike suffixes are rejected. Email confirmation remains required. Existing accounts and browser workspace isolation are preserved. `docs/signup-domain.sql` records the applied migration and the hook must remain enabled in Authentication → Auth Hooks.

The SPB-style login page is at `/login`, with Supabase email/password sign-in, Show/Hide password, `/signup`, `/forgot-password` and `/reset-password`. The inventory header links to sign-in and shows the signed-in email and sign-out control. The signed-in session authorizes inventory changes for the three named manager accounts and opens an account-linked workspace where configured. Approval names remain workflow labels.

Supabase's Site URL is configured as `https://my-inventory-app-smoky-three.vercel.app`, with the exact live `/auth/callback` and `/auth/callback?next=/reset-password` redirects allowed. Supabase uses default email templates; editing templates requires custom SMTP. Confirmation and recovery use PKCE via `/auth/callback`, so open links in the browser that requested them. If signup confirmation has already succeeded but the return fails, the account can still sign in with its password. Failed or reused confirmation links now show sign-in guidance and a `/verify-email` resend action rather than an unreachable localhost destination. Recovery failures return to the reset-email request form. Old emailed links cannot be repaired; use the live login page if already confirmed, otherwise request a new link and use only the latest email.

A working Supabase email sender is required for confirmation and reset emails. No test credentials are embedded in the app. IT Support displays contact guidance without inventing a support mailbox. Email confirmation remains enabled; no account is manually marked verified by this fix.

There is no login wall in this version, as required by AGENTS.md. The browser generates a random workspace UUID, stores it under `office-stock-workspace-v1`, and sends it in `x-workspace-id`. Supabase row-level security limits every table and balance view to that workspace. A workspace identifier acts as a capability: do not share it. For anonymous or unlinked accounts, clearing browser storage starts a new empty workspace. Linked accounts instead reload their saved inventory automatically from the server after sign-in, even in a new browser.

Linked accounts now open their saved workspace automatically across browsers. The backend stores a private, read-only account-to-workspace association and resolves it from auth.uid(), before considering any legacy browser header. The confirmed Sharmila account is linked to her existing inventory without copying or deleting any items or transactions. Anonymous visitors and unlinked accounts retain their legacy browser scope. Clients cannot create or change account-workspace links. `docs/account-workspaces.sql` records this migration. No service-role key is used in the browser.

Assigned approver is a routing label. Decision identity is verified against the three authorized accounts, independent of assignment; anonymous visitors and other staff cannot approve or reject. Existing pending requests remain intact and unassigned until a named decision is recorded.

## Database

`docs/database.sql` records the `create_inventory_demo` migration applied to the existing Supabase project. It creates four tables, a security-invoker balance view, a stock validation trigger, an opening-stock protection trigger, and atomic request fulfilment. No existing tables or data were removed.

`docs/approvals.sql` records the additive `add_named_supply_approvals` migration. It adds named assignment and decision fields, an Approved status, a named-decision RPC, and a trigger that prevents issuing unapproved requests even through direct status updates. Run `tests/approvals.sql` as one transaction for the approval integration suite; its rows are rolled back.

`docs/item-packaging.sql` records the additive `add_item_brand_weight_units_per_box` migration. It adds brand, weight and units-per-box columns, appends them to the security-invoker balance view and preserves existing balances and RLS policies.

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

`docs/batch-approvals.sql` records the verified batch approval RPC and updated decision trigger. `tests/batch-approvals.sql` tests atomic decisions, assignment independence, identity, unauthorized access and stock preservation in a rolled-back transaction.
