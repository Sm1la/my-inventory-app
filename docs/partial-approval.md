# Approve a requested quantity in part

Approvers can enter an approved quantity for each selected pending request. Requested quantity remains immutable. Approved quantities range from zero to the requested quantity: zero rejects that row, and a positive quantity approves that amount. A shared reason is required whenever any row is reduced or rejected. The normal Reject action continues to reject every selected row with approved quantity zero.

The unapproved remainder is closed for that request; this feature does not create a backorder. Users can submit another request later if needed. The approval screen shows current stock to help the approver decide, but approval does not reserve stock or prevent approval before restocking. The existing issue transaction still checks available stock at fulfilment.

Only the saved approved quantity is issued when a manager marks the request ready. The request list, My requests tracker and request CSV show requested and approved amounts separately. Collection confirmation continues to record receipt without issuing stock again.

Existing Approved/Fulfilled requests retain their original full quantity as approved, Rejected requests receive zero, and Pending requests remain undecided. Existing full-approval RPCs remain compatible. New quantity decisions are validated in the database, require the verified manager role, obey workspace isolation, lock rows in stable order and save the entire batch atomically. Approved quantities cannot be changed after a decision.
