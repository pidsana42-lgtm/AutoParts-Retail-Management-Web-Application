# Claim and return validation audit — 2026-09-17

The initial audit added a separate test file and this report. After the user requested fixes, claim/return validation and the relevant frontend tests were updated. Existing unrelated working-tree changes were preserved. POS and PO files remain unchanged.

## Follow-up: fixed and verified

- All 12 original API validation failures now pass.
- The real-controller/service/repository regression suite now covers 42 creation, update and standalone-item cases against isolated SQLite, including duplicate product rows and products outside the original sale. These tests run in the default backend suite.
- Claim creation validates the entire item batch against sold quantities under the sale-order lock before saving a header. Standalone additions and edits lock their claim parent and include sibling quantities in the same check.
- Request validation rejects empty collections, negative money fields, fractional claim quantities and unsupported refund methods. Existing return method aliases and the legacy item-list field remain supported.
- Claim responses include the saved items. Both approval buttons are disabled for empty claims.
- Frontend tests use the current button labels and confirm approval/rejection dialogs before asserting writes. Their existing checks for single submission, failures and unchanged status remain in place.
- `go test ./...`: passed.
- Selected frontend claim/return suites: **95 passed, 0 failed**.
- The seven restored POS/entity files still match HEAD exactly; no tracked POS or PO files differ from HEAD.

Coverage remains targeted: the SQLite suite does not validate PostgreSQL concurrency or exhaustively cover supplier claims and all financial rules. This change does not redesign the existing multi-step claim/stock transaction flow.

## Additional lifecycle follow-up

An additional 24 regression cases in `claim_return_lifecycle_validation_test.go` pass, bringing the two new claim/return validation suites to 66 cases. `go test ./...` passed again after this follow-up. No frontend code was changed in this follow-up; the latest frontend result remains 95 passing cases from the preceding run.

- General claim create/edit endpoints now enforce the same manager approval boundary as the dedicated approval endpoint. Customer roles cannot mutate customer claims. Unknown statuses are rejected and accepted status spelling is normalized.
- Employee forms may echo PENDING while editing details; the server ignores this echoed status on updates so a stale form cannot undo an approval. Client-supplied `approved_by` is ignored by the general header-edit endpoint.
- Approved/rejected/refunded returns cannot be reset to PENDING. Refunded documents cannot be edited. The repository rechecks persisted state under its row lock, rejecting a stale edit after a refund commits.
- Refund execution revalidates item presence, product membership and aggregate quantities against the original sale before money or stock writes. Invalid persisted items yield HTTP 400 with no payment or stock changes.
- Repeated claim approvals issue replacement stock once. Repeated refund calls create one payment, one stock movement and one refund contribution to the daily summary in the tested sequential retry scenarios.

These tests use isolated SQLite and staged stale edits; they do not constitute a PostgreSQL parallel-concurrency stress test. POS and PO files were checked again and remain unchanged.

Run the additional suite from `backend`:

```sh
go test ./internal/test/return -run '^(TestClaimStatusWriteValidation|TestReturnLifecycleValidation)$' -count=1 -v
```

## Initial results (before fixes)

| Suite | Passed | Failed |
| --- | ---: | ---: |
| Existing backend claim and return suites | Both packages passed | 0 |
| Existing selected frontend suites | 83 | 12 |
| New claim API creation audit | 6 | 7 |
| New return API creation audit | 8 | 5 |

Passing the existing backend suite did not establish complete input validation. The new audit exercises real controllers, services and repositories with HTTP recorder requests and isolated SQLite databases. It supplies an EMPLOYEE auth context directly, uses a completed sale with five units, and verifies persisted header/item counts and unchanged stock. It does not call a live database or notification service. The SQLite fixture adapts the PostgreSQL date-column type only in the test database.

## API issues found before fixes

All twelve failing audit cases returned HTTP 201 and persisted a document when rejection with HTTP 400 was expected.

Customer claims:

1. Empty item list: a header is saved without items.
2. Fractional quantity (`0.5`): accepted despite integer storage for item quantities.
3. Negative unit price: accepted and used in the calculated claim amount.
4. Negative claim amount: accepted.
5. Negative refund amount: accepted.
6. Negative replacement cost: accepted.
7. Quantity exceeding the original sale: six units accepted against five units sold.

Returns created as an employee:

1. Missing item list: a header is saved without items.
2. Empty item list: a header is saved without items.
3. Negative unit price: accepted and the item is saved.
4. Negative refund amount: accepted; the service recalculates the amount from valid items rather than rejecting the invalid input.
5. Unknown refund method (`INVALID`): accepted into a pending document.

The return audit did reject zero/negative quantities, quantities exceeding the sale, products not in the original sale, missing reasons and an invalid second item. Both the canonical and legacy item-list field names passed with valid input. The claim audit rejected missing order/items/reason and zero/negative quantities.

The initial results concerned document creation. The follow-up adds update and standalone-item coverage as described above.

## Initial frontend failures

| File | Passed | Failed | Observed reason |
| --- | ---: | ---: | --- |
| claim_approve.test.tsx | 0 | 7 | Tests look for `อนุมัติและปริ้นใบเคลม`; current buttons use `อนุมัติและพิมพ์ใบเคลม`. |
| claim_detail.test.tsx | 17 | 0 | — |
| claim_edit.test.tsx | 7 | 0 | — |
| claims.test.tsx | 5 | 0 | — |
| new_return.test.tsx | 10 | 0 | — |
| return_detail.test.tsx | 15 | 3 | Approval/rejection tests expect an immediate request; the current UI opens a confirmation dialog first. |
| returns.test.tsx | 8 | 2 | Approval tests do not confirm the dialog before asserting the request/result. |
| return_service.test.ts | 15 | 0 | — |
| useReturnSearch.test.ts | 6 | 0 | — |

After correcting the outdated interactions, the empty-claim approval test exposed enabled buttons; both were fixed. All 95 selected frontend tests now pass.

## Reproduce

From `backend`:

```sh
go test -count=1 ./internal/test/claim ./internal/test/return
go test ./internal/test/return -run '^TestClaimReturn(Validation|UpdateValidation)$' -count=1 -v
```

The separate file `backend/internal/test/return/claim_return_validation_audit_test.go` was promoted to the default suite by removing its build tag. It checks successful valid requests and rejection without database/stock changes for invalid requests.

From the repository root:

```sh
npm --prefix frontend run test -- src/app/owner/claim src/app/owner/return src/service/http/claim src/service/http/return
```

Raw frontend results: initial failures in `/tmp/autoparts-claim-return-validation.json`; passing results after fixes in `/tmp/autoparts-claim-return-validation-fixed.json`.
