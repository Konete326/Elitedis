# ELITE DIST — System Requirements Document (SRD)
## Master PRD v1.0 Aligned System Architecture & Control Specifications

---

## 1. System Overview & Commercial Rollout Architecture
ELITE DIST is a multi-tenant cloud-native distribution operations platform tailored for Pakistan FMCG distributors (`DUA` initial reference tenant) and engineered for scalable SaaS commercialization.

### 1.1 Three-Phase Platform Architecture
1. **Phase 1 — DUA Reference Tenant Operations:** Full operational coverage across inventory batches, `Warehouse -> Zone -> Area` hierarchies, purchase movements, beat booking, delivery dispatch, doorstep invoice editing, recovery cash handover, operational accounts, and the 15 official system reports.
2. **Phase 2 — Commercial Multi-Tenant SaaS:** Independent distributor workspaces scoped strictly by `distributorId`. Central Platform Super Admin governs tenant provisioning (`public signup gated as Coming Soon`), official system reports, official print/invoice templates, and curated sharing of anonymized custom report templates across tenants.
3. **Phase 3 — Future Marketplace Compatibility (Out of Current Release Scope):** Marketplace and direct retailer B2B ordering modules are **excluded from v1.0 baseline** (**PRD §29**), but core `Product`, `Company`, `Brand`, `Territory`, and `Customer` identifiers remain normalized for future compatibility.

### 1.2 Requirement Classification & Completeness Governance
- Every system capability maps to a PRD classification: `Existing`, `Confirmed`, `Extended`, `Recommended`, `Pending`, or `Out of Scope`.
- Any workflow or tab flagged **`Coming Soon`** (`Tax Group`, incomplete `Scheme Group` sections, `HRM History & Reports`, `HRM Payroll & Salary`, `HRM Attendance & Leaving`, public `/register`) **MUST** block backend execution (HTTP `501` / feature guard if invoked directly) and open `<ComingSoonModal />` in the UI until schemas, formulas, and tests are formally approved (**PRD §1.3, §30.2**).

---

## 2. Multi-Tenancy, Security & 13-Point RBAC Architecture
### 2.1 Strict Tenant Isolation (`distributorId`)
- `authMiddleware` decodes verified JWT session claims and binds `req.user` and `req.tenantId`.
- `tenantMiddleware` enforces `{ distributorId: req.tenantId }` on every MongoDB query, update, aggregation pipeline, and Cloudinary folder path (`elite_dist_erp/{distributorId}/...`).
- **Template Sanitization Boundary (`PRD §21.2, §25`):** When custom report templates or print layouts are promoted to platform-shared status (`isSharedCustomTemplate: true`), the platform strips all tenant IDs, customer records, rate values, and transactional references—only structural column/filter/layout definitions are reusable.

### 2.2 Thirteen-Point Permission Matrix (`PRD §20.4`)
Every employee user carries role templates + fine-grained `permissions` checked in backend middleware and frontend guards:
1. `moduleAccess` (enable/disable across the 16 main navigation parts)
2. `screenAccess` (route-level route guard)
3. `canView` (read endpoints)
4. `canCreate` (POST endpoints)
5. `canEdit` (PUT/PATCH endpoints)
6. `canDelete` (DELETE endpoints + historical/zero-stock guards)
7. `canSubmit` (finalizing drafts / submitting orders, deals, recoveries)
8. `canApprove` (approving Pending Orders, Stock Adjustments, Receiving Put-Away)
9. `canStockMovement` (executing transfers, purchases, adjustments, put-away)
10. `canPayment` (collecting customer recoveries, recording company payable disbursements, field expenses)
11. **`purchasePriceVisibility`** *(Mandatory field-level & projection RBAC guard: when `false`, backend strips/masks `purchaseRate`, `traderRate`, `purchaseValue`, `batchCost`, `stockCostValuation`, and margin fields from API JSON payloads and UI tables)*
12. `reportAccess` (filtering accessible reports among the 15 Official Reports & Custom Reports)
13. `assignedWarehouseIds[]` (limits stock visibility & movements strictly to assigned warehouse(s) unless empty/`allWarehouses` for Admin)

### 2.3 Work Assignments & UI Work Parts (`PRD §20.1–20.3`)
- **Operational Work Assignments:** `Recovery`, `Booking`, `Stock Keeper`, `Wholesaler`, `POS Keeper`.
- **UI Work Parts / Workspace Presets:** `Order Booker`, `Warehouse`, `POS`, `Normal Invoice`, `Advance Invoice`, `Salesman`.

---

## 3. Core Domain Engines & Non-Negotiable System Rules
### 3.1 Granular 5D Distribution Authorization Engine (`PRD §4.4–4.5`)
- Companies carry `associatedBrands`, `authorizedProducts`, `territoryArrangements`, and `companyAccountInfo`.
- **No Separate Supplier Master:** Company and Brand capture principal supply context; `PurchaseMovement.supplierContext` stores company-linked contact context without an external vendor master.
- Every order line, dispatch assignment, and territory catalog filter verifies authorization across:
  $$\text{Company} \times \text{Brand} \times \text{Product} \times \text{Territory} \times \text{Area}$$
- Brand-level authorization NEVER implies unrestricted area rights for every SKU under that brand.

### 3.2 Product Master & 8-Step Unit Versioning Engine (`PRD §5.3, §5.7`)
- **SKU Granularity:** Distinct sizes/weights/flavors (`500g`, `1kg`, `2kg`) are distinct `Product` documents.
- **Purchase Price Optionality:** `Product` creation/editing never requires `purchaseRate`. Real cost originates from `PurchaseMovement` into `StockBatch.purchaseRate`.
- **Selling Channel Flags:** Orders filter catalog by `bookingPermission: true`; POS filters strictly by `posPermission: true`.
- **Unit Versioning Lifecycle (8 Invariants):**
  1. Packaging spec updates append a new `unitVersion` subdocument (`versionNo`, `packingUnit`, `conversionQty`, `packingWeightKg`, `effectiveFrom`, `status: 'ACTIVE_DEFAULT'`).
  2. Existing `StockBatch` records remain bound forever to their immutable `unitVersionId` and snapshot `conversionQty`.
  3. Multiple versions (e.g., `v1: 48 pcs/ctn`, `v2: 50 pcs/ctn`) coexist cleanly in inventory and order selectors.
  4. Dispatch, return, and stock ledger conversions compute base units using the **allocated batch's** `conversionQty`.
  5. Historical batch cost and invoice line metrics never mutate when a new unit version is added.
  6. New `PurchaseMovement` entries default to the latest active unit version.
  7. Zero retroactive recalculation runs against closed movements, orders, or reports.
  8. When `SUM(StockBatch.currentBaseQty)` across all batches referencing `v1` reaches `0`, the system marks `v1` retired (`DEPLETED`) and promotes `v2` cleanly as the sole default.

### 3.3 Warehouse (`Warehouse -> Zone -> Area`), Conditions & Issue Policies (`PRD §6–7`)
- **Official Storage Hierarchy:** Every location strictly resolves along `Warehouse -> Zone -> Area` (`ZoneType`: `Normal`, `Mix`, `Temperature`, `Cold Store`; `StorageType`: `Damage`, `Normal`, `Mix`, `Expiry`; `AreaType`: `Floor`, `Rack`, `Walked`).
- **Physical vs Environmental vs Stock Conditions:**
  - Warehouse environmental condition (`Freeze`, `Normal`, `Temperature`) is physically decoupled from `StockBatch.condition` (`FRESH`, `NORMAL`, `DAMAGE`, `EXPIRE`, plus optional `customConditionLabel` supplementary tag that never overrides official system conditions).
- **Stock Issue Policy (`Distributor.stockIssuePolicy`):**
  - `FIFO`: Sort eligible batches (`status in ['NORMAL', 'LOW', 'WARNING']`, `condition in ['FRESH', 'NORMAL']`, `availableBaseQty > 0`) by `purchaseDate ASC, createdAt ASC`.
  - `FEFO`: Sort eligible batches by `expDate ASC` (excluding already expired stock).
  - `Manual`: Require explicit batch ID selection in allocation payload.
- **Stock Formula:** `availableBaseQty = currentBaseQty - reservedBaseQty`.
- **4-Step Zero-Stock Deletion Guard:** Backend blocks DELETE on `Warehouse`, `Zone`, or `Area` with `400` if any descendant `StockBatch` has `currentBaseQty > 0` or an open `PendingTask` exists.

### 3.4 Stock Movements, Purchase Receiving & Cost Isolation (`PRD §8–9`)
- **9 Official Movement Types:** `Purchase`, `Delivery`, `Transfer`, `Adjustment`, `Expiry & Damage Back`, `Recovery`, `POS Sale`, `Custom Sale`, `Customer Sale`.
- **Inter- vs Same-Warehouse Transfer:** Same-warehouse relocates `Source Zone/Area -> Destination Zone/Area -> Put-away` with zero accounting impact; Inter-warehouse issues `Transfer Pending` task (`Print Dispatch`) and validates actual `receivedQty` with shortage/excess log on confirmation.
- **Physical Stock Count:** Stores `systemQty`, `physicalCountQty`, `differenceQty = physical - system`, and post-approval `updatedBalance`.
- **5-Step Purchase Receiving:** `Purchase Received -> Check & Received (Expected vs Received + MFG/EXP discrepancy check) -> Move & Put Away (segregated Normal / Damage / Expire) -> Create Movement -> Purchase Movement Result (24 fields)`.
- **Purchase Return & Company Payable:** Purchase Returns link directly to source `PurchaseMovement` / `StockBatch`, decrement batch stock, and credit `CompanyPayableLedger` (`Purchases − Returns − Payments Made = Outstanding Payable`).
- **General Business Expenses Isolation:** `Loading`, `Transport`, and `Other` general expenses write to `GeneralExpense` / `OperationalLedger` and **never distribute into `StockBatch.purchaseRate`**.

### 3.5 Multi-Shop CRM, Territory/Beat & Independent Booker Visits (`PRD §10–12`)
- **Multi-Shop Owner Grouping:** Multiple `Customer` records share `ownerGroupKey` / `ownerPhone`, preserving separate `customerId`, payment conditions (`Paid`, `Credit`, `Advance`), contacts (`Shopkeeper`, `Accountant`, `Store Keeper`), payment accounts, and shop ledgers.
- **Territory & Beat:** Territories support `Brand Wise`, `Warehouse Wise`, `District Wise`, `Booker Wise` with `Accept / Non Accept` customer lists; Beats connect `Booker`, `Beat Day`, `Areas`, `Routes`, and `Customers` with Beat Duplication and `Today Booking` summaries.
- **Independent Visit Completion:** Booker check-in completes the stop with status tag **`Visited`** regardless of whether a booking, sale, or payment occurred. **`Booking Skip`** generates a structured skipped booking log without marking the stop unvisited.

### 3.6 Order Execution, Doorstep Deal Immutability, Skips & Cash Handover (`PRD §13–16`)
- **Order Modes:** Supports verified sources (`Online`, `Booker`, `Admin`, `Official`), `Write Your Own` ad-hoc customer mode (`isWriteYourOwnCustomer: true`), pre-flight outstanding/credit/blocked validation, Two-Level Invoice calculation engine, and immutable `ruleApplicationSnapshot`.
- **Client Deal 3-Stage Architecture (`PRD §15.3`):**
  1. `originalInvoiceSnapshot`: Captured permanently at order approval/dispatch; read-only forever (**Report `22.13`**).
  2. `editInvoiceDeltas`: Doorstep `Edit Invoice` ops (`qty change`, `Item Return/Cancel` [`Return`, `Damage`, `Expire`], `Extra Item`, `Extra Return` [`OK`, `SKIP`], `Grand Level Edit`).
  3. `finalInvoice`: Post-edit settled document (**Report `22.14`**), feeding `Delivery Sales Movement` (**Report `22.8`**).
- **`Sales Skip` (`§15.9`) & `Recovery Skip` (`§16.7`):** Neither skip option silently disappears or logs as a `$0` completed sale/payment. Each creates a formal Result record (`SalesResult` / `RecoveryResult` with `resultType = 'SKIP'`) visible on `Salesman Sheet Reports` and `Recovery Sheet Reports`.
- **Recovery Expenses & Cash Handover (`§16.8`):**
  $$\text{Total Due Cash} = \text{Cash Collections} - (\text{Gas/Petrol} + \text{Enjoyment} + \text{Works})$$
  $$\text{Shortage / Extra} = \text{Total Cash Received} - \text{Total Due Cash}$$
  Field expenses never reduce customer receivables or pose as customer payments.

### 3.7 Operational Accounts vs. Excluded Double-Entry GL (`PRD §17, §29`)
- Operational accounting manages **10 real-time operational record types** (`Customer Ledger`, `Recovery Ledger`, `Invoice Ledger` [specifically classified into the **5 official types**: `Extra Return`, `Extra Item`, `Extra Discount`, `Charge Off`, `Paid Payment`], `Company-Wise Payable Ledger`, `Payment History`, `Outstanding`, `Recovery Result`, `Purchase Payment History`, `General Expense Records`, `Cash/Payment Account Records`).
- **Explicitly De-Scoped (`§29`):** `Journal Entries`, `Trial Balance`, `Balance Sheet`, `Conventional General Ledger`, `PR`, `PO`, `Supplier Master`, and `Marketplace` are excluded from active baseline APIs and navigation.

---

## 4. Reporting, Idempotency & Historical Immutability Requirements
1. **Dual Reports Governance (`§21–23`):** All **15 Official Reports (`22.1–22.15`)** execute against verified transactional collections using the exact formulas in PRD §22–23 and honor the **20 Global Filter Dimensions** + `purchasePriceVisibility` masking.
2. **Idempotency Across 7 Critical Writes (`§26.4`):** Every POST/PUT mutation across `Purchase movements`, `Stock movements`, `Payments`, `Orders`, `Sales results`, `Recovery results`, and `Adjustments` requires a client-generated `idempotencyKey` checked against an indexed idempotency store / unique compound key to guarantee zero double-posting under retries or flaky mobile networks.
3. **Historical Immutability (`§3.3`):** Updates to Product packing specs, purchase rates, Rule groups, or Customer master addresses MUST NOT mutate past `StockBatch`, `StockMovement`, `Order`, or `SaleInvoice` snapshots.
4. **Desktop `100dvh` & Mobile Field Readiness:** `<AppShell />` locks desktop height to `100dvh` with paginated tables (`5`/`10` rows) and switches seamlessly to `< 768px` Mobile Stacked Cards + `<TouchKeypadModal />` for Bookers, Salesmen, Recovery Crew, and Warehouse Staff.
