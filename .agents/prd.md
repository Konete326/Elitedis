# ELITE DIST — Master Product Requirements Document (PRD)
## Version 1.0 — Final Baseline

| Document Field | Specification |
| :--- | :--- |
| **Product Name** | ELITE DIST |
| **Category** | Distribution Operations ERP & Sales Force Automation (SFA) |
| **Initial Target Market** | Pakistan FMCG Distributors |
| **Initial Reference Deployment** | DUA Distribution Deployment |
| **Commercial Model** | Multi-Tenant SaaS ERP |
| **Baseline Version** | Version 1.0 — Final Baseline |
| **Baseline Date** | 17 November 2026 |
| **Primary Stack Lock** | React 19 + Vite + Tailwind CSS + Node.js v20+ + Express.js + MongoDB Atlas + Cloudinary |

---

## 1. Document Control, Sources & Requirement Classification
### 1.1 Authoritative Source Documents
This Master PRD Version 1.0 is synthesized from and supersedes earlier draft summaries across:
1. `ERP System for Distributers.pdf` (285 pages — operational ERP screens and distributor workflows)
2. `Distribution ERP System (Word Mutiple Page Demo).pdf` (15 pages — supplementary workflow layouts)
3. `ELITE DIST PRD.pdf` (Version 0.1 baseline)
4. Formal business-owner and stakeholder confirmations (Pakistan FMCG distribution operations)

### 1.2 Requirement Classification Legend
Every feature, screen, rule, and report across ELITE DIST carries an explicit baseline classification:
- **Existing (`Existing`)**: Documented in baseline screens and verified in the current operational workflow.
- **Confirmed (`Confirmed`)**: Explicitly approved by the business owner during specification review (including DUA and Pakistan FMCG rules).
- **Extended (`Extended`)**: Necessary operational capability extending reference screens (e.g., Unit Versioning, Stock Issue Policy, Duplicate Prevention, Cash Handover).
- **Recommended (`Recommended`)**: Strongly advised operational control or architectural safeguard aligned with SaaS scale.
- **Pending (`Pending` / `Coming Soon`)**: Incomplete or deferred modules/sections not approved for live execution until fields, math, and test cases are completed.
- **Out of Scope (`Out of Scope`)**: Explicitly excluded from current baseline ERP scope (see **Section 29**).

### 1.3 Mandatory Completeness & `Coming Soon` Governance Rule
> **CRITICAL BASELINE RULE:** Presence of a screen, tab, or menu label in a reference PDF **DOES NOT** mean backend logic, validation formulas, or database persistence are complete. Any screen, section, or tab marked **`Coming Soon`** (or lacking approved schemas/calculations) **MUST** remain gated behind `<ComingSoonModal />` and treated as incomplete until formally designed, built, and verified.

---

## 2. Executive Summary & 3-Phase Commercial Strategy
ELITE DIST is a **distribution-centric operations ERP** engineered specifically for FMCG distributors managing multi-brand agency portfolios, batch/expiry warehousing, multi-shop retail/wholesale networks, order bookers, salesmen, cash recovery crews, and operational accounts.

### 2.1 Three-Phase Commercial Rollout Strategy
1. **Phase 1 — DUA Deployment (Production Reference Tenant):** Operationalize complete distribution workflows (inventory, warehouse zones/areas, purchase receiving, beat booking, delivery dispatch, doorstep salesman deal edits, recovery cash handover, operational accounts, and the 15 Official Reports) for DUA under strict `distributorId` isolation.
2. **Phase 2 — Commercial Multi-Tenant SaaS ERP:** Onboard independent paying FMCG distributor tenants with isolated `distributorId` workspaces, subscription controls, Super Admin provisioning, and centralized platform governance:
   - Founder/Platform Admin retains exclusive control over **Official ELITE DIST System Reports** and **Official Print/Invoice Templates**.
   - Authorized tenant-requested **User-Specific Custom Reports & Templates** can be approved and shared centrally across other tenants as structural templates **without ever exposing tenant business records, rates, stock, or customer data**.
3. **Phase 3 — Future Marketplace Expansion (Out of Current Release Scope):** Future B2B distributor-to-retailer marketplace capabilities are **excluded** from the current ERP baseline release (**Section 29**), though core SKU, batch, territory, and customer identifiers are structured to remain data-compatible.

---

## 3. Core Architecture, Distribution Principles & Historical Data Protection
### 3.1 Distribution-Centric Operational Philosophy
ELITE DIST is an operational distribution control engine—**not conventional double-entry accounting software**. Every financial balance in ELITE DIST arises directly from concrete operational events (Purchases, Deliveries, Doorstep Edits, Recoveries, Returns, Company Payments, General Expenses), guaranteeing zero disconnect between warehouse physical truth and customer/company operational balances.

### 3.2 Nine Core Operational Transaction Types
Every operational mutation creates an immutable transaction record carrying `transactionRef`, `transactionDate`, `preparedBy` / `assignedTo` (responsible users), `status`, and `sourceChannel`:
1. `Purchase movement` (Company inward receiving & batch creation)
2. `Stock transfer` (Inter-warehouse and Same-warehouse zone/area relocation)
3. `Stock adjustment` (Physical count / condition / quantity correction)
4. `Purchase receiving` (Check & Received, Expected vs Received comparison, segregated put-away)
5. `Delivery movement` (Order fulfillment dispatch to Salesman / Vehicle)
6. `Sales transaction` (Admin, Booker, POS, Custom/Customer, and Salesman Final Invoice settlements)
7. `Recovery transaction` (Cash/Bank/Wallet recovery collections, Recovery Skip, field expenses)
8. `Payment transaction` (Company-wise payable settlement disbursements & customer advance/invoice payments)
9. `Return transaction` (Doorstep item returns, Damage/Expire returns, Recovery extra returns, Purchase returns)

### 3.3 Historical Data Protection (Immutability Rules)
| Event in Master Setup | Historical Impact Rule | Enforcement Mechanism |
| :--- | :--- | :--- |
| Packaging / carton conversion changes (`48 pcs -> 50 pcs`) | MUST NOT alter stock quantities or historical batch conversions already recorded | Batch stores `unitVersionId` & snapshot `conversionQty` (`§5.7`) |
| Product purchase rate changes | MUST NOT alter costs/valuations of existing batches or historical purchases | Purchase rate lives per `StockBatch` & `PurchaseMovement` (`§5.3`, `§9.3`) |
| Tax / Discount / Charge / Scheme rules edited | MUST NOT recalculate previously finalized/delivered invoices or approved historical records | Order/Invoice persists immutable `ruleApplicationSnapshot` (`§18.8`) |
| Customer address, credit condition, or assigned route changes | MUST NOT rewrite historical addresses or snapshot customer metadata on past invoices | Invoice stores point-in-time `customerSnapshot` & `OriginalInvoiceSnapshot` (`§15.3`) |
| Report aggregation | MUST NOT inject unrelated manual balances or fabricated opening adjustments into system reports | All report figures derive strictly from immutable transactions (`§23`) |

---

## 4. Distributor Setup, Company, Brand & Granular Authorization
### 4.1 Distributor Workspace (`distributorId`)
Each tenant represents an independent distributor organization provisioned by the Super Admin (public self-signup is disabled/gated as `Coming Soon` during single-platform controlled onboarding). Each distributor defines stock issue policy (`FIFO`, `FEFO`, `Manual`), currency/date defaults, print layout metadata, and authorized warehouses.

### 4.2 Company Management (Principal Suppliers / Agencies)
Distributors represent FMCG companies/principals rather than maintaining a disconnected vendor database:
- **Required & Operational Fields:** Company Name, Code, `personName`, `contactNo`, Email/Address, `associatedBrands`, `authorizedProducts`, `territoryArrangements`, `companyAccountInfo` (bank/payment accounts & operational payable summary), Status.
- **Explicit Scope Rule (`§4.2`, `§9.1`, `§29`):** **No separate Supplier Registration Master** exists in baseline ELITE DIST. Any supplier/contact reference inside Purchase Entry is company-linked operational context under the chosen `Company` and `Linked Brand`.

### 4.3 Brand & Category Management
Brands belong strictly to a parent `Company`. Categories organize products cleanly inside authorized brands. SKUs can only be attached to active, distributor-authorized Companies and Brands.

### 4.4 Granular Distribution Authorization (`Company × Brand × Product × Territory × Area`)
Authorization **MUST NOT** assume that distribution rights for a Brand automatically grant rights for all Products under that Brand across every Territory or Area.
- Access & selling rules evaluate across 5 explicit dimensions:
  1. `Company`
  2. `Brand`
  3. `Product / SKU`
  4. `Territory` (`Brand Wise`, `Warehouse Wise`, `District Wise`, `Booker Wise`)
  5. `Area`
- An authorized SKU in Area A may be unauthorized in Area B even within the same Company and Brand. Both Order Booking and Delivery Assignment validate against this authorization matrix.

---

## 5. Product Master, Purchase Price RBAC & Unit Versioning
### 5.1 Variant-Per-SKU Rule
Every size, flavor, or pack configuration MUST exist as an independent SKU record (e.g., `Sufi Surf 500g`, `Sufi Surf 1kg`, `Sufi Surf 2kg`). Never collapse size variants into a single SKU with variable multipliers.

### 5.2 Product Master Fields & Multi-Unit Dimensions
- **Identity & Hierarchy:** `sku`, `barcode`, `itemCode`, `name`, `companyId`, `brandId`, `categoryId`, `image { url, publicId }`.
- **Units & Physical Specs:** `baseUnit` (`smallest indivisible saleable unit`, e.g., Piece, Sachet, Bottle), `packingUnits[]` (`Piece`, `Bottle`, `Dozen`, `Carton`, `Bag`, `Sack`, `Box`, custom conversions scoped strictly per product), `baseWeightKg`, `packingWeightKg = baseWeightKg × conversionQty`, physical `width`, `length`, `height` -> `Area = W × L`, `Volume = W × L × H`.
- **Selling Channels & 3-Tier Commercial Reference:**
  - `wholesaleRate` (Wholesale / Sale rate)
  - `posRate` (POS / Retail rate)
  - `traderRate` (optional commercial reference, governed by `§5.3`)
  - Explicit Permission Flags: **`posPermission`** (`Boolean`), **`bookingPermission`** (`Boolean`), `status` (`Active` / `Inactive`).

### 5.3 Purchase Price Restriction & Visibility RBAC (`§5.3` — Mandatory)
1. **Optional in Product Master:** Entering a `purchaseRate` MUST NOT be mandatory when creating or editing a Product SKU. Product catalog setup succeeds without purchase cost.
2. **Transaction Origin:** Authoritative purchase rates originate from **Purchase Movement / Batch Receiving** transactions (`§9.2`), where each `StockBatch` stores its exact cost at acquisition time.
3. **Strict Visibility RBAC:** Purchase rate columns, batch acquisition cost, stock cost valuation, and margin metrics MUST be **hidden in API projections and masked/omitted in UI** for any user lacking both Admin privileges and explicit `permissions.purchasePriceVisibility === true` (`§20.4`). Order Bookers, Salesmen, and standard Warehouse/POS operators must not see protected purchase cost data unless explicitly granted.

### 5.4 Unit Versioning Engine (`§5.7` — 8 Mandatory Behaviors)
When manufacturers change packing size (e.g., *Old Carton = 48 pcs* changes to *New Carton = 50 pcs*):
1. **Create New Unit Version:** System increments/creates a new versioned packing specification (`versionNo`, `conversionQty`, `effectiveFrom`, `isActiveDefault`) instead of overwriting existing specs.
2. **Preserve Old Version for Existing Stock:** Existing `StockBatch` documents keep pointing to their original `unitVersionId` and `conversionQty` (`48 pcs/ctn`).
3. **Clean Coexistence:** Multiple active versions (e.g., v1 `48 pcs` and v2 `50 pcs`) coexist concurrently in batch lists, picklists, and selectors until old stock clears.
4. **Batch-Specific Conversion Accuracy:** Converting cartons to base units during dispatch, returns, or valuation ALWAYS multiplies by that specific batch's `conversionQty`, never the global latest version.
5. **Cost & History Preservation:** All historical purchase costs, invoices, and stock ledgers retain their original unit version metrics untouched.
6. **Default New Version for New Purchases:** Newly created Purchase Movements automatically default to the latest active unit version (`50 pcs/ctn`).
7. **Zero Retroactive Recalculation:** Creating Unit Version v2 NEVER recalculates prior ledger quantities, historical deliveries, or valuation reports.
8. **Automatic Lifecycle Transition:** Once all batches linked to the older unit version reach `currentBaseQty === 0`, the new unit version becomes the sole active default across selling workflows.

### 5.5 Product Master Actions (`§5.8`)
Every Product row supports: `Active`, `Inactive`, `Duplicate` (clone SKU structure cleanly), `View`, `Edit`, `Delete` (**blocked with 400** if any transaction, order line, or `StockBatch.currentBaseQty > 0` exists), `Product Report`, `Assign Booker`, `Apply Rule`, and `POS and Booking permissions` toggles.

---

## 6. Batch Tracking, Inventory Valuation & Stock Control
### 6.1 Fourteen Mandatory StockBatch Fields (`§6.1`)
Every inward batch stores and exposes (subject to purchase-price RBAC):
1. `Batch ID` (`batchNo`)
2. `Product / SKU`
3. `Purchase date`
4. `MFG date`
5. `EXP date`
6. `Purchase rate` (restricted visibility)
7. `Purchase quantity` (initial base & packing qty)
8. `Unit` (linked to `unitVersionId` & `conversionQty`)
9. `Packing specification`
10. `Weight` (`packingWeightKg` / total weight)
11. `Remaining stock` (`currentBaseQty`, `reservedBaseQty`, `availableBaseQty`)
12. `Warehouse`
13. `Zone`
14. `Area`

### 6.2 Stock Issue Policy (`§6.3` — Configurable Per Distributor)
Distributor Admin configures default inventory allocation strategy in Distributor Settings:
- **`FIFO` (First-In, First-Out):** Allocates oldest batches first sorted by `purchaseDate` / `createdAt ASC`.
- **`FEFO` (First-Expired, First-Out):** Allocates batches nearest to expiration first sorted by `expDate ASC` (skipping expired batches for normal sale).
- **`Manual Batch Selection`:** Operator explicitly picks target batch(es) during order/dispatch allocation.
Every allocation/dispatch records which `stockIssuePolicy` selected the batch.

### 6.3 Core Stock Availability Formula (`§6.4`)
$$\text{Available Stock} = \text{Current Stock} - \text{Reserved Stock}$$
- `PENDING` order deducts nothing.
- `APPROVED` order atomically shifts `qty` from `availableBaseQty` into `reservedBaseQty` (`currentBaseQty` remains physically in the warehouse until dispatch).
- `CANCELLED` order atomically releases `reservedBaseQty` back to `availableBaseQty`.
- Actual delivery/dispatch deducts from both `currentBaseQty` and `reservedBaseQty`.

### 6.4 Stock Conditions & Custom Supplementary Labels (`§6.5`)
- **Official System Conditions:** `FRESH`, `NORMAL`, `DAMAGE`, `EXPIRE` (plus internal transition `DAMAGE_EXPIRE`).
- **Custom Labels Rule:** A distributor may define optional custom supplementary condition labels (e.g., *Box Torn*, *Heat Softened*) mapped onto an official condition for reporting clarity, **but custom labels MUST NEVER replace, rename, or delete the official system conditions**, and MUST remain strictly separate from **Warehouse Environmental Conditions** (`§7.6`).

### 6.5 Stock Statuses & Alerts (`§6.6–6.7`)
- **Batch/Stock Statuses:** `NORMAL`, `LOW`, `WARNING`, `OUT`, **`BLOCKED`**, and `QUARANTINED`. Stock in `BLOCKED`, `QUARANTINED`, `DAMAGE`, or `EXPIRE` is strictly excluded from normal sellable availability.
- **Configured Alerts:** Minimum Qty breach, Maximum Qty overstock, Low Stock alert, Warning threshold alert, Out-of-Stock alert, Expiry Warning / Expired batch alerts.

### 6.6 Inventory Reports Subset (`§6.8`)
Core Inventory module directly exposes: `Current Stock`, `Order Requirement`, `Expiry Report`, `Damage Return`, `Stock Valuation` (RBAC-filtered), and `Stock Count`.

---

## 7. Warehouse & Storage Hierarchy (`Warehouse → Zone → Area`)
### 7.1 Official Structural Hierarchy (`§7.2`)
ELITE DIST enforces a uniform **3-Tier Storage Hierarchy** everywhere across database models, API endpoints, UI breadcrumbs, and reports:
$$\text{Warehouse} \longrightarrow \text{Zone} \longrightarrow \text{Area}$$
*(Older draft references to `Section / Floor / Location` map directly into `Zone -> Area` with `areaType` specifying Floor/Rack/Walked).*

### 7.2 Warehouse Master (17 Fields & 8 Dashboard KPIs)
- **17 Warehouse Fields:** `name`, `code`, `type`, `contactInfo` (phone/email), `creationDate`, `manager` (assigned manager user), `status`, `address`, `city`, `province`, `country`, `zone` (count/summary), `area` (count/summary), `location`, `gpsCoordinates` (`lat/lng`), `completeAddress`, `assignedStaff[]`.
- **8 Warehouse Dashboard Metrics:** `Available Stock`, `Total Batches`, `Stock Value` (purchase-price RBAC aware), `Assigned Staff`, `Low-Stock Alerts`, `Storage Utilization (%)`, `Warehouses & Zones Count`, `Storage Areas Count`.

### 7.3 Zone Configuration (`§7.3–7.6` — 13 Fields)
- **Zone Types:** `Normal`, `Mix`, `Temperature`, `Cold Store`.
- **13 Fields:** `zoneCode`, `name`, `warehouseId`, `zoneType`, `sizeUnit`, `width`, `length`, `height`, `totalArea` ($W \times L$), `totalVolume` ($W \times L \times H$), `storageType`, `environmentalCondition`, `areasConfig`.
- **Storage Types (`§7.5`):** `Damage`, `Normal`, `Mix`, `Expiry`.
- **Environmental Conditions (`§7.6`):** `Freeze`, `Normal`, `Temperature` (physically distinct from Stock Conditions in `§6.5`).

### 7.4 Area Master & Product Allocation (`§7.7–7.8` — 12 Fields)
- **Area Types:** `Floor`, `Rack`, `Walked`.
- **12 Fields:** `areaCode`, `name`, `zoneId`, `warehouseId`, `areaType`, `storageType`, `condition` (environmental/allowed stock condition), `sizeLocation` (dimensions/bay coordinates), `allowedProducts[]`, `stockQty` (current base qty), `minQty`, `maxQty`.
- **Product Allocation Controls (`§7.8`):** `Select Item`, `Add Item`, `Minimum Quantity`, `Maximum Quantity`, `Edit`, `Cancel`, `Confirm`.

### 7.5 Four-Step Zero-Stock Deletion Guard (`§7.9`)
Deleting any `Warehouse`, `Zone`, or `Area` triggers a mandatory 4-step guard:
1. Check `SUM(StockBatch.currentBaseQty)` inside the target container (and descendant Zones/Areas).
2. If total `currentBaseQty > 0`, **block deletion (`400 Bad Request`)** listing active batch count and total units.
3. Instruct operator to complete a `Transfer` or `Adjustment` Stock Movement emptying all stock to `0`.
4. Allow deletion only once verified `currentBaseQty === 0` and no open `PendingTask` references the container.

---

## 8. Stock Movements, Transfers, Counts & Expiry/Damage Tasks
### 8.1 Official Movement Types (`§8.2`)
All stock movements categorize strictly under these types:
- `Purchase`
- `Delivery`
- `Transfer` (Inter-Warehouse & Same-Warehouse)
- `Adjustment`
- `Expiry & Damage Back`
- `Recovery` (Recovery Extra Return put-away)
- `POS Sale`
- `Custom Sale`
- `Customer Sale` *(standardized spelling replacing OCR `Costume Sale`)*

### 8.2 Twenty-One Preserved Movement Fields (`§8.3`)
Every `StockMovement` record retains: `movementId`, `movementType`, `sourceWarehouseId`, `sourceZoneId`, `sourceAreaId`, `destinationWarehouseId`, `destinationZoneId`, `destinationAreaId`, `productId`, `batchId`, `unit` + `unitVersionId`, `baseQty`, `packQty`, `weightKg`, `purchaseRate` (RBAC-filtered), `condition`, `status`, `preparedBy`, `assignedTo`, `dispatchedQty`, `receivedQty`, `differenceQty`, `timestamp`, `remarks` / `sourceTransactionRef`, plus `idempotencyKey`.

### 8.3 Inter-Warehouse vs. Same-Warehouse Transfer (`§8.4–8.5`)
- **Inter-Warehouse Transfer:** Origin dispatches stock with `Print Dispatch`, creates `Transfer Pending` task (`PendingTask`), destination confirms actual `receivedQty`, system logs any `differenceQty` (shortage/excess traceability) before committing final destination batch credit.
- **Same-Warehouse Transfer:** Relocates stock across `Source Zone/Area -> Destination Zone/Area -> Put-away -> Result`. Explicitly tagged internal relocation; NEVER creates purchase or sale financials.

### 8.4 Stock Adjustment & Physical Stock Count (`§8.6–8.7`)
- **Stock Adjustment:** Uses `Accept` / `Non Accept` review decisions, `Checklist Print`, creates `Pending Adjustment` task linked to audit log.
- **Physical Stock Count (`§8.7`):** Specifically captures:
  - `System Quantity`
  - `Physical Count Quantity`
  - `Difference Quantity` (`Physical - System`)
  - `Updated Balance` (post-approval balance)

### 8.5 Expiry & Damage Pending Tasks (`§8.8`)
Standardized transition workflows for deteriorating stock:
1. `Normal To Expire` (proactive quarantine approaching expiry)
2. `Normal On Expired` (expired batch isolation)
3. `Expired Return` (customer/delivery expired stock return inward)
4. `Damage & Expiry Back` (return/put-away into designated `Damage` / `Expiry` storage areas)

---

## 9. Purchase Movement, Receiving, Company Payable & General Expenses
### 9.1 Purchase Architectural Rule (`§9.1` & `§29`)
In ELITE DIST, Purchase is a **Movement Type (`Purchase`)**, NOT a multi-stage corporate procurement chain.
- **Explicitly Excluded:** `Purchase Request`, `Purchase Order`, and standalone `Supplier Registration Master`.

### 9.2 Purchase Entry Specification (`§9.2` — 18 Fields)
`Movement ID`, `Movement Type: Purchase`, `Prepared By`, `Assigned To`, `Company`, `Category`, `Linked Brand`, `Supplier/contact context` (company-linked text/contact reference, no separate master), `Product Code`, `Product Name`, `Batch ID`, `Unit` (auto-defaulting to latest active Unit Version), `Weight`, `Purchase Rate`, `MFG Date`, `EXP Date`, `Purchase Quantity`, `Warehouse`.

### 9.3 Batch Cost Isolation (`§9.3`)
Each created `StockBatch` stores its own `purchaseRate`, `purchaseDate`, and `unitVersionId` (`conversionQty`). Changing a product's future purchase rate never mutates older batches.

### 9.4 Five-Step Receiving Workflow (`§9.4`)
1. `Purchase Received` (initial inward manifest/movement creation)
2. `Check & Received` (physical inspection against manifest)
3. `Move & Put Away` (zone/area placement by condition)
4. `Create Movement` (atomic batch credit & audit log)
5. `Purchase Movement Result` (finalized 24-field output report)

### 9.5 Expected vs. Received Verification (`§9.5`)
Receiving verification compares line-by-line: `Product`, `Batch`, `MFG Date`, `EXP Date`, `Unit`, `Expected Qty`, `Received Qty`, and `Difference Qty`, flagging any **MFG/EXP discrepancy** or quantity shortage/excess before put-away finalization.

### 9.6 Segregated Put Away (`§9.6`)
At put-away, verified received quantity is partitioned cleanly across condition buckets into compatible Warehouse Zones/Areas:
- `Normal` quantity -> Normal/Mix Storage Area
- `Damaged` quantity -> Damage Storage Area (`DAMAGE` batch)
- `Expired` quantity -> Expiry Storage Area (`EXPIRE` batch)

### 9.7 Purchase Movement Result (`§9.7` — 24 Fields)
Preserves all 24 operational fields including `Dispatch Qty`, `Received Qty`, `Difference Qty`, `Purchase Qty`, `Base Value`, `Pack Value`, `Purchase Value` (purchase-price RBAC applied when viewing/exporting), batch metadata, company, destination storage hierarchy, and operator attribution.

### 9.8 Purchase Return (`§9.8`)
Returning goods to the principal company MUST link to the source `PurchaseMovement` / `StockBatch`: decrements stock & batch balance atomically, writes an operational credit/reduction in the **Company-Wise Payable Account**, and preserves full purchase return history.

### 9.9 Company-Wise Payable Account (`§9.9`)
Operational principal-company payable ledger tracking:
- `Purchases` (inward payable additions)
- `Purchase Returns` (payable reductions)
- `Payments Made` (settlement entries)
- `Outstanding Payable` (`Purchases − Returns − Payments Made`)
- Settlement metadata: `Payment Method`, `Payment Account`, `Ref No`, `Due Date`, `Remarks`, `Source Transaction`.
*(Note: Strictly an operational sub-ledger—NOT conventional double-entry GL).*

### 9.10 General Business Expenses Isolation (`§9.10`)
General operational expenses—`Loading`, `Transport`, and `Other general business expenses`—are recorded as separate `GeneralExpense` operational records (`§17.3`) and **MUST NEVER be automatically distributed/added into individual SKU/batch purchase rates**.

---

## 10. Customer Relationship Management (CRM) & Multi-Shop Ownership
### 10.1 Multi-Shop Under Single Owner (`§10.1–10.2`)
One business owner can own multiple physically and financially independent shops (e.g., *Owner: Haji Akram -> Shop 1 Orangi, Shop 2 Baldia, Shop 3 Qasba*).
- Each Shop gets a **separate `Customer ID`**, isolated outstanding balance, separate shop ledger, separate payment condition, and separate order/delivery/recovery history, while sharing an `ownerId` / `ownerName` grouping key for consolidated owner visibility.

### 10.2 Customer Profile, Contacts & Payment Accounts (`§10.3–10.4`)
- **15 Profile Fields:** `customerCode`, `shopName`, `ownerName`, `ownerPhone`, `customerType` (Retailer / Wholesaler / Key Account), `cnic` / `strn` / `ntn`, `areaId`, `routeId`, `streetAddress`, `gpsCoordinates`, `creditLimit`, `creditDays`, `paymentCondition`, `status`, `photo { url, publicId }`.
- **Multiple Contacts:** `Shopkeeper`, `Accountant`, `Store Keeper` (with name, phone, WhatsApp, primary flag).
- **Multiple Payment Accounts:** `Bank`, `Easy Paisa`, `Jazz Cash` accounts linked to customer for payment verification.
- **Conditions & Statuses:** Condition (`Paid`, `Credit`, `Advance`); Status (`Active`, `Inactive`, `Blocked`).

### 10.3 Customer Rule Assignment Controls (`§10.5`)
Customer master `Apply Rule` drawer exposes granular overrides: `Set Status`, `Set Payment Condition`, `Allow Credit`, `Assign Person` (Booker/Salesman), `Assign Tax`, `Assign Discount Group`, `Assign Scheme Group`, and `Apply Rules`.

---

## 11. Territory, Areas, Routes, Beats & Daily Beat Ops
### 11.1 Geographic Structure (`§11.1–11.2`)
- **Areas (10 fields):** `areaCode`, `areaName`, `city`, `district`, `province`, `warehouseId`, `territoryType`, `totalRoutes`, `totalCustomers`, `status`.
- **Routes (9 fields + Live Counts):** `routeCode`, `routeName`, `areaId`, `dayPreference`, `assignedBookerId`, `assignedSalesmanId`, `distanceKm`, `status`, `notes`, plus live computed **`Retailer Count`** and **`Wholesaler Count`**.

### 11.2 Territory Types & Approval (`§11.3`)
Four supported territory groupings: `Brand Wise`, `Warehouse Wise`, `District Wise`, `Booker Wise`. Each territory configuration displays `Selected Areas`, `Selected Routes`, `Accepted Customers`, and `Non-Accepted Customers` with explicit **`Accept`** / **`Non Accept`** toggle actions.

### 11.3 Beat Setup & Daily Beat Booking (`§11.4–11.5`)
- **Beat Fields:** `Beat ID`, `Beat Name`, `Assigned Booker`, `Beat Day`, `Connected Areas`, `Connected Routes`, `Connected Customers`, `Accept / Non Accept`, and **`Save` / `Duplicate Beat`** actions.
- **Daily Beat Ops Summary:** `Today Booking`, `Accepted Beat Details`, `Total Areas`, `Total Credited Customers`, `Total Paid Customers`, and **`Start Booking`**.

---

## 12. Booker & Visit Operations
### 12.1 Visited Customer List (`§12.1–12.2`)
Booker field screen displays: `Customer`, `Contact`, `Route`, `Street`, `Customer Status`, `Area Filter`, and live `Search`.

### 12.2 Independent Visit Completion Rule (`§12.3` — Non-Negotiable)
- A customer visit completes the moment the Booker physically visits / logs arrival at the shop.
- The final visit status tag MUST be **`Visited`**.
- **Visit completion is strictly independent of order booking, sales, or recovery collection:** A Booker can finish a valid `Visited` stop even if the shop places zero order and makes zero payment (`Booking Skip` or pure check-in).

### 12.3 Twelve Booker Field Actions (`§12.4`)
Booker mobile/desktop interface exposes: `Book`, `Recover`, `Payment`, `Cancel`, `Draft`, `Complete`, `Recovery Ledger`, `Extra Return`, `Recovery Payment`, `Check Result`, `Booking Complete`, and **`Booking Skip`** (which captures a structured skip reason without marking the customer unvisited).

---

## 13. Order Management, Invoice Styles & Calculation Engine
### 13.1 Order Sources, Types & Customer Modes (`§13.1–13.3`)
- **Verified Order Sources:** `Online`, `Booker`, `Admin`, plus `Official` (in Sales Master).
- **Order Types:** `Urgent`, `POS`, `Special`, `Regular`, `Normal`, `S. Dispatch` alongside `Normal Order` and `Advance Order` creation flows.
- **Customer Options During Order Creation:**
  1. `Select Customer` (existing CRM shop)
  2. `Create Customer` (inline quick CRM creation)
  3. **`Write Your Own`** (free-text ad-hoc customer name & contact/address stored on the order/POS invoice without requiring permanent CRM master creation)

### 13.2 Pre-Flight Customer Validation, Lines & Submission
- **Line Info (11 fields):** `Product`, `Batch / Policy`, `Unit & Unit Version`, `Quantity`, `Base Qty`, `Weight (kg)`, `Rate`, `Custom Sale Rate / Reverse Discount`, `Item Discount (Flat/%)`, `Item Charges (Rate/Qty/KG)`, `Item Tax/GST`, `Free Scheme Row` (zero rate, tracked weight), `Line Net`.
- **Customer Validation Indicators:** `Outstanding Balance`, `Customer Type`, `Warnings Info`, `Pending Order Warning`, `Credit Not Allow` lock, `Blocked` lock.
- **Order Summary (7 fields):** `Gross Subtotal`, `Total Item Discounts`, `Total Item Charges`, `Total Tax`, `Grand Discount`, `Grand Charges`, `Net Payable` (+ `Total Weight kg`).
- **4 Invoice Styles:** `Landscape`, `Chillan & Finance`, `Detailed Landscape`, `Advance Invoice`.
- **9 Submit Options:** `Submit`, `Submit & Assign`, `Print & Send`, `Send to Customer`, `Share`, `Copy Link`, `Assign`, `Select Person`, `Skip`.
- **5 Lifecycle Statuses:** `Pending`, `Approved`, `Delivery`, `Complete`, `Cancel`.
- **POS Guard:** Only products with `posPermission: true` appear/sell in POS; booking enforces `bookingPermission: true`.

### 13.3 Two-Level Invoice Calculation Engine
1. **Level 1 (Per-Line):** Rate by Unit Version -> Reverse Custom Sale Rate Discount calculation (`(UnitRate - CustomRate) / UnitRate * 100`) -> Item Discount (Flat or `%`) -> Item Charges (`by Rate`, `by Qty`, `by KG/Weight`) -> Item Tax/GST rule placeholder -> Free Scheme Rows (`rate = 0`, `weightKg` preserved for load planning).
2. **Level 2 (Grand Totals):** Sum Level 1 nets -> Grand Amount/Weight Discount (`General + Auto`, `Slab`, `% Auto`) -> Grand Charges -> Grand Target Schemes -> Final `Net Payable`.

---

## 14. Order Operations, Assignment & Delivery Planning
1. **`Pending To Approved` (`§14.1`):** `Pending Filtration`, `Approve Selected` (executes `FIFO`/`FEFO`/`Manual` stock reservation), `Check Order`, `Selected Order Summary`.
2. **`Approved Order & Credit Sales` (`§14.2`):** Segregated approval queue for credit-checked vs cash-on-delivery orders.
3. **`Assignment` (`§14.3`):** Generates and groups `Bills`, `Dispatch` manifests, `Sales Sheet`, `Recovery Sheet`, and batch `Print`.
4. **`Delivery Planning` (`§14.4`):** Supports `Normal Dispatch`, `Extra Dispatch` (van buffer stock), `Dispatch Received` confirmation, `Bill Received`, `Recovery Received`, and `Start Delivery`.
5. **`Delivery Dispatch` (`§14.5`):** 11 manifest columns (Product, Batch, Unit/Version, Dispatched Qty, Extra Qty, Sold Qty, Returned Qty, Damage/Expire Qty, Balance Load, Weight, Net Value) + `Complete`, `New Extra Item`, `Draft & Back`, with full discrepancy reconciliation when stock returns to warehouse.

---

## 15. Salesman Operations, Invoice Immutability & Sales Skip
### 15.1 Salesman Customer List (`§15.1–15.2`)
Displays `Customer List`, `Recovery Result`, `Sales Result`, `Extra Item`, `Draft & Back`, `Start Delivery`, and `Supply Complete`.

### 15.2 Client Deal Architecture & Original Invoice Immutability (`§15.3` — Critical)
Inside **Client Deal**, three distinct stages are maintained:
1. **`Original Invoice` (`immutableSnapshot`):** Locked forever at order approval/dispatch. **MUST NEVER be overwritten** when a salesman modifies quantities, returns items, or applies extra discounts at the shop doorstep.
2. **`Edit Invoice` (8 Doorstep Operations):** Tracked delta layer supporting quantity adjustment, rate/discount adjustments (`Grand Level Edit` — 16 fields), `Item Return/Cancel` (`Return`, `Damage`, `Expire` preserving exact existing reason/status enums), `Extra Item` (11 fields), `Extra Return` (13 fields including `OK`, `SKIP`), and `Extra Item Enter` / `Draft & Back`.
3. **`Final Invoice`:** Computed post-edit settled bill shown to customer and posted to `Delivery Sales Movement` (`Report 22.8`). Both `Original Invoice` (`Report 22.13`) and `Edited Invoice` (`Report 22.14`) remain auditable side-by-side.

### 15.3 Sales Skip Workflow (`§15.9` — 6 Mandatory Rules)
When a salesman visits a scheduled bill/shop and no sale occurs:
1. Salesman selects `Sales Skip` with mandatory structured reason/status.
2. Generates a formal `Sales Result` record flagged `resultType = SKIP`.
3. Links explicitly to both `customerId` and `salesmanId` (plus `dispatchId`/`orderId`).
4. Appears explicitly in `Salesman Sheet Reports` and `Delivery Sales Movement`.
5. Preserves exact existing skip reason and status options configured in master data.
6. **Never silently treated as a completed zero-amount sale** or deleted invoice.

### 15.4 Sales Closed & Supply Complete (`§15.10`)
Trip closure happens **strictly via explicit submit/complete action** after all assigned stops are settled/skipped, extra return stock is handed back to warehouse put-away, and the linked `PendingTask` is closed.

---

## 16. Recovery Operations, Recovery Skip & Cash Handover
### 16.1 Recovery Workflow (`§16.1–16.6`)
- **`Recovery Client List`:** Segmented by `Draft`, `Complete`, `Fresh` recovery tasks.
- **`Recovery Operation`:** Exposes `Recovery Ledger`, `Extra Return` (`Damage`, `Expire`, `Return`), `Recovery Payment`, `Put Away`, `Submit`, `SKIP`, and `Draft & Back`.
- **Split Payment Methods:** Single recovery stop can combine multiple payment lines (`Payment Method`, `Payment Account`, `Ref No`, `Due Date`, `Paid Amount`).

### 16.2 Recovery Skip (`§16.7`)
Triggering `SKIP` on a recovery client creates a traceable **`Recovery Result`** entry visible in **`Recovery Sheet Reports`** (`22.7` / `22.9`) with skip reason/status—never logged as collected cash or a cleared receivable.

### 16.3 Recovery Expenses & Cash Handover (`§16.8`)
- Field expense entry supports: **`Gas / Petrol`**, **`Enjoyment`**, **`Works`**, and **`Remarks`**.
- **Cash Handover Reconciliation Formula:**
  $$\text{Total Due Cash} = \text{Total Cash Collections} - \text{Approved Field Recovery Expenses}$$
  $$\text{Shortage / Extra} = \text{Total Cash Received} - \text{Total Due Cash}$$
- Field expenses appear explicitly in Cash Handover and `Delivery Sales Movement` (`Report 22.8`) and **MUST NEVER be silently deducted from or recorded as customer payments**.

---

## 17. Operational Accounts & Ledgers (vs. Excluded Conventional GL)
### 17.1 Distribution Operational Accounting Philosophy (`§17.1`)
ELITE DIST maintains real-time operational sub-ledgers tied directly to distribution transactions rather than a general corporate accounting suite.

### 17.2 Explicitly Excluded Accounting Constructs (`§17.2`, `§29`)
The following conventional accounting features are **EXCLUDED** from ELITE DIST v1.0 baseline:
- `Journal Entries` (manual debit/credit vouchers)
- `Trial Balance`
- `Balance Sheet`
- `Conventional General Ledger (Chart of Accounts)`
- `Double-entry posting system`
- `Conventional accounting voucher workflow`

### 17.3 Ten Supported Operational Account Records (`§17.3`)
1. `Customer Ledger` (per shop `customerId`)
2. `Recovery Ledger` (receivable & recovery settlement history)
3. `Invoice Ledger` (billing + 5 Invoice/Recovery Ledger event categories)
4. `Company-wise Payable Ledger` (Purchases, Returns, Payments Made, Outstanding Payable)
5. `Payment History` (customer inflows)
6. `Outstanding` (real-time shop & route receivable balances)
7. `Recovery Result` (collected vs skipped recovery outcomes)
8. `Purchase Payment History` (company outflows)
9. `General Expense Records` (`Loading`, `Transport`, `Other`, field recovery expenses)
10. `Cash / Payment Account Records` (per payment channel balances)
- **Supported Payment Methods:** `Cash`, `Check`, `Online`, `Bank account`, `Easy Paisa`, `Jazz Cash`.

---

## 18. Rules, Discount/Charge/Scheme Engines & Templates Master
### 18.1 Rule Master Four Tabs (`§18.1–18.8`)
1. **`Tax Group` (`Coming Soon!` — `§18.2`, `§30.2`):** Marked incomplete in Master PRD v1.0. Tax fields, tax computation engines, and tax tests MUST NOT be fabricated prematurely; tab routes to `<ComingSoonModal />` until tax specs are finalized. Existing `Tax Allow` / `GST` toggles in orders operate strictly as conditional rule references.
2. **`Discount Group` (`§18.3`):** Configured independently at `Product Level` and `Grand Level` (`Amount` or `Weight` basis; `General + Auto`, `Slab`, `Percentage Auto`).
3. **`Charge Group` (`§18.4`):** Configured at `Product Level` and `Grand Level` using comparison bases: `Rate`, `Quantity`, `KG/Weight`.
4. **`Scheme Group` (`§18.5` — Partial `Coming Soon!`):** Supports `Product Level` (`Same Product`, `Product Wise`, `Slab Scheme`) and `Grand Level` (`Target Wise` Amount/Weight). **Portions of Scheme Group marked `Coming Soon!` (`§30.2`)** MUST remain gated with `<ComingSoonModal />` until finalized.
- **`Invoice Rules` (`§18.6`):** Toggle switches `Discount Allow`, `Tax Allow`, `Rate Allow`, `Scheme Allow`, `Charges Allow`; modes `General + Auto`, `Advance General`, `Percentage Auto`, `Target Wise`, `Yes/No`.
- **Product vs. Grand Separation (`§18.7`) & Rule Snapshot (`§18.8`):** Level-1 product rules never collide silently with Level-2 grand rules; every submitted order/invoice saves an immutable Rule Application History snapshot.

### 18.2 Templates Master (`§18.9–18.15` — 4 Categories)
1. **`Print Layouts`:**
   - `Header`: Company Name, Logo, Address, Subject, Style, Urdu, English, Writing, Font, Line, Italic
   - `Footer`: Signature Lines, Position Sign, Page No, Print Date, Footer Line, Signatures
   - `Notes`: Subject, Note, Note Name, Important
2. **`Invoices`:** 6 configurable invoice templates (`Landscape`, `Chillan & Finance`, `Detailed Landscape`, `Advance Invoice`, POS thermal, A5 compact).
3. **`Delivery Doc / Supply Doc`:**
   - `Delivery Docs`: `Point Of Sale`, `Normal`, `Advance`
   - `Supply Docs`: `Delivery Dispatch`, `Salesman Sheet`, `Recovery Sheet`, `Booking Sheet`
4. **`Reports Doc`:** `Rate Lists`, `Presentation For Customer`, `Credit Reports`, `Current Stock`, `Stock Ledger`, `Stock Valuation`.
- **Governance Rule (`§18.15`):** Official platform templates cannot be modified or deleted by tenant admins.

---

## 19. Pending Tasks Engine
- **Task States:** `Draft`, `Fresh`, `Pending`, `Completed`, `Cancelled`.
- **Task Actions:** `View Info`, `Start Task`, `Cancel`, `Draft & Back`.
- **Operational Triggers:** `Payment Recovery`, `Current Stock Check`, `Dispatch Delivery For Supply`, `New Supply`, `Transfer Pending`, `Pending Adjustment`, `Purchase Receiving`, `Expiry & Damage Return Put-Away`. No trip or stock task closes unless its linked `PendingTask` closes cleanly.

---

## 20. Employee Management, 13-Point Permissions & HRM `Coming Soon` Scope
### 20.1 Work Assignments & UI Work Parts (`§20.1–20.3`)
- **Confirmed Operational Assignments:** `Recovery`, `Booking`, `Stock Keeper`, `Wholesaler`, `POS Keeper`.
- **UI Work Parts:** `Order Booker`, `Warehouse`, `POS`, `Normal Invoice`, `Advance Invoice`, `Salesman`.

### 20.2 Thirteen-Point Permission Matrix (`§20.4`)
Every employee/role assignment evaluates 13 explicit permission controls:
1. `Module access`
2. `Screen access`
3. `View`
4. `Create`
5. `Edit`
6. `Delete`
7. `Submit`
8. `Approval`
9. `Stock movement`
10. `Payment`
11. **`Purchase price visibility`** *(strictly governs batch purchase rate, purchase value, and stock valuation visibility)*
12. `Report access`
13. `Warehouse assignment` (scoped allowed warehouses)

### 20.3 HRM Explicitly `Coming Soon` Sections (`§20.5`, `§30.2`)
The following HRM sub-sections are **incomplete (`Coming Soon`)** and MUST render `<ComingSoonModal />` until fully specified and approved:
- `History & Reports`
- `Payroll & Salary`
- `Attendance & Leaving`

---

## 21. Dual Reporting Architecture & 20 Filter Dimensions
### 21.1 Two Independent Reporting Systems (`§21.1–21.2`)
- **System A — ELITE DIST Official System Reports:** Founder/platform-controlled, centrally versioned across SaaS tenants, immutable against tenant edits, backed strictly by verified ledger/movement tables.
- **System B — User-Specific Custom Reports:** Custom report builders/templates requested by or tailored for specific tenants. Once approved by platform governance, custom **report templates** can be shared across other SaaS tenants **with zero exposure of source tenant business data**.

### 21.2 Twenty Global Report Filter Dimensions (`§21.3`)
1. `Date Range` (`from` / `to`)
2. `Warehouse`
3. `Zone`
4. `Area`
5. `Company`
6. `Brand`
7. `Category`
8. `Product / SKU`
9. `Batch`
10. `Unit / Unit Version`
11. `Stock Condition`
12. `Stock Status`
13. `Customer`
14. `Owner`
15. `Route`
16. `Territory`
17. `Beat`
18. `Booker`
19. `Salesman`
20. `Order Source / Type / Status`

---

## 22. Official Report Dictionary — All 15 Detailed Reports (`§22.1–22.15`)
| Report # | Official Report Name | Core Scope & Required Formulas / Fields |
| :--- | :--- | :--- |
| **22.1** | `Current Stock` | Live batch/product quantities (`Current`, `Reserved`, `Available = Current - Reserved`), unit version, condition, status, warehouse/zone/area |
| **22.2** | `Stock Ledger` | Chronological movement-by-movement audit (`Opening -> In -> Out -> Running Balance`) across all 9 official movement types |
| **22.3** | `Stock Valuation` | Weighted/batch-exact value (`CurrentBaseQty * BatchPurchaseRate`, wholesale value, POS value); purchase cost columns hidden if `purchasePriceVisibility = false` |
| **22.4** | `Delivery Movement Results` | Trip-level dispatch fulfillment summary comparing ordered, dispatched, delivered, returned, and pending quantities |
| **22.5** | `Product POS Rate List` | Printable/exportable rate sheet per SKU & unit version filtered to POS-permitted SKUs |
| **22.6** | `Delivery Dispatch` | Official dispatch loading & trip issue manifest (Vehicle, Salesman, Route, Warehouse, SKU/Batch, Load Qty, Weight, Net Value) |
| **22.7** | `Recovery Result` | Customer-wise collection outcomes including cash/bank/wallet receipts, cheque ref/due dates, and explicit `Recovery Skip` records |
| **22.8** | `Delivery Sales Movement` | Master trip financial & cash settlement report:<br>`Net Amount = Total Amount + Extra Value − Return Value − Extra Return Value − Extra Discount Value`<br>`Balance = Net Amount − Total Paid Amount`<br>Cash Handover block: `Petrol/Gas`, `Enjoyments`, `Works`, `Total Due Cash`, `Total Cash Received`, `Shortage/Extra` |
| **22.9** | `Recovery Movement Results` | Consolidated recovery route/sheet performance: Due, Collected, Skipped, Expenses, Cash Handed Over, Variance |
| **22.10** | `Adjustment Movement Results` | Approved/rejected stock adjustments and physical count outcomes (`System Qty`, `Physical Count Qty`, `Difference Qty`, `Updated Balance`) |
| **22.11** | `Adjustment Dispatch` | Printable checklist & movement dispatch document used during physical warehouse count/adjustment sweeps |
| **22.12** | `Purchase Movement Results` | Full 24-field purchase inward report (`Expected`, `Received`, `Difference`, `MFG/EXP discrepancies`, segregated `Normal/Damage/Expire` put-away, `Purchase Value` RBAC-guarded) |
| **22.13** | `Original Invoice` | Exact immutable snapshot captured at order approval/dispatch prior to any doorstep salesman modifications |
| **22.14** | `Edited Invoice` | Doorstep modified invoice tracking line returns, extra items, extra discounts, charges, and `Final Invoice` net totals alongside variance vs `22.13` |
| **22.15** | `Invoice / Recovery Ledger List` | Categorized operational ledger listing strictly across **5 official ledger types**: `Extra Return`, `Extra Item`, `Extra Discount`, `Charge Off`, `Paid Payment` |

---

## 23. Operational Reconciliation Rules (`§23.1–23.8`)
1. **No Silent Reconciliation:** Every variance between expected and actual MUST remain explicitly surfaced until operator resolution.
2. **Purchase Receiving Variance:** `Difference Qty = Received Qty − Expected Qty`; MFG/EXP mismatches require explicit acknowledgment.
3. **Physical Count Variance:** `Difference Qty = Physical Count Qty − System Qty`.
4. **Delivery Dispatch Variance:** `Unaccounted Stock = Dispatched Qty − (Sold Qty + Returned Good Qty + Damage/Expire Returned Qty + Extra Remaining)`.
5. **Invoice Edit Variance:** Compare `Original Invoice` (`22.13`) vs `Final Edited Invoice` (`22.14`) across net amount, weight, and item count.
6. **Sales & Recovery Settlement:** Reconcile `Net Amount − Total Paid Amount = Balance` per bill.
7. **Cash Handover Reconciliation:** Compare `Total Due Cash` against `Total Cash Received` minus itemized field expenses (`Gas/Petrol`, `Enjoyment`, `Works`), surfacing `Shortage / Extra`.
8. **Ledger Consistency:** Every adjustment to customer receivable, company payable, or stock balance links back to its `sourceTransactionRef`.

---

## 24. Dashboards, 16-Part Navigation & Partially Defined Areas
### 24.1 Sixteen Main Navigation Parts (`§24.1`)
1. `Dashboards`
2. `Quick Start`
3. `Inventory`
4. `CRM`
5. `Order for Booking`
6. `Order & Sales Operations`
7. `POS`
8. `Recovery`
9. `Pending Tasks`
10. `Sales Force Automations`
11. `Account Movement`
12. `Master, Rules & Templates`
13. `Reports Analyze`
14. `HRM`
15. `Users Logging`
16. `Settings`

### 24.2 Four Confirmed Module Dashboards (`§24.2`)
1. **Product Dashboard** (SKU counts, active/inactive, unit versions, POS vs booking enabled, fast/slow movers)
2. **Stock Dashboard** (Available vs Reserved, low/warning/out/expired counts, valuation subject to RBAC)
3. **Customer Dashboard** (Retailer vs Wholesaler vs Owner shop groups, credit-blocked alerts, top outstanding)
4. **Warehouse Dashboard** (8 warehouse KPIs: available stock, batches, value, assigned staff, alerts, utilization, zones, areas)

### 24.3 Partially Defined Areas Requiring Explicit Implementation Mapping (`§24.3–24.4`)
`Account Movement`, `POS`, and `Sales Force Automations` contain partial wireframe coverage in the source PDFs and MUST follow explicit ERD/API mapping in `srd.md` and `trd.md`—any unverified sub-tabs must expose `<ComingSoonModal />` rather than half-wired UI.

---

## 25. Multi-Tenant SaaS Isolation, Shared Templates & Security (`§25.1–25.4`)
- **Strict Tenant Data Isolation:** Every collection query filters by `req.tenantId` (`distributorId`). No user/admin inside Tenant A can read or mutate Tenant B documents.
- **Template Sharing Without Data Leakage:** Official and approved Custom Report/Print Templates store only layout/filter definitions (`schemaVersion`, `columns`, `headerConfig`, `footerConfig`), strictly sanitized of tenant IDs, customer names, rates, or transactional figures.
- **PWA & Session Security:** Install prompt only surfaces when app is uninstalled; 5-second toast dismissal; JWT HttpOnly cookies/headers + tenant validation.

---

## 26. Idempotency, Duplicate Prevention & Transaction Integrity (`§26.1–26.6`)
### 26.1 Duplicate Submission Prevention (`§26.4` — 7 Critical Operations)
Both frontend (`isSubmitting` lock + `idempotencyKey` UUID per submit action) and backend (unique index / Redis-or-Mongo idempotency guard) MUST prevent duplicate writes across:
1. `Purchase movements`
2. `Stock movements` (transfers, put-away, return inward)
3. `Payments` (customer recovery & company payable disbursements)
4. `Orders` (Admin, Booker, Online, Official, POS)
5. `Sales results` (including Client Deal finality & `Sales Skip`)
6. `Recovery results` (including split payments & `Recovery Skip`)
7. `Adjustments` (stock & physical count approvals)

### 26.2 Transaction Integrity & Backup (`§26.5–26.6`)
Multi-document stock reservations, batch deductions, ledger postings, and `PendingTask` completions run inside MongoDB atomic transactions where replica sets apply, paired with automated MongoDB Atlas daily snapshots and point-in-time recovery.

---

## 27. Non-Functional Requirements (NFRs)
- **Performance:** Desktop (`>= 1024px`) `100dvh` viewport-locked `<AppShell />` with server-side pagination (`5` dashboard rows / `10` table rows), `<200ms` INP, 300ms debounced searches.
- **Mobile Readiness (`< 768px`):** `<SmartDataTable />` automatically converts into Mobile Stacked Cards (`>= 44px` touch targets) + `<TouchKeypadModal />` for Booker & Salesman field entry.
- **Theme Compliance:** Strict **Blue & White (Light)** / **Blue & Black (Dark)** with **Zero Purple**.
- **Print & Bilingual Support:** Support Urdu + English print headers, notes, and clean PDF/Print preview (`PrintPreviewModal`).
- **Auditability:** Full `AuditLog` entries on create, update, approve, edit-invoice, skip, adjustment, and role/permission mutations.

---

## 28. Master Acceptance Criteria (`§28.1–28.13`)
1. **AC-01 Multi-Tenant & Auth:** Super Admin provisions tenants; public self-signup disabled/Coming Soon; tenant queries never leak across `distributorId`.
2. **AC-02 Granular Authorization:** Orders/deliveries validate `Company × Brand × Product × Territory × Area`; unauthorized SKUs blocked.
3. **AC-03 Product & Purchase Rate RBAC:** Product creation succeeds without `purchaseRate`; users with `purchasePriceVisibility=false` cannot view batch cost or valuation anywhere in UI/API.
4. **AC-04 Unit Versioning:** Changing carton conversion creates v2, preserves v1 batches, supports dual-version transactions, and auto-promotes v2 when v1 hits 0.
5. **AC-05 Warehouse & Zero-Stock Guard:** `Warehouse -> Zone -> Area` CRUD enforces dimensions/types and blocks deletion (`400`) when `currentBaseQty > 0`.
6. **AC-06 Stock Issue Policy:** Distributor policy (`FIFO` / `FEFO` / `Manual`) drives batch reservation & dispatch cleanly (`Available = Current - Reserved`).
7. **AC-07 Purchase Receiving & General Expenses:** Receiving flags Expected vs Received & MFG/EXP discrepancies, splits Normal/Damage/Expire put-away, updates Company Payable, and keeps Loading/Transport out of SKU cost.
8. **AC-08 Multi-Shop & Booker Visits:** Single owner supports multiple independent shop ledgers; Booker visit ends tagged `Visited` regardless of order/payment; `Booking Skip` logs reason.
9. **AC-09 Order, POS & `Write Your Own`:** Ad-hoc customers work via `Write Your Own`; POS enforces `posPermission`; 2-level invoice engine matches penny-exact math.
10. **AC-10 Original vs Edited Invoice & Sales Skip:** Doorstep edits preserve `Original Invoice` (`22.13`) untouched alongside `Edited/Final Invoice` (`22.14`); `Sales Skip` outputs formal `Sales Result` in Salesman Sheets.
11. **AC-11 Recovery Skip & Cash Handover:** `Recovery Skip` reports accurately; field expenses (`Gas/Petrol`, `Enjoyment`, `Works`) reconcile `Total Due Cash` vs `Total Cash Received` (`Shortage/Extra`) without faking customer payments.
12. **AC-12 Dual Reports & 15 Official Reports:** All 15 official reports (`22.1–22.15`) match reconciliation formulas including all 5 Invoice/Recovery Ledger types; shared custom templates leak zero tenant data.
13. **AC-13 Duplicate Prevention & `Coming Soon` Integrity:** All 7 critical operations reject duplicate submits; Tax Group, partial Scheme Group, and HRM History/Payroll/Attendance clearly surface `<ComingSoonModal />`.

---

## 29. Explicitly Excluded Scope Matrix (`§29` — All 14 Excluded Items)
| # | Excluded Module / Feature | Master PRD Basis | Treatment in ELITE DIST v1.0 |
| :--- | :--- | :--- | :--- |
| 1 | **Journal Entries** (manual Dr/Cr vouchers) | §17.2, §29 | Excluded; hide/de-scope conventional GL voucher forms |
| 2 | **Trial Balance** | §17.2, §29 | Excluded; not part of operational accounts |
| 3 | **Balance Sheet** | §17.2, §29 | Excluded; not part of operational accounts |
| 4 | **Conventional General Ledger / Chart of Accounts** | §17.2, §29 | Replaced by 10 Operational Account Record Types (`§17.3`) |
| 5 | **Conventional Double-Entry Posting / Voucher Workflow** | §17.2, §29 | Replaced by operational Customer, Company Payable, & 5 Invoice/Recovery Ledgers |
| 6 | **Separate Supplier Registration Master** | §4.2, §9.1, §29 | Excluded; supplier context lives under Company & Brand |
| 7 | **Purchase Request (PR) Workflow** | §9.1, §29 | Excluded; purchases start at Purchase Movement entry |
| 8 | **Purchase Order (PO) Workflow** | §9.1, §29 | Excluded; purchases use Purchase Movement + 5-step receiving |
| 9 | **Marketplace Modules** | §2.3, §29 | Excluded (Phase 3 future compatibility only) |
| 10 | **Direct Customer Marketplace Ordering Workflows** | §2.3, §29 | Excluded from current ERP release |
| 11 | **Unverified Order Sources** | §13.1, §29 | Only verified `Online`, `Booker`, `Admin`, `Official` supported |
| 12 | **Unverified Order Approval Stages** | §13–14, §29 | Only verified `Pending -> Approved -> Delivery -> Complete / Cancel` |
| 13 | **Auto-Allocation of Shared Transport/Loading into Purchase Rates** | §9.10, §29 | Forbidden; General Business Expenses stay separate |
| 14 | **Unsupported Statutory / Financial Statements** | §21–22, §29 | Only the 15 Official Operational Reports (`22.1–22.15`) + verified sub-reports |

---

## 30. `Coming Soon` Registry, Change Control & Development Traceability
### 30.1 `Coming Soon` Registry (`§30.2`)
Any UI route, button, or tab referencing these areas **MUST** open `<ComingSoonModal />` (never silent failure, never fake calculation):
1. `Tax Group` (`§18.2`)
2. `Portions of Scheme Group` flagged incomplete in source specs (`§18.5`)
3. `HRM — History & Reports` (`§20.5`)
4. `HRM — Payroll & Salary` (`§20.5`)
5. `HRM — Attendance & Leaving` (`§20.5`)
*(Plus public `/register` tenant self-signup while Super Admin controlled provisioning is active).*

### 30.2 Formal Change Control Process (`§30.4`)
Adding any `Coming Soon` feature or excluded scope requires: (1) Written field & calculation specification, (2) Updated Acceptance Criteria in `prd.md`, (3) Updated schema/API contracts in `srd.md` & `trd.md`, (4) New sequential phase(s) in `features-phases.md`, and (5) Passing automated/manual verification.

### 30.3 Mandatory Development Traceability Format (`§30.5` — 6 Fields)
Every task/phase starting from Milestone 11 (`Phase 101+`) MUST declare:
1. **`PRD Section`** (e.g., `§5.3, §5.7`)
2. **`Source Module / Page`**
3. **`Classification`** (`Existing`, `Confirmed`, `Extended`, `Recommended`, `Pending`)
4. **`Acceptance Criteria`** (`AC-XX`)
5. **`Test Case`** (exact verification scenario)
6. **`Status`** (`Pending` / `Complete`)

---

## 31. Spec Synchronization Notice (Phases 001–100 vs. Phases 101–115)
Phases `001–100` delivered the full MERN foundation, Blue/White & Blue/Black theme, Cloudinary pipeline, multi-unit math, warehouse CRUD, two-level invoice engine, PWA setup, and core operational screens. During formal reconciliation against this **69-page Master PRD v1.0**, the following baseline gaps and scope shifts were identified and queued into **Milestone 11 (`Phases 101–115`)** in `.agents/features-phases.md`:
1. Make `Product.purchaseRate` optional, enforce `purchasePriceVisibility` RBAC, and implement 8-step **Unit Versioning**.
2. Implement distributor-selectable **Stock Issue Policy** (`FIFO`, `FEFO`, `Manual`), custom supplementary stock conditions, and `Warehouse -> Zone -> Area` alignment.
3. Align **Purchase Movement** (removing PO/PR/Supplier Master clutter from active operational flows), Expected vs Received MFG/EXP checks, segregated Normal/Damage/Expire put-away, **Company-Wise Payable Ledger**, and **General Business Expenses** isolation (`Loading`/`Transport`).
4. Implement granular 5D authorization (`Company × Brand × Product × Territory × Area`), **Multi-Shop Owner** linking, independent Booker **`Visited`** tag + **`Booking Skip`**, and **`Write Your Own`** customer order mode.
5. Enforce **Original Invoice Immutability** (`Original` vs `Edited` vs `Final`), **`Sales Skip`**, **`Recovery Skip`**, and **Cash Handover Reconciliation** (`Gas/Petrol`, `Enjoyment`, `Works`, `Shortage/Extra`).
6. Replace/de-scope conventional GL/Journal/Trial Balance/Balance Sheet screens with the 10 Operational Account types & 5 Invoice/Recovery Ledger types per `§17` & `§29`.
7. Implement **13-Point Employee Permission Matrix**, **16-Part Navigation alignment**, **System A Official vs System B Shareable Custom Report Templates**, **15 Official Reports (`22.1–22.15`)**, **7-Operation Idempotency Guard**, and **`Coming Soon` gating** across `§30.2`.
