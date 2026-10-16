# Stock counts: selective recount and manager correction

Shelf counts are **blind**. Counters enter what they see without ever seeing system stock. Only approvers (members with `STOCK_APPROVE`: store managers, org owners, super admins) see the system figure and the differences, and only after the count is submitted.

When a submitted count has a few suspicious lines, the approver doesn't have to reject the whole aisle. There are two tools:

- **Selective recount:** send just those lines back to the counter. They stay blind.
- **Correction:** the approver changes a line's quantity themselves, with a required reason, when they have checked the shelf in person.

## Flow

```
DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED
                    │   ▲  └──reject──▶ REJECTED
     request recount│   │submit recount
     (chosen lines) ▼   │
                   RECOUNT
```

1. **Count.** The counter counts the aisle and submits. Each counted line snapshots `systemQty` and logs a `COUNT` revision.
2. **Review.** The approver sees counted, system and difference for every line, plus the line history.
3. **Recount** (`POST /stock/counts/:id/recount`). The approver picks lines and an optional note.
   - Those lines get `recountRequested = true` and the count moves to `RECOUNT`.
   - With `approveRest` (on by default), every other line is applied to stock immediately and marked `appliedAt`.
4. **Recount entry.** The counter sees only the flagged lines, with empty boxes. They never see their earlier number.
   - Entries go to `recountQty`, so the first count is never shown or overwritten while recounting.
   - Submitting needs every flagged line. It moves `recountQty` into `countedQty`, re-snapshots `systemQty` (sales may have happened since), logs a `RECOUNT` revision, clears the flags and returns the count to `SUBMITTED`.
5. **Correction** (`PUT /stock/counts/:id/lines/:storeProductId/correct`). Allowed while SUBMITTED, on lines not yet applied. A reason of at least 3 characters is required. It sets `countedQty` and logs a `CORRECTION` revision with the reason. The counter's figure stays in the history.
6. **Approve.** Applies `countedQty − systemQty` as a `COUNT` stock movement for every line not already applied.

A member who can both count and approve still auto-approves on submit, recount submits included.

## Data

- `StockCountStatus` adds `RECOUNT`.
- `stock_count_lines` adds `recount_requested`, `recount_qty` and `applied_at`.
- `stock_count_line_revisions` is append-only history: `kind` (COUNT, RECOUNT or CORRECTION), `qty`, `reason`, user, time. Lines from counts approved before this feature have no history.
- Migration: `20261016140000_stock_count_recount`.

## Who sees what (`GET /stock/counts/:id`)

| Viewer | DRAFT | RECOUNT | SUBMITTED, APPROVED or REJECTED |
|---|---|---|---|
| Counter | own numbers | **only the flagged lines**, blank until re-entered, no history | own numbers, read-only |
| Approver | blind like everyone | all lines plus system, difference, history, flags and applied state | same |

Corrections are approver-only data. A counter never sees a corrected number, so a correction can't hint at the system figure.

## Code

- `apps/api/src/services/stock-count-review.ts`: submit or recount submit, approve, request recount, correct line
- `apps/api/src/routes/stock/counts.ts`: routes
- `apps/api/src/routes/stock/count-view.ts`: what each viewer sees
- `packages/shared/src/schemas/index.ts`: `requestRecountSchema`, `correctCountLineSchema`
- Mobile: `apps/mobile/components/manage/stock/`
- Admin: `apps/admin/src/pages/stock-counts/`
- Seed: `apps/api/prisma/seed-manage-counts.ts` creates a submitted "Buffalo Ghee" count at Harur Fresh Mart, 12 lines with 3 off. Re-running replaces it.

## Tested with curl

- A counter's view has no system figures. Plain staff can't open counts, and counters can't request a recount (403).
- A correction without a reason is refused. A correction is logged with its reason.
- Recounting a line that was never counted is refused.
- **Recount request:** status changes to RECOUNT and the other lines are applied. The counter sees only the 2 flagged lines, blank, with the note.
- **Recount entry:** saving a line that isn't flagged is refused. Submitting with a flagged line missing is refused, and submitting with both entered works.
- **History:** the approver sees COUNT, then CORRECTION or RECOUNT.
- **Approval:** stock movements are applied only for lines with a difference. For example, a corrected line went 194 → 193 and moved −1, and lines that matched got no movement.

## Check by hand

- **Mobile:** select lines and send for recount, the recount banner and entry as counter@harur.dev, the line sheet history and correction as manager@harur.dev, the Recount tab and pill, and the Today "Counts to review" card after a resubmit.
- **Admin:** the same flows on the stock count page.
- **Not built yet:** a notification to the counter when a recount is requested. It's on the notification sweep backlog.
