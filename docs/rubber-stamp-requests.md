Rubber stamp requests
====================

In Requests → New request, tick Rubber stamp. Choose Ink pad or Self ink rubber stamp, then enter quantity, size/dimensions and custom specifications (wording, layout, ink colour, shape or other requirements). Existing inventory items and an Other item can be requested in the same submission.

Rubber stamps use the existing unlisted Stationery request flow. Type is saved in other_name; size and custom details are saved in the request's notes, together with any shared notes. Approval and Stationery reorder tables show those specifications; the reorder CSV includes them. No stock changes until a manager links the request to inventory and fulfils it. No database schema change is needed.

Validation: size is required (40 characters maximum), custom details are required (300 maximum), quantity is a positive whole number, and the combined specifications/shared notes must fit the existing 500-character note limit. Details are never silently truncated. Requestor and approval authorization remain unchanged.

Checks: node tests/rubber-stamp-requests.cjs; node tests/stationery-colours.cjs; TypeScript; production build; live request form inspection.
