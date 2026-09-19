# Validation audit — 2026-09-17

Scope: preorder, purchase orders (PO), and invoice import. This is a targeted audit, not exhaustive validation coverage. After the initial audit, preorder and invoice-import request validation were fixed. PO code and tests remain untouched.

## Follow-up fixes

- Validate nonempty item collections and every nested item on both creation and update.
- Reject quantities and conversion factors of zero or less; reject negative prices, deposits, line discounts and line totals.
- Return HTTP 400 for missing/blank customer information when no existing customer is selected.
- Preserve status-only preorder updates, zero deposits, zero-price items and manual invoice entries without a supplier code.
- Nested preorder items do not require a parent ID before the parent is created. The standalone item endpoint still requires that ID.

The original 14 failing API validation cases now pass. Preorder request regression tests cover 27 cases, invoice request regression tests cover 30 cases, and the existing invoice HTTP integration test covers 15 cases; all pass. The tagged run also passed the preorder, import_bill and purchase packages. The full default backend suite (`go test ./...`) passed after the changes. The new request tests now run in the default suite.

These fixes apply at the HTTP request boundary. This report does not claim exhaustive validation of every field or direct internal service/repository call.

The two previously reported frontend PO test expectation mismatches remain unchanged, consistent with the instruction to leave PO untouched.

## Initial audit results (before fixes)

| Suite | Result |
| --- | --- |
| Existing backend suites: preorder, purchase, import_bill | All three packages passed |
| Selected frontend suites | 168 passed, 2 failed |
| Import HTTP integration: TestImportBillHTTP | 8 passed, 7 failed |
| New preorder validation audit | 4 passed, 7 failed |

The regular backend test command excludes the import HTTP integration suite because it requires the `integration` build tag. Passing the regular suite does not establish that API validation is complete.

### Preorder

The new audit exercises the real Gin JSON binder, controller and service with an isolated repository spy. It does not use a live database or send notifications.

- Valid input and missing required type/status/date behaved as expected (4 cases).
- Missing items, empty items, zero quantity, negative quantity, negative price and negative deposit returned HTTP 201 and reached the repository write method (6 cases). This proves the controller/service accepts these inputs; this audit does not prove persistence in a production database.
- Missing customer ID and name was rejected without a write, but returned HTTP 500 instead of the expected HTTP 400 (1 case).

The item list lacks validation for a nonempty collection and recursive item checks. Quantity, price and deposit need appropriate numeric validation. Client-input errors also need an appropriate HTTP status.

### PO

All 33 frontend PO validation cases and the backend purchase package passed.

Two frontend `poService` tests failed: `normalizes pending preorders (wrapped=true/false)`. The implementation includes `supplier_part_code`, while the expected objects omit it. The test expectations and output shape disagree; this result alone does not indicate that PO input validation is broken. Neither file was changed.

### Invoice import

The existing HTTP integration suite uses local HTTP requests, an isolated SQLite database and a stub for external HTTP calls.

- Six malformed payload cases returned HTTP 201 and persisted a bill: empty items, missing item name, zero quantity, negative price, zero conversion factor and negative conversion factor.
- Negative quantity was rejected with HTTP 500 instead of expected HTTP 400.
- The other eight cases passed, including duplicate-import stock protection, employee price approval, authentication/role rejection, missing bill number, negative total, missing items and malformed JSON.

The outer item-list binding does not validate each nested item. Empty-list and numeric validation also need attention.

## Reproduce

From `backend`:

```sh
go test -count=1 ./internal/test/preorder ./internal/test/purchase ./internal/test/import_bill
go test -tags=integration ./internal/test/import_bill -run '^TestImportBillHTTP$' -count=1 -v
go test ./internal/test/preorder -run '^TestPreorder(Validation|UpdateAndItemValidation)$' -count=1 -v
go test ./internal/test/import_bill -run '^TestBillRequestValidation$' -count=1 -v
```

The original preorder audit was promoted into default regression tests in `backend/internal/test/preorder/preorder_validation_test.go`. The invoice request regressions are in `backend/internal/test/import_bill/import_bill_validation_test.go`. They assert rejection before writes and preserve supported valid flows. The existing invoice HTTP integration test remains opt-in through its build tag.

From the repository root:

```sh
npm --prefix frontend run test -- src/app/owner/pre-order/pre-order.test.tsx src/app/owner/purchase_orders/validation.test.ts src/app/owner/purchase_orders/hooks/usePreorder.test.tsx src/app/owner/import-bills/import_bill.test.tsx src/service/http/pre-order/pre-order.test.ts src/service/http/purchase_orders/po_service.test.ts src/service/http/import/import_service.test.ts
```

## Ownership check

No tracked PO files differ from HEAD. The six previously restored POS/entity files, including `backend/internal/app/dto/pos/pos_product_dto.go`, were byte-compared against HEAD and remain unchanged. Existing unrelated working-tree edits were preserved.

After the user's instruction to leave the friend's POS code untouched, `backend/internal/app/route/pos/pos_route.go` was also restored to HEAD. The separate reservation adapter remains in its own module but is no longer connected to the live POS routes. POS therefore uses its original available-stock and sale behavior; the new preorder reservation guard does not protect sales through those routes. Adapter tests verify the isolated module, not active POS integration.
