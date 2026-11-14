# First-login quick demo

Signed-in shared-inventory users without an acknowledgement see a five-step demo after inventory finishes loading. Existing accounts see it on their first visit after this feature is released. It covers finding supplies, requesting multiple items and tracking/collecting them. Verified inventory managers also receive approval and stock guidance.

Next and Back only navigate the demo. Illustrative request rows are labelled as examples and do not create transactions. Finish and Skip save a versioned acknowledgement to the signed-in account; the demo then stays dismissed across browsers. Escape behaves as Skip. Save errors keep the dialog open with a retry message. Quick demo in the sidebar reopens it without resetting saved progress.

`docs/first-login-tour.sql` creates the account-owned acknowledgement table. Only active, verified authenticated accounts can read or insert their own acknowledgement; no client update/delete grants are provided. Conflict-ignore inserts allow replay or concurrent tabs without overwriting the first acknowledgement. No inventory or request data is changed by the demo.

Final message: “If you want further information, kindly contact Sharmila. Thank You :D”
