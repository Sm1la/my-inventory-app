# Shared approval queue

Requests no longer require an assigned approver. New requests store `assigned_approver: null` and all pending requests are visible in the common Approvals queue without an assignment filter. Maznah, Ira or Sharmila may approve or reject directly, including partial quantity decisions. The database derives and saves the signed-in manager in `decided_by`; staff cannot choose or impersonate an approver. No permission or database schema changes are needed.

The request table shows the three eligible approvers while pending and the actual decision maker afterward. CSV exports use Decision by rather than an assigned name. Historical assignment values remain saved but do not restrict approval. Existing requests, decisions, stock quantities and transaction history are preserved. The first-login demo describes the shared queue.

Validation: the isolated PostgreSQL approval suite now starts requests with no assignment, then checks the manager guard, partial approval, zero rejection, atomic decisions and issuing only approved quantities. It does not create test requests or sessions in the live database.
