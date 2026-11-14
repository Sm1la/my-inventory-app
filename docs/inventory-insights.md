# Inventory workspace and insights

The workspace includes stock health, actionable stock filters, expiry alerts, approval age, restock suggestions, recent usage and record quality checks. Insights use saved inventory and the latest 5,000 movements and requests loaded by the app. Refresh reloads these records. No external AI or paid service is required; recommendations never place orders or change balances.

- Stock health: percentage of item types above their saved minimum. Low stock includes items at their minimum; the low filter also includes empty items.
- Pantry expiry: in-stock items already expired or expiring within 30 days, using the Kuala Lumpur calendar date. Items without an expiry date cannot be assessed.
- Restock suggestion: twice the saved minimum minus current balance, with at least one stock unit suggested. Check pack sizes and actual demand before ordering.
- Usage: last 30 calendar days including today. Only positive issued quantities count. Items rank by issue-event frequency, never by adding quantities in different units.
- Stock coverage: balance divided by average daily recorded issues over 30 days, rounded down. Shown only with at least three issue events across two dates and estimated cover of at most 30 days. This is a simple historical estimate, not a demand forecast.
- Record quality: prices of zero or below, and empty or purely numeric unit labels. These flags do not alter existing records.
- Approval age: calendar days since the oldest pending request, in Kuala Lumpur time.

Existing permissions, item variants, requests and receipt workflows are preserved. Insight actions filter existing items or open the existing request and approval workflows. Styling supports narrow screens and reduced motion.
