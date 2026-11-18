### FILE 3: `.agents/features-phases.md`

```markdown
# 100-Phase Step-by-Step Implementation Roadmap (`features-phases.md`) — ELITE DIST

- **Product Name:** ELITE DIST — Enterprise Resource Planning (ERP) & Sales Force Automation (SFA) System for Distributors
- **Document Path:** `.agents/features-phases.md`
- **Version:** 1.0 (Master 100-Phase Execution Blueprint)
- **Date:** November 2026
- **Tech Stack Lock:** MERN Stack (`MongoDB Atlas` + `Express.js` + `React 19 (Vite)` + `Node.js`) + `Tailwind CSS` (Mobile-First Responsive, Blue & White Light Mode / Blue & Black Dark Mode, Zero Purple) + `Cloudinary`
- **Execution Rule:** Complete each phase sequentially. Every phase must deliver real MongoDB Atlas queries, server-side pagination, mobile-first responsive UI, zero dummy data bloat, and clean `.env` integration before marking `[x]` and syncing to Git.

---

## Milestone 1: Foundation, Split Architecture, Auth, RBAC & Global App Shell (Phases 001–010)

### [x] Phase 001: Split Monorepo Initialization & Dual `.env` Configuration
- **Scope:** Initialize `server/` (Node.js + Express) and `client/` (React 19 + Vite + Tailwind CSS) folders with latest stable packages (`@latest`).
- **Backend (`server/`):** Create `server/.env.example`, `server/src/config/env.js` (strict validator for `PORT`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLOUDINARY_*`, `SUPER_ADMIN_*`), and `server/src/server.js` with `/api/v1/health` endpoint.
- **Frontend (`client/`):** Create `client/.env.example`, configure Vite proxy/base URL (`VITE_API_BASE_URL`), and set up root `.gitignore`.
- **Verification:** Both `server` and `client` boot cleanly using only `.env` variables with zero hardcoded secrets.

### [x] Phase 002: MongoDB Atlas Singleton Connection & Cloudinary Media Service
- **Scope:** Connect backend to MongoDB Atlas and configure Cloudinary upload/delete pipelines.
- **Backend (`server/`):** Build `server/src/config/db.js` (resilient connection pool + index sync), `server/src/config/cloudinary.js` (folder-partitioned upload stream + `destroy(publicId)` helper), `server/src/middlewares/uploadMiddleware.js` (`multer` memory storage with MIME/size validation), and `POST /api/v1/upload/image` + `DELETE /api/v1/upload/image`.
- **Frontend (`client/`):** Create `client/src/services/apiClient.js` (Axios instance with token interceptors) and `client/src/services/uploadService.js`.
- **Verification:** Test uploading a sample logo to Cloudinary and verifying `{ url, publicId }` response.

### [x] Phase 003: Design System Tokens (`globals.css`) & Theme Engine (Blue/White & Blue/Black)
- **Scope:** Implement the ELITE DIST visual identity from `.agents/design.md` with strictly **Zero Purple**.
- **Frontend (`client/`):** Configure `client/src/styles/globals.css` and `tailwind.config.js` with CSS custom properties (`--bg-canvas`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-secondary`, `--border-subtle`, `--accent-primary`, `--accent-cyan`, `--status-*`) for Light Mode (Pure White `#FFFFFF` + Royal/Ocean Blue `#0284C7` / `#2563EB`) and Dark Mode (Obsidian Black `#06090F` / `#0B1120` + Electric Blue `#38BDF8` / `#3B82F6`). Build `ThemeContext.jsx` with smooth 200ms transitions and `localStorage` persistence.
- **Verification:** Toggle Light/Dark mode and confirm smooth transitions, high WCAG contrast, `tabular-nums`, and zero purple hues.

### [x] Phase 004: User Mongoose Model & Idempotent Super Admin Bootstrap
- **Scope:** Create the `User` model (`server/src/models/User.model.js`) and auto-seed the Super Admin from `server/.env`.
- **Backend (`server/`):** Define `User` schema with `distributorId`, `profileId`, `fullName`, `email`, `phone`, `passwordHash`, `avatar` (Cloudinary), `primaryRole` (`SUPER_ADMIN`, `ADMIN`, `BOOKER`, `SALESMAN`, `POS_OPERATOR`, `WAREHOUSE_MANAGER`, `STOREKEEPER`, `ACCOUNTANT`), and `workParts` (`orderBooker`, `warehouseManager`, `posStore`, `normalInvoice`, `advanceInvoice`, `salesman`). Build `seedSuperAdmin.js` to idempotently create the Super Admin from `server/.env` on startup.
- **Verification:** Boot server and verify the Super Admin record is created once in MongoDB Atlas.

### [x] Phase 005: JWT Authentication API, Refresh Rotation & Tenant Isolation Middleware
- **Scope:** Build complete backend authentication and role/tenant security middlewares.
- **Backend (`server/`):** Implement `auth.controller.js` (`POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`), `authMiddleware.js`, `rbacMiddleware.js` (checking `primaryRole` and `workParts`), and `tenantMiddleware.js` (scoping every query by `req.user.distributorId`).
- **Verification:** Test login with Super Admin `.env` credentials, token refresh, and unauthorized role rejection (`403`).

### [x] Phase 006: Frontend Auth Context, Login/Signup Screens & Role Redirector
- **Scope:** Build responsive, human-crafted Login and Distributor Registration screens.
- **Frontend (`client/`):** Create `AuthContext.jsx`, `ProtectedRoute.jsx`, `LoginPage.jsx`, and `SignupPage.jsx` featuring the official ELITE DIST logo, interaction-after validation (no preemptive red errors on load), show/hide password toggle, and automatic role-based landing redirect (`/dashboard` for Admin, `/portal/booker` for Booker, `/portal/pos` for POS, `/portal/salesman` for Salesman, `/tasks/pending` for Storekeeper).
- **Verification:** Log in on desktop and mobile viewports and verify instant role redirection and session persistence.

### [x] Phase 007: Viewport-Locked App Shell (`AppShell.jsx`), Collapsible Sidebar & Topbar
- **Scope:** Build the master layout shell that prevents unnecessary desktop page scrolling (`100dvh`).
- **Frontend (`client/`):** Build `ShellContext.jsx`, `AppShell.jsx` (`h-dvh overflow-hidden` on desktop), `Sidebar.jsx` (collapsible section groups, role-isolated navigation links, `"Soon"` badges on unbuilt routes, mobile off-canvas drawer with backdrop), and `Topbar.jsx` (sidebar toggle, breadcrumbs, `Ctrl+K` quick search input, `+ Quick Action` menu, Notification Bell, and Theme Toggle switch).
- **Verification:** Verify desktop sidebar collapse/expand reflows workspace cleanly and mobile drawer opens/closes with `Esc` and backdrop tap.

### [x] Phase 008: Global Reusable Table, Pagination, Filter & Card Components
- **Scope:** Build the core data display atoms in `client/src/components/global/`.
- **Frontend (`client/`):** Implement:
  1. `SmartDataTable.jsx`: Sticky header desktop table (`>= 768px`) that automatically transforms into touch-friendly **Mobile Stacked Cards** (`< 768px`), supporting `Table List` vs `Card View` toggle and `Show/Reset Columns` visibility selector.
  2. `PaginationBar.jsx`: Synchronized server-side pagination (`Showing X–Y of Z`, page size selector `5 / 10 / 20`, Prev/Next/Page buttons).
  3. `FilterToolbar.jsx`: Debounced search (300ms), dropdown filters, `Apply Rule`, and `Reset` buttons.
  4. `MetricCard.jsx`: KPI stat card with `tabular-nums`, icon badge, and status color.
- **Verification:** Render test states across `375px` mobile and `1440px` desktop viewports.

### [x] Phase 009: Global Modals, Touch Keypad, Image Dropzone & Toast System
- **Scope:** Complete the global overlay toolkit (Zero native `alert`/`confirm`).
- **Frontend (`client/`):** Build `ConfirmModal.jsx` (custom delete/approval guard), `FormModal.jsx` (slide-over drawer / modal wrapper with scroll lock cleanup), `ComingSoonModal.jsx`, `TouchKeypadModal.jsx` (calculator-style `0-9`, `+`, `-`, `Clear`, `OK` pad for mobile Booker/Salesman/Stock Count), `ImageDropzone.jsx` (local preview + Cloudinary upload lock), `ToastContainer.jsx`, and `NotFound404.jsx`.
- **Verification:** Trigger each modal and verify `z-index` layering (`z-10` to `z-60`) and clean body scroll restoration on close.

### [x] Phase 010: Audit Trail Engine & Global Error Boundary
- **Scope:** Ensure every stock and financial mutation is traceable.
- **Backend & Frontend:** Create `AuditLog.model.js` (`distributorId`, `actorId`, `module`, `action`, `entityId`, `beforeState`, `afterState`, `ipAddress`, `createdAt`), `errorMiddleware.js` (standardized JSON errors), and a React `ErrorBoundary` wrapper.
- **Verification:** Confirm unhandled API or UI errors display a clean recovery card/toast instead of crashing the app.

---

## Milestone 2: Inventory Part 1 — Companies, Brands, Categories & Product Master (Phases 011–020)

### [x] Phase 011: Companies Master Backend API & Multi-Subtable Schema
- **Scope:** Implement `Company.model.js` and `/api/v1/inventory/companies` endpoints (Wireframe Pages 9–14).
- **Backend (`server/`):** Support auto/custom `companyCode` (`GC-04523`), `companyName` (`GREEN CHEMICALS`), `shortName`, Cloudinary `logo`, `ownerName`, `supplierName`, `accountantName`, `businessType`, `industryType`, `establishYear`, `ntn`, `registrationNo`, `address` (Country, Province, City, Zone, Street, Google Map link), plus embedded arrays for **Multiple Contacts** (`WhatsApp`/`Phone`), **Multiple Social Media Links** (`Facebook`/`Promotions`), and **Multiple Bank/EasyPaisa/JazzCash Accounts** (`Bank Al Habib`, IBAN, Default flag). Include delete guard if linked brands/products exist.
- **Verification:** Test full CRUD, server-side pagination, and sub-table array persistence in MongoDB Atlas.

### [x] Phase 012: Companies Master Frontend Listing, View Drawer & Multi-Tab Form
- **Scope:** Build `/inventory/companies` UI (Wireframe Pages 9–14).
- **Frontend (`client/`):** Build `CompaniesPage.jsx` with search by Code/Name/Status, `<SmartDataTable />` showing Logo, Company Name, Owner, Supplier, Contact No, Total Brands, and Action Menu (`View`, `Edit`, `Duplicate`, `Report`, `Delete`, `Manage Brand`). Build `CompanyFormModal.jsx` with inline sub-tables (`+ Add Person & Contact Info`, `+ Add Social Media Info`, `+ Add Account Info`) and `SAVE`, `SAVE & DUPLICATE`, `SAVE & NEW`, `CLEAR` actions.
- **Verification:** Create a company with Cloudinary logo and multiple contacts/bank accounts; verify Table and Mobile Card views.

### [x] Phase 013: Brands Master Backend & Frontend (`/inventory/brands`)
- **Scope:** Implement `Brand.model.js` and `/inventory/brands` UI (Wireframe Pages 15–19).
- **Backend & Frontend:** Support `brandCode` (`S-01`), `brandName` (`SILKO`, `SURAJ`, `GLOSSY`, `WHITE WASH`), linked `companyId`, `brandType` (`Personal Care`, `Cosmetics`, `Home Care`, `Detergent`), Cloudinary `logo` and `coverImage`, `ownerName`, `brandManager`, `salesManager`, multi-row Contacts & Socials, and Brand View drawer displaying Total/Active/Inactive Products and instant Current Stock report preview.
- **Verification:** Link brands to companies, upload Brand Logo & Cover Image to Cloudinary, and test filtration by Company and Brand Type.

### [x] Phase 014: Categories & Sub-Categories Master (`/inventory/categories`, `/inventory/sub-categories`)
- **Scope:** Implement `Category.model.js` and Category/Sub-Category screens (Wireframe Pages 20–25).
- **Backend & Frontend:** Build Category Master (`code: S-01`, `name: Shampoo`, linked `companyId`, multi-select `linkedBrandIds` sub-table with delete protection, Cloudinary image, description) and Sub-Category Master (`code: F-01`, `name: Fresh`, linked Category/Brand/Company). Include 1-click navigation between `Go To Sub Category` and `Back To Category`.
- **Verification:** Create Categories and Sub-Categories, link multiple brands, and verify product count aggregations.

### [x] Phase 015: Product Master Schema & Multi-Unit / Volume Calculation API
- **Scope:** Build `Product.model.js` and `/api/v1/inventory/products` (Wireframe Pages 5–8).
- **Backend (`server/`):** Enforce strict separation between Product Master and Stock. Store `skuCode` (`GC-04523`, `FA200`), `barcode`, `productName`, `companyId`, `brandId`, `categoryId`, `subCategoryId`, `baseUnit` (`Bottle`, `Piece`, `weightValue`, `weightUnit`, `traderPurchaseRate`, `wholesaleSaleRate`, `posRetailEndRate`, Cloudinary `image`), and `packingUnits` (`Carton`, `Dozen`, `Box`, `Sack`, `conversionQty`, auto `packingWeightKg`, 3-tier packing rates, Cloudinary `image`, and physical dimensions `Width × Length × Height` auto-computing `Area` and `Volume`).
- **Verification:** Test creating multi-unit products and verify server-side calculation of packing weights, area ($W \times L$), and volume ($W \times L \times H$).

### [x] Phase 016: Add/Edit Product Workbench UI (`/inventory/products/create`)
- **Scope:** Build the comprehensive Add Product form (Wireframe Page 8).
- **Frontend (`client/`):** Build `ProductFormModal.jsx` / page with Auto SKU generator, Company -> Brand -> Category -> Sub-Category cascading selectors, Base Unit & 3-Tier Pricing section (`Trader Rate`, `Sale/Wholesale Rate`, `POS/End Rate`) with Base Item Cloudinary Dropzone, and Packing Unit section with live conversion math (`Compare With Base Unit Per Packing Unit Quantity: 24 -> Packing Weight: 12 Kg Auto`), live Dimension/Area/Volume calculator (`Inch`/`Feet`/`cm`), and Pack Item Cloudinary Dropzone.
- **Verification:** Enter base weight `0.500 Kg` and conversion `24`; verify packing weight auto-fills `12 Kg` and dimensions compute Area and Volume without `useEffect` loops.

### [x] Phase 017: Product Master Data List, Dual View Switcher & Bulk Rules Toolbar
- **Scope:** Build `/inventory/products` master listing and bulk rule engine (Wireframe Pages 5–6).
- **Backend & Frontend:** Implement multi-criteria filtration (Company, Brand, Category, Sub-Category, Warehouse, SKU, Status), `Table List` vs `Card View` switcher, `Show/Reset Columns` customizer, and the **Apply Rule** panel allowing bulk assignment of `Discount Type`, `Tax Type (GST %)`, `Scheme Type`, `Loading Charge (%)`, `Profit Margin Cost (PKR)`, `Wholesale Margin Cost (PKR)`, `Assign Booker`, and `Show on Marketplace (Yes/No)` to selected products.
- **Verification:** Select multiple products, apply a bulk GST and Margin rule, and verify instant database update and table refresh.

### [x] Phase 018: Product Rate List Generator, Barcode Printer & Report Preview
- **Scope:** Build Product Report & Rate List generation inside `/inventory/products` (Wireframe Pages 6–7).
- **Backend & Frontend:** Build `ProductReportPreview` supporting `Rate List for Retail`, `Rate List for Wholesale`, and `Stock Transfer Report` filtered by Company, Brand, Warehouse, Sales Person, and Unit (`Base` vs `Packing`). Wire `<PrintPreviewModal />` with `Export` (PDF/Excel/CSV), `Print`, `Send`, and `Print Barcode` label generator.
- **Verification:** Generate a Retail Rate List for a brand and test print preview and Excel export.

### [x] Phase 019: Inventory & Product Dashboard (`/inventory/dashboard`)
- **Scope:** Build the dedicated Product Dashboard (Wireframe Page 4).
- **Backend & Frontend:** Create aggregation endpoint `GET /api/v1/inventory/dashboard` returning real-time counts for `Total Products`, `Active Products`, `Inactive Products`, and `Top Products`, plus Brand-wise SKU distribution charts and quick navigation tabs (`Dash Board`, `Data List`, `Brands & Category`).
- **Verification:** Verify all 4 KPI cards and charts load real MongoDB Atlas counts within a viewport-locked layout.

### [x] Phase 020: Inventory Part 1 End-to-End Audit & Index Optimization
- **Scope:** Audit Phases 011–019 for query speed, Cloudinary cleanup on delete, mobile card responsiveness, and zero dummy data.
- **Verification:** Run full CRUD across Companies, Brands, Categories, Sub-Categories, and Products on both desktop and mobile viewports.

---

## Milestone 3: Inventory Part 2 — Warehouses, Zones, Floor/Rack Areas, Stock Batches & Movements (Phases 021–032)

### [x] Phase 021: Pakistan-Style 3-Level Warehouse, Zone & Floor/Rack Schema & API
- **Scope:** Build `Warehouse.model.js` and `/api/v1/warehouses` endpoints (Wireframe Pages 41–48).
- **Backend (`server/`):** Model the 3-level hierarchy:
  1. `Warehouse` (`warehouseCode: P-01`, `warehouseName: Plot No 01`, `warehouseType: MAIN | SHOP`, Manager, Staff Contacts with WhatsApp/Phone, Address, GPS).
  2. `Zone` (`zoneCode: S-01`, `zoneName: Main Shop`, `zoneType: NORMAL | MIX | TEMPERATURE | COLD_STORE`, `storageType: NORMAL | DAMAGE | EXPIRY`, `condition: NORMAL | FREEZE`, Dimensions $W \times L \times H$).
  3. `Area / Location` (`areaCode: SDH-Rs10`, `areaName`, `areaType: FLOOR | RACK | WALKED`, `storagePurpose: NORMAL | DAMAGE | MIX | EXPIRY`, `condition: NORMAL | FREEZE | TEMPERATURE`, Dimensions $L \times W \times H$, and `allowedProducts` with `minQtyPacking` and `maxQtyPacking`).
- **Verification:** Test creating Warehouses, nested Zones, and Floor/Rack Areas with auto Area/Volume calculations.

### [x] Phase 022: Zero-Quantity Deletion Guard & Inventory Location Operator
- **Scope:** Enforce the strict rule on Wireframe Page 33 ("YE DELETE KA BUTTON NORMAL NAHI HY...").
- **Backend & Frontend:** Build the **Inventory Location Operate** screen (`/stock/areas` / Wireframe Pages 31–33) where operators assign allowed products (`Min QTY` / `Max QTY` in Packing Units) to specific Warehouse Zones/Areas. Enforce a strict backend + frontend guard: if a user attempts to delete an Area or Zone where any `StockBatch` has `currentBaseQty > 0`, block deletion and prompt them to execute a Stock Movement first until quantity reaches `0`.
- **Verification:** Attempt to delete a stocked Area and confirm the guard modal blocks deletion and links to Create Movement.

### [x] Phase 023: Warehouse & Zone Management UI, Utilization Gauges & View Drawers
- **Scope:** Build `/stock/warehouses` and `/stock/zones` UI (Wireframe Pages 40–48).
- **Frontend (`client/`):** Build card/table listings and detailed View screens for Warehouses and Zones displaying `Available Stock`, `Stock Areas`, `Assigned Staff`, `Low Stock Alert`, `Stock Value`, `Total Batch`, and an `80% Storage Utilization` progress ring, plus multi-row Staff Contact sub-tables and `Transfer Stock` / `Manage Zone` quick actions.
- **Verification:** Test adding a Warehouse, adding Zones and Floor/Rack Areas, and viewing utilization metrics.

### [x] Phase 024: Stock Batch Schema, Dual-Unit Display & Condition vs. Status Engine
- **Scope:** Implement `StockBatch.model.js` and `/api/v1/stocks/batches` (Wireframe Pages 27–29).
- **Backend (`server/`):** Track batch-level inventory (`batchNo`, `productId`, `warehouseId`, `zoneId`, `areaId`, `mfgDate`, `expDate`, `currentBaseQty`, `reservedBaseQty`, `availableBaseQty = current - reserved`, `totalWeightKg`, `totalStockValuePkr`). Maintain separate attributes for **Condition** (`NORMAL`, `DAMAGE`, `EXPIRE`, `DAMAGE_EXPIRE`) and **Status** (`AVAILABLE`, `RESERVED`, `LOW_WARNING` when `current - reserved == 0` or below min threshold, `OUT` when `current == 0`, `BLOCKED`, `QUARANTINED`).
- **Verification:** Verify automatic status transitions (`AVAILABLE` -> `LOW_WARNING` -> `OUT`) when stock quantities change.

### [x] Phase 025: Stocks Data List, Batch Breakdown & Min/Max/Expiry Rule Toolbar
- **Scope:** Build `/stock/list` UI and batch report modal (Wireframe Pages 26–30).
- **Frontend (`client/`):** Display dual-unit stock quantities (`Carton : Pcs`, e.g., `60:200`), Available Stock, Reserved Stock, Value (`PKR`), Weight (`Kg`), Batch count, Condition badge, and Status badge. Add the **Apply Rules** popover to set `Minimum Stock (Pack)`, `Maximum Stock (Pack)`, and `Expiry Alert (Days)` per product/location, plus full-page **Current Stock Report** preview showing multi-batch breakdowns (`B001:01`, `B002:04`) with MFG/EXP dates.
- **Verification:** Filter stocks by Warehouse, Company, Brand, Stock Type (`Damage`/`Expire`), and Stock Status (`Out`/`Warn`), and print Current Stock Report.

### [x] Phase 026: Stock Movement Engine — Inter-Warehouse Transfer (`Transfer`)
- **Scope:** Build `StockMovement.model.js` and the Inter-Warehouse Transfer workflow (Wireframe Page 34).
- **Backend & Frontend:** Build `/stock/movements/create` supporting `Movement Type: Transfer` (`Transfer From Warehouse: ORANGI-001` to `BALDIA-001`, `Prepared By: Storekeeper`, `Dispatched By: Salesman Driver`, `Assign By`, `Received By: Warehouse Manager`, `Task Name`). Display batch-wise available `Carton` and `Pcs` (`B-01`, `B-02` with MFG/EXP) and allow selecting transfer quantities, generating a printable Dispatch Checklist and creating a `Transfer Pending` task.
- **Verification:** Create an inter-warehouse transfer and verify batch reservation and task creation.

### [x] Phase 027: Stock Movement Engine — Intra-Warehouse (`Same Transfer`)
- **Scope:** Build internal Zone/Area transfer within the same warehouse (Wireframe Pages 35–36).
- **Backend & Frontend:** Support `Movement Type: Same Transfer` (`Transfer On Warehouse: ORANGI-001`, `Prepared By`, `Assigned By`, `Task Name`). Allow selecting products by current `Zone`, `Area`, `MFG/EXP`, `Unit`, and `Quantity`, and choosing the target `Zone` (`Main Shop`) and `Area` (`SDH-10`) via the inline `Locate` selector.
- **Verification:** Move stock from `Main Plot` to `Main Shop` within `ORANGI-001` and verify location balances update atomically.

### [x] Phase 028: Stock Movement Engine — Physical Stock Adjustment (`Adjustment`)
- **Scope:** Build batch-level stock adjustment and reconciliation (Wireframe Page 37).
- **Backend & Frontend:** Support `Movement Type: Adjustment` (`Prepared By`, `Assigned To`, `Task Name`). List batches by `Zone`, `Area`, `Item Name`, `Batch`, `MFG/EXP`, and `Available QTY (Pack & Base)`, allowing the operator or checker to toggle `Accept` / `Non Accept`, print the Checklist, and commit `Pending Adjustment`.
- **Verification:** Execute a stock adjustment and verify `AuditLog` records `previousErpBaseQty`, `physicalCountBaseQty`, and the difference.

### [x] Phase 029: Stock Movement Engine — Purchase Intake (`Purchase`)
- **Scope:** Build supplier purchase intake and automatic batch creation (Wireframe Page 38).
- **Backend & Frontend:** Support `Movement Type: Purchase` (`Prepared By`, `Assigned To`, `Supplier`, `Category`, `Linked Brand`, `Product Code & Name`). Auto-generate `Batch ID`, capture `Unit`, `Weight`, `Purchase Rate`, `MFG Date`, `EXP Date`, and `Purchase QTY`, print the checklist, and queue `Pending To Load` (Put-Away task).
- **Verification:** Record a Purchase movement and confirm a new `StockBatch` is created upon put-away completion.

### [x] Phase 030: Stock Movement Engine — Expiry & Damage Return (`Expiry & Damage Back`)
- **Scope:** Build supplier return workflow for damaged/expired batches (Wireframe Page 39).
- **Backend & Frontend:** Support `Movement Type: Expiry & Damage Back` (`Warehouse`, `Prepared By`, `Assigned To Checker`, `Company Person`, `Task Name`). List damaged/expired batches in quarantine zones (`Z01-E`, `A10-E`), enter `Returned QTY (Carton & Pcs)`, toggle `Accept` / `Non Accept`, and generate the return dispatch sheet.
- **Verification:** Return damaged/expired stock to a supplier company and verify quarantine stock deduction.

### [x] Phase 031: Stock Movements Master Data List, Hide/Show Toggle & Reports
- **Scope:** Build `/stock/movements` master listing and report viewer (Wireframe Pages 49–53).
- **Backend & Frontend:** Filter movements by `Date Range`, `ID No`, `Movement Type` (`Adjustment`, `Expiry & D Back`, `Transfer`, `Purchase`, `Costume`, `Delivery`), `Status` (`Pending`, `Comp`), `From`, and `To`. Support `Hide / Go Hide Movement` toggle, `View Movement Details` modal, and full-page Movement Report printing/exporting.
- **Verification:** Test filtering, hiding/unhiding movements, and exporting movement reports.

### [x] Phase 032: Stocks & Warehouse Dashboard (`/stock/overview`)
- **Scope:** Build the dedicated Stocks Dashboard (Wireframe Page 26 & 54 — Inventory Part Complete milestone).
- **Backend & Frontend:** Aggregate total stock value, total weight (`Kg`), warehouse utilization %, low-stock warnings, out-of-stock SKUs, near-expiry batches (90-day window), and recent stock movements.
- **Verification:** Verify dashboard loads real-time batch aggregations and completes the Inventory module milestone.

---

## Milestone 4: CRM — 7-Level Location Hierarchy, Customer Master, Territories & Beat Plans (Phases 033–042)

### [x] Phase 033: 7-Level Geographical Hierarchy — Areas & Routes Master (`/crm/areas-routes`)
- **Scope:** Build Areas and Routes master management (Wireframe Pages 62–67).
- **Backend & Frontend:** Implement `Area` (`areaCode: T-01`, `areaName: QASBA COLONY`, `city: Karachi`, `subDistrict: ORANGI`, `areaType: Market | Mall | Shops | Factory`, `GPS Lat/Lng`, `Google Map link`, description) and `Route` (`routeCode: T-01`, `routeName: QASBA MOOR / JAMSHEED PUMP`, linked `areaId`, `routeType`, `GPS`, description). Display live counts of linked `Routes`, `Retailers`, `Wholesalers`, and `Territory Groups`, plus `Total Sale History` report generation per Area/Route.
- **Verification:** Create Areas and Routes in Karachi (`Orangi`, `Baldia`, `Korangi`, `Lyari`) and verify drill-down navigation.

### [x] Phase 034: Customer Master Schema & Multi-Shop / Pehchan API
- **Scope:** Implement `Customer.model.js` and `/api/v1/crm/customers` (Wireframe Pages 57–61).
- **Backend (`server/`):** Support 7-level location (`City → Town/Zone → Area → Route → Street → Pehchan Remarks → Customer Shop`), Cloudinary `shopPic`, `customerCode` (`C-1110`, `GC-04523`), `shopName` (`Lucky Store`), `ownerName`, `ownerContact`, `customerType` (`WHOLESALER`, `RETAILER`), `shopCategory` (`Confectionery`, `General`, `Store`, `Supplier`), `ntn`, `registrationNo`, multi-row `contacts` (`Shopkeeper`, `Store Keeper`, `Accountant`), multi-row `paymentAccounts` (`Bank Al Habib`, `EasyPaisa`, `JazzCash`), `paymentCondition` (`PAID_CASH`, `ALLOW_CREDIT`, `ADVANCE`), `creditLimitPkr`, `outstandingBalancePkr`, `visitPosition` (`VISITED`, `DELIVERED`, `NORMAL`, `ORDERED`), and `status` (`ACTIVE`, `INACTIVE`, `BLOCKED`). Support multiple shops under a single owner with isolated transaction histories.
- **Verification:** Test creating multiple shops for one owner and verify independent ledger/balance tracking.

### [x] Phase 035: Add/Edit Customer Form with Pehchan, Multi-Contact & Payment Sub-Tables
- **Scope:** Build the Customer creation modal/page (Wireframe Pages 59–61).
- **Frontend (`client/`):** Build `CustomerFormModal.jsx` with Auto Customer ID, Shop Picture Cloudinary upload, Route selector, Owner & Shop Type details, **Address Remarks / Local Pehchan** field (`"PUMP KY ULTY HAATH ROAD PER ULTY HAATH JALI WALI SHOP"`), Google Map/GPS fields, and inline sub-tables for `+ Add Person & Contact Info` and `+ Add Account Info` (`Bank`/`EasyPaisa`/`JazzCash`).
- **Verification:** Create a customer with local Pehchan remarks, WhatsApp contacts, and EasyPaisa account; verify persistence.

### [x] Phase 036: Customer Master Data List, Bulk Commercial Rules & Customer ID Card Printer
- **Scope:** Build `/crm/customers` listing and bulk rule assignment toolbar (Wireframe Pages 57–58).
- **Backend & Frontend:** Filter customers by `Customer Type`, `Customer ID`, `Name`, `Contact No`, `Condition` (`Paid`, `Credit`, `Advance`), `Position` (`Visited`, `Delivered`, `Ordered`), `Area/Territory`, and `Status` (`Active`, `Blocked`, `Inactive`). Implement the **Apply Rule** toolbar to bulk-set `Payment Condition (Allow Credit)`, `Status (Blocked/Active)`, `Assign Person (Booker)`, `Assign Tax (GST %)`, `Assign Discount Group`, and `Assign Scheme Group`, plus printable **Customer ID Cards** and **Credit Reports**.
- **Verification:** Bulk-assign a Booker and Discount Group to selected customers in an Area and print Customer ID Cards.

### [x] Phase 037: Territory Master Management (`/crm/territories`)
- **Scope:** Implement `Territory.model.js` and Territory builder UI (Wireframe Pages 68–72).
- **Backend & Frontend:** Support 4 Territory types: `Brand Wise` (`SURAJ Double Horse`), `Warehouse Wise` (`ORANGI HOUSE`), `District Wise` (`ORANGI TOWN`), and `Booker Wise` (`IFTIKHAR SURAJ`). Build the interactive Territory creation wizard allowing the admin to search/filter Areas (`Qasba Colony`, `Miyan Wali`, `Kati Pahari`), add them to the Territory, and drill into each Area to toggle individual Routes (`Accept` / `Non Accept`).
- **Verification:** Create a Brand-Wise territory, connect 3 areas, accept/reject specific routes, and verify Wholesaler/Retailer totals.

### [x] Phase 038: Beat Plan Builder — Area, Route & Customer Acceptance Wizard (`/crm/beats`)
- **Scope:** Implement `BeatPlan.model.js` and the 4-step Beat Plan creation wizard (Wireframe Pages 73–79).
- **Backend & Frontend:** Build the hierarchical Beat Plan workflow:
  1. Assign Booker (`Assign Booker ID & Name: IFTI-001 / IFTIKHAR BHAI`) and Beat Day (`Monday`–`Sunday`).
  2. Create Beat (`BATB-1: ALIGARH TO BANARAS`) and connect Areas (`Aligarh`, `Banaras`, `Raees Amrohi`).
  3. Drill into each Area to connect Routes (`Aligarh Market Road`, `100 Fit Road`).
  4. Drill into each Route's **Customer Selection** table (`Nisar Chemical`, `Shah Trader`, `Karachi Confect`) to toggle `Accept` / `Non Accept` per customer, displaying live footer counters (`Accept: 4 | Non Accept: 2 | Wholesaler: 4 | Retailer: 2`).
- **Verification:** Build a complete Monday Beat Plan for a Booker and verify accepted customer counts.

### [x] Phase 039: Duplicate Beat & Multi-Booker Beat Search/Link Utility
- **Scope:** Implement the cross-booker beat search and cloning feature (Wireframe Pages 75–76: *"All Created Beat show of anywhere bookers in Create & Search Beat button for duplicate beat bookers link"*).
- **Backend & Frontend:** Allow admins to search any existing Beat created for any Booker, duplicate/clone its Area-Route-Customer structure with `Save & Duplicate`, and assign it to another Booker (e.g., a different brand's booker covering the same route).
- **Verification:** Clone an existing Beat Plan to a second Booker in 1 click and verify independent assignment.

### [x] Phase 040: Customer Profile 360° Drawer, Ledger Preview & Visit History
- **Scope:** Build the detailed Customer Profile view (`Profile` action in `/crm/customers`).
- **Backend & Frontend:** Display complete shop details, Pehchan landmark, GPS link, assigned Bookers, credit limit vs. current outstanding balance, recent orders, payment recovery history, and returned items.
- **Verification:** Open Customer Profile from the table and verify all tabs load real MongoDB data.

### [x] Phase 041: CRM & Territory Coverage Dashboard (`/crm/dashboard`)
- **Scope:** Build the dedicated CRM Dashboard (Wireframe Page 56 & 80 — CRM Part Complete milestone).
- **Backend & Frontend:** Display KPI counters for `Total Customers`, `Active Wholesalers`, `Active Retailers`, `Credit vs. Paid Customers`, `Blocked Accounts`, `Total Territories`, and `Weekly Beat Coverage %`, plus Area-wise customer distribution charts.
- **Verification:** Verify CRM Dashboard metrics match customer and beat records.

### [x] Phase 042: CRM Module Audit, Geo-Filter Indexing & Export Verification
- **Scope:** Audit Phases 033–041 for fast pagination, PDF/Excel export of Area/Route/Territory/Customer reports, and mobile responsiveness.
- **Verification:** Export Customer Credit Report and Beat Plan Sheet to PDF and Excel.

---

## Milestone 5: Master Commercial Rules Engine & Customizable Print Templates (Phases 043–050)

### [x] Phase 043: Commercial Rules Schema & Tax Group Management (`/settings/rules`)
- **Scope:** Build `CommercialRule.model.js` and Tax Group CRUD (Wireframe Pages 142–143).
- **Backend & Frontend:** Create the tabbed `Tax, Discount, Charge & Scheme Management` center (`/settings/rules`). Implement **Tax Groups** supporting Product-Level and Grand-Level tax rules (`GST 5%`, `GST 10%`, `Withholding Tax`, Flat or Percentage) with validity timelines (`All Time` or `Start Date/Time` to `End Date/Time` with auto `Expire` badge).
- **Verification:** Create Tax Groups and verify active/expired status calculation.

### [x] Phase 044: Product-Level & Grand-Level Discount Engine (`/settings/rules` — Discount Tab)
- **Scope:** Build Discount Group management (Wireframe Pages 144–149).
- **Backend & Frontend:** Implement two sub-tabs under `Discount Group`:
  1. **Product Level:** `General` flat discount (`Trader Offer Rs20`) or `Percentage` discount (`Ramadan Offer 10%`), with `All Time` or `Set Date & Time` timeline.
  2. **Grand Level:** Compare by `Amount (PKR)` (`10K Per Rs100 Offer` / `100K Per 7.5% Offer`) or `Weight (KG)` (`500KG Per Rs5000 Offer` / `500KG Per 7.5% Offer`), supporting both `General + Auto` (repeating multiples) and `Slab General` (fixed bracket) modes.
- **Verification:** Create Product-Level and Grand-Level discount rules (Amount and Weight based) and verify persistence.

### [x] Phase 045: Product-Level & Grand-Level Additional Charges Engine (`/settings/rules` — Charge Tab)
- **Scope:** Build Charge Group management for Loading, Delivery, and Packing charges (Wireframe Pages 150–155).
- **Backend & Frontend:** Implement two sub-tabs under `Charge Group`:
  1. **Product Level:** `General` or `Percentage` charges compared by `Quantity` (`Loading Charge Rs10 per Carton`), `Weight (KG)` (`1 KG Per Rs20`), or `Rate (Only)` (`Loading Charge 2%`).
  2. **Grand Level:** `Fix General` (`Rs 200`), `Fix %` (`1%`), or threshold-based by `Weight (KG)` (`100KG Per Rs100 Charge`) or `Amount (PKR)`.
- **Verification:** Create item-level and grand-level charge rules and verify calculation modes.

### [x] Phase 046: Product-Level & Grand-Level Scheme Engine (`/settings/rules` — Scheme Tab)
- **Scope:** Build Free Goods & Promotional Scheme management (Wireframe Pages 156–161).
- **Backend & Frontend:** Implement two sub-tabs under `Scheme Group`:
  1. **Product Level (`Product Wise` & `Slab Scheme`):** Configure `Paid Product` (`SURAJ Rs10`), `Paid Unit` (`Carton`), `Paid Quantity` (`10` or `25`), `Free Product` (same product `SURAJ Rs10` or cross-product `SURAJ 400g`), `Free Unit` (`Carton` or `Pcs`), and `Free Quantity` (`1`).
  2. **Grand Level (`Target Wise`):** Compare by `Amount` (`Target: 100,000 PKR -> Free Product: SURAJ 5kg Free, Qty: 1 Pcs`) or `Weight` (`Target: 500 KG -> Free Product: SURAJ Rs10 Free`).
- **Verification:** Configure same-product, cross-product, and target-weight/amount schemes.

### [x] Phase 047: Print Templates & Document Layout Schema (`PrintTemplate.model.js`)
- **Scope:** Build the backend model and API for customizable print templates (Wireframe Pages 162–167).
- **Backend (`server/`):** Store customizable configurations for all 3 document groups:
  1. **Invoices:** `Retail Invoice (POS View)`, `Wholesale Invoice (POS View)`, `Normal Invoice`, `Landscape Invoice`, `Delivery + Finance (Chillan + Finance) Invoice`, `Advance Invoice`.
  2. **Supply Docs:** `Delivery Dispatch`, `Salesman Sheet`, `Recovery Sheet`, `Booking Sheet`.
  3. **Reports Docs:** `Rate Lists`, `Presentation For Customer`, `Credit Reports`, `Current Stock`, `Stock Ledger`, `Stock Valuation`.

### [x] Phase 048: Visual Header, Footer, Signature & Notes Customizer UI (`/settings/templates`)
- **Scope:** Build the interactive Template Customizer screen (Wireframe Pages 162–167).
- **Frontend (`client/`):** Build tabs for `Print Layouts`, `Header`, `Footer`, and `Notes`:
  - **Header Customizer:** Toggle Logo, Company Name, Address, Subject, Font Family (`Arial`, `Inter`), Liner divider (`====`), Italic toggle, and Language (`English` / `Urdu`).
  - **Footer Customizer:** Configure up to 3 Signature Positions (`Position Sign 1/2/3`), Sign Lines, Footer Lines, Page Number, and Print Date.
  - **Notes Manager:** Create reusable invoice/report notes (`Delivery Note`, `Tax Note`, `Info Note`, `Caution Note`, `Important Note`).
- **Verification:** Customize an invoice header/footer in English and Urdu modes and preview it in `<PrintPreviewModal />`.

### [x] Phase 049: Two-Level Invoice Calculation Service (`invoiceCalc.service.js`)
- **Scope:** Build the deterministic math engine powering Normal Orders, Advance Orders, POS, and Salesman Edits (Wireframe Pages 85–115).
- **Backend & Frontend Shared Logic:** Implement pure, unit-tested calculation functions handling:
  - **Level 1 (Item):** Unit conversion, Weight (`Qty * UnitWeightKg`), Gross Rate (`Qty * Rate`), Reverse Sale Rate discount math (`Advance G` flat difference and `Advance %` percentage back-calculation), Item Discounts, Item Charges (by Rate/Qty/Weight), Item GST, and auto-generated Free Scheme rows (`Rate: 0, Amount: 0`, weight added).
  - **Level 2 (Grand):** Subtotal aggregation, Grand Discounts (Amount/Weight in `General+Auto`, `Slab General`, or `% + Auto`), Grand Charges (`Fix General`, `Fix %`, Weight/Amount multiples), Grand Target Free Schemes, and Final Net Payable Amount.
- **Verification:** Verify exact numbers from Wireframe Pages 90–115 (`SURAJ Rs10`, `Rate 1450`, `Qty 10`, `5.4 KG`, `Offer 5% -> 1368.42`, `50KG per Rs500 Off`, etc.).

### [x] Phase 050: Rules & Templates Integration Audit
- **Scope:** Verify that expired rules automatically stop applying on invoices and custom print templates render across all document types.
- **Verification:** Test `POST /api/v1/orders/calculate-preview` with combinations of item and grand rules.

---

## Milestone 6: Order & Sales Operations, 2-Level Order Workbench, Approval & Delivery Planning (Phases 051–062)

### [x] Phase 051: Order Master Schema, Filtration & Custom Column Listing (`/orders/master`)
- **Scope:** Build `Order.model.js` and the Order Master screen (Wireframe Pages 82–84).
- **Backend & Frontend:** Filter orders by `Customer`, `Date & Time`, `Area`, `Order ID`, `Source` (`ONLINE`, `BOOKER`, `ADMIN`, `POS`), `Order Type` (`REGULAR`, `URGENT`, `SPECIAL`, `POS`, `S. Dispatch`, `NORMAL`), and `Status` (`DRAFT`, `PENDING`, `APPROVED`, `DELIVERY`, `COMPLETE`, `CANCEL`). Include `Table List` / `Card View` toggle, `Show/Reset Columns`, action menu (`Invoice`, `Edit`, `Duplicate`, `Cancel`), and quick buttons for `Create Order (Normal / Advance)`, `Order Reports`, and `Order Operation`.
- **Verification:** Test filtering orders by source and status with server-side pagination.

### [x] Phase 052: Normal Order Creation Workbench — Level 1 Item Entry & Rules (`/orders/create-normal`)
- **Scope:** Build the Level-1 Item entry workbench for Normal Orders (Wireframe Pages 85–98).
- **Frontend (`client/`):** Build customer selector (with instant `+ Create Customer` modal trigger), `+ Create & Update Product` modal trigger, and the **Invoice Rules** toggle modal (`Discount Allow`, `Tax Allow`, `Scheme Allow`, `Charges Allow`). Implement live line-item entry supporting `General + Auto`, `Advance G` (custom Sale Rate), `% + Auto`, `Advance %` (auto back-calculated rate like `1368.42`), Weight/Rate/Qty Charges (`1 KG Per Rs20`, `L. Charge Rs10`, `L. Charge 1%`), and automatic Free Scheme row insertion (`10 Per 1 Free`).
- **Verification:** Add items with each discount, charge, and scheme type and verify live checklist table updates without lag.

### [x] Phase 053: Normal Order Creation Workbench — Level 2 Grand Summary & Rules
- **Scope:** Build the Level-2 Grand Summary & submission step for Normal Orders (Wireframe Pages 99–115).
- **Frontend (`client/`):** Display the live **Order Summary** bar (`T. Amount`, `G. Discount`, `T. Weight`, `T. Discount`, `T. Charges`, `Net Amount`), `A To Z / Z To A` item sorting, and **Grand Level Rules** selector (`10K Per Rs100 Offer`, `50KG per Rs500 Off`, `100K Per 7.5% Offer`, `D. Charge Rs200`, `100KG Per Rs100 Charge`, `10K Per Free Scheme`, and `Notes Allow: Delivery/Tax/Info/Caution Note`).
- **Verification:** Toggle Grand Level rules on a multi-item order and verify immediate recalculation of `Net Amount`.

### [x] Phase 054: Advance Order Creation Wizard — Step 1: Customer Credit & Warning Guard (`/orders/create-advance`)
- **Scope:** Build Step 1 of Advance Order Creation (Wireframe Page 116).
- **Frontend (`client/`):** Build the 4-step stepper (`Customer → Product → Preview → Submit`). In Step 1 (`Customer`), search customer by Name/Area/Route and immediately display **Customer Information** (`Type: Wholesaler`, `Outstanding: 10000`) and interactive **Warnings Info** badges with action overrides:
  - `Pending Order` (`Action`)
  - `Blocked` (`Action`)
  - `Credit Not Allow` (`Action`)
- **Verification:** Select a blocked or over-credit customer and verify warning badges and override permissions.

### [x] Phase 055: Advance Order Creation Wizard — Steps 2, 3 & 4: Chillan/Finance Layout, Print, Share & Assign
- **Scope:** Build Steps 2, 3, and 4 of Advance Order Creation (Wireframe Pages 117–122).
- **Frontend (`client/`):** Connect Step 2 (`Product` entry), Step 3 (`Preview`), and Step 4 (`Submit`). In Step 4, display `Customer Summary` (`Customer`, `Area`, `Route`, `Source`, `Status: Credited`, `Outstanding`), `Order Summary`, and **Invoice Style** selector (`Chillan + Finance`, `Detailed Landscape`, `Advance Invoice`, `Expiry & Batch Chillan`, with `Original & Duplicate` and `Caution/Tax Notes` toggles). Wire the 4 final action buttons:
  1. `View For Print`
  2. `Print & Send` (WhatsApp / Copy Link / Share PDF to Customer)
  3. `Submit & Assign` (select Salesman/Storekeeper and assign immediately)
  4. `Submit`
- **Verification:** Complete an Advance Order, preview all 4 invoice layouts, and test `Submit & Assign`.

### [x] Phase 056: Order Operations — Pending to Approved Queue & Stock Reservation (`/orders/operations`)
- **Scope:** Build the `Pending To Approved` tab in Order Operations (Wireframe Pages 123–125).
- **Backend & Frontend:** Filter pending orders by `Date`, `Area`, `Route`, `Source`, `Type`, and `Customer`. Display `Selected Order Summary` (`Total Approved: 25`, `Total Order Value: 138900`, `Total Weight: 34.000K`). Allow inspecting/editing individual order checklists (`Check Order`) and clicking **`Approve Selected`**, which atomically transitions orders to `APPROVED` and moves stock from `Available` to `Reserved`.
- **Verification:** Approve a batch of pending orders and verify `reservedBaseQty` increases in `stock_batches`.

### [x] Phase 057: Order Operations — Delivery Planning & Credit Recovery Selection
- **Scope:** Build the `Delivery Planning` tab in Order Operations (Wireframe Pages 126–129).
- **Backend & Frontend:** Allow the dispatcher to select multiple `APPROVED` orders **plus** existing unpaid/credit sales (`Order Recovery Assign Selected`) along the target route. Compute real-time vehicle load metrics:
  - `Total Selected Orders`
  - `Total Order Value (PKR)`
  - `Total Weight (KG)`
  - `Volume (Cubic Feet, e.g., 23F)`
- **Verification:** Select approved orders and credit bills; verify live aggregation of Value, Weight (`KG`), and Volume (`F`).

### [x] Phase 058: Synchronized 4-Sheet Generator (Bills, Dispatch, Sales Sheet, Recovery) & Staff Assignment
- **Scope:** Implement the 4-tab print/assignment bar at the bottom of Delivery Planning (Wireframe Pages 130–132).
- **Backend & Frontend:** From the selected Delivery Plan batch, generate and preview:
  1. **Bills:** Customer invoices ready for printing.
  2. **Dispatch:** Consolidated warehouse picking list assigned to `Store Keeper` (creates a `Delivery Dispatch` Pending Task).
  3. **Sales Sheet:** Route delivery manifest assigned to `Salesman` (creates a `Salesman Delivery` Pending Task).
  4. **Recovery:** Consolidated credit collection sheet assigned to `Salesman` or `Booker` (creates a `Payment Recovery` Pending Task, or `No Assign`).
- **Verification:** Assign a Delivery Plan and verify that Storekeeper and Salesman immediately receive their respective Pending Tasks and printable sheets.

### [x] Phase 059: Sales Master Listing, Credit Reports & Direct Payment Recording (`/sales/master`)
- **Scope:** Build `SaleInvoice.model.js` and `/sales/master` UI (Wireframe Pages 133–135).
- **Backend & Frontend:** List all sales with `Sale ID` (`S-01`), `Order ID` (`O-01`), `Customer`, `Area`, `Value`, `Outstanding`, `Assigned`, `Source`, and `Sale Status` (`Credit` / `Paid`). Include `Sales Report` generator (`Credit Reports`), `Table List` / `Card View`, and row actions (`Invoice`, `Reports`, `Recovery`, `Add Payment`).
- **Verification:** Filter credit sales, add a direct payment against a sale, and verify `Outstanding` balance updates.

### [x] Phase 060: Standalone Recovery Assignment Center (`/recovery/assign`)
- **Scope:** Build the dedicated Recovery module (Wireframe Pages 136–140).
- **Backend & Frontend:** Filter all credit/unpaid invoices by `Date`, `Area`, `Route`, `Source`, `Type`, `Customer`, `Assigned`, and `Status`. Allow inspecting individual invoice items (`Check Order / Check Recovery`), selecting multiple credit bills, entering `Task Name: Payment Recovery To Booker`, assigning to a Booker or Salesman, and printing the **Recovery Sheet**.
- **Verification:** Assign 10 credit bills to a Booker and verify the printable Recovery Sheet and Pending Task creation.

### [x] Phase 061: Daily Sales Report (DSR) Automated Aggregation Engine
- **Scope:** Implement the DSR requirement from PRD Section 6.5 & Wireframe Page 81.
- **Backend & Frontend:** Build `/sales/dsr` automatically summarizing daily Bookings, Approved Orders, Dispatched Load, Delivered Sales, Spot Returns, Cash/Online/Cheque Recoveries, and Trip Expenses by Booker, Salesman, Route, and Brand.
- **Verification:** Execute an order-to-recovery cycle and confirm DSR reflects accurate live totals.

### [x] Phase 062: Order & Sales Operations Milestone Audit
- **Scope:** End-to-end verification of Phases 051–061 (Wireframe Page 141 — Order & Sales Operations Complete milestone).
- **Verification:** Confirm zero calculation drift between Order Preview, Dispatch Sheet, Sales Invoice, and Recovery Sheet.

---

## Milestone 7: Pending Tasks & Warehouse / Field Execution Wizards (Phases 063–072)

### [x] Phase 063: Pending Task Queue & Task Lifecycle Engine (`/tasks/pending`)
- **Scope:** Build `PendingTask.model.js` and the Pending Task List UI (Wireframe Pages 168–170).
- **Backend & Frontend:** Display role-filtered task cards showing `Task Title` (`Payment Recovery`, `Current Stock Check`, `Dispatch Delivery For Supply`, `New Supply of SURAJ`), `Assign Time & Date`, `Due Date & Time` or `URGENT / Priority` badge, `Work Status` (`Fresh`, `Draft`, `Pending`, `Complete`), and actions (`View Info (Printed Document)`, `Start Task`, `Cancel`). Enforce mandatory task-wise closing.
- **Verification:** Log in as Storekeeper/Salesman, view assigned tasks, preview the printed task document, and click `Start Task`.

### [x] Phase 064: Task Wizard 1 — Delivery Dispatch & Extra Dispatch Buffer Stock (Storekeeper)
- **Scope:** Build the Delivery Dispatch execution screen (Wireframe Pages 171–173).
- **Backend & Frontend:** Group required dispatch items by `Zone` (`Main Plot`, `Main Shop`) → `Area` (`1st Floor`, `2nd Floor`, `Up Floor`) → `Category` (`Detergent Surf`) → `Sub Category` (`SURAJ White`, `Golden Green`) → `Product Name`, `Unit`, `MFG`, `EXP`, and `QTY`. Allow Storekeeper to tick items, adjust `R. QTY` (`- 15 +`), switch to **Extra Dispatch** tab to add extra van buffer stock (`New Extra Item Enter: Item Name, Unit, Quantity -> Add Item`), save as `Draft & Back`, or click `Complete`.
- **Verification:** Complete a Delivery Dispatch task with normal and extra dispatch items; verify stock moves to In-Transit/Dispatched state.

### [x] Phase 065: Task Wizard 2 — Payment Recovery Execution (Client List, Ledger, Cash/Online/Cheque & Extra Return)
- **Scope:** Build the guided Recovery task workflow (Wireframe Pages 174–180).
- **Backend & Frontend:**
  1. `Recovery Received`: Verify assigned credit bills (`Start Recovery`).
  2. `Recovery Client List`: Display customer cards with Shop Pic, Route, Customer Name, Street/Pehchan (`"PAKHTON Chock ULTY HAATH Street"`), Contact, Status (`Draft`, `Complete`, `Fresh`), and buttons for `Recover Payment`, `Recovery Ledger`, and `Cancel`.
  3. `Recovery Payment`: Support split/multi-method collection:
     - **Cash:** `Cash Amount`
     - **Online:** `Online Payment`, `Term Select` (`JazzCash`, `EasyPaisa`, `Bank`), `Trans ID`
     - **Check (Cheque):** `Check Amount`, `Check No`, `Bank Select`, `Due Date`
     - Auto-computes `Paid Amount` and remaining `Credit`.
  4. `Extra Return`: Allow picking up damaged/expired/normal returned items (`Item`, `Unit`, `Quantity`, `Rate`, `Total: -15760`, `Damage / Expire / Return`, `MFG/EXP`, `Remark`) and deducting from payable balance.
  5. `Recovery Result`: Print final **Recovery Sheet Result** and close task.
- **Verification:** Execute a customer recovery combining Cash + JazzCash + Cheque + 1 Damaged Return item and verify ledger balance update.

### [x] Phase 066: Task Wizard 3 — Return Received & Warehouse Put-Away (Storekeeper)
- **Scope:** Build the 3-step Return Received & Put-Away wizard (Wireframe Pages 181–187).
- **Backend & Frontend:**
  1. `Check & Received`: Inspect returned items across `Normal Return`, `Damage Return`, and `Expired Return` tabs; verify `R. QTY` (`- / +`) and tick items.
  2. `Move & Put Away`: Assign each verified batch (`MFG/EXP`, `Unit`, `Quantity`) back to a specific `Zone` (`Main Plot`) and `Area` (`SDW-10`) under `Normal`, `Damaged`, or `Expired` categories (`Put Away` button).
  3. `Create Return Movement`: Generate the printed **Return Movement Result** and update warehouse stock.
- **Verification:** Receive normal and damaged returns from a Salesman trip and put them away into their respective normal and damage floor areas.

### [x] Phase 067: Task Wizard 4 — Inter-Warehouse Transfer Dispatch, Receive & Put-Away
- **Scope:** Build the end-to-end Transfer Task execution wizard (Wireframe Pages 188–197).
- **Backend & Frontend:**
  1. **Source Warehouse (`Transfer Dispatch`):** Pick items by `Zone` & `Area`, adjust `R. QTY`, tick, and mark `Dispatch Complete`.
  2. **Transit (`Transfer Plan`):** Track `Dispatch Received` -> `Delivery Complete` -> `Down Away`.
  3. **Destination Warehouse (`Transfer Received` & `Put Away`):** Verify received quantities across `Normal`, `Damage`, and `Expired` tabs (recording any transit shortage/damage), assign destination `Zone` and `Area` (`Put Away`), and click `Create Transfer Movement` to print the **Transfer Movement Result**.
- **Verification:** Execute a full transfer from `ORANGI-001` to `BALDIA-001` and verify stock balances in both warehouses.

### [x] Phase 068: Task Wizard 5 — Normal-to-Expired Stock Quarantine (`Normal To Expire`)
- **Scope:** Build the expiry isolation workflow (Wireframe Pages 198–200).
- **Backend & Frontend:** Guide the Storekeeper through `Up Away` (picking expired/near-expiry batches from normal floor/rack areas), `Move & Put Away` (placing them into designated `Expired` quarantine zones/areas), and `Create Movement` to print the **Normal On Expired Movement Result**.
- **Verification:** Move an expired batch from a normal floor area to an expiry zone and verify batch `condition` and `status` update to `EXPIRE` / `QUARANTINED`.

### [x] Phase 069: Task Wizard 6 — Intra-Warehouse (`Same Transfer`) Up-Away & Put-Away
- **Scope:** Build the guided internal transfer task (Wireframe Pages 201–203).
- **Backend & Frontend:** Step 1 (`Up Away`): Pick items from source `Zone` & `Area` (`ASDH-10`). Step 2 (`Moved To`): Assign target `Zone` & `Area` (`SDW-10`) and click `Put Away`. Step 3 (`Create Movement`): Print **Same Transfer Movement Result**.
- **Verification:** Complete an internal warehouse transfer task and verify area quantities update.

### [x] Phase 070: Task Wizard 7 — Supplier Purchase Received & Put-Away
- **Scope:** Build the incoming supplier shipment verification and put-away wizard (Wireframe Pages 204–206).
- **Backend & Frontend:** Step 1 (`Purchase Received`): Verify incoming items, units, `MFG/EXP`, and `R. QTY` (`- / +`). Step 2 (`Put Away`): Assign `Zone` & `Area` locations for each batch. Step 3 (`Create Movement`): Print **Purchase Movement Result** and increment `Available` stock.
- **Verification:** Complete a Purchase Received task and confirm new batch stock becomes available for ordering.

### [x] Phase 071: Task Wizard 8 — Damage & Expiry Back to Company/Supplier
- **Scope:** Build the supplier return dispatch task (Wireframe Pages 207–209).
- **Backend & Frontend:** Step 1 (`Up Away`): Pick damaged/expired batches from quarantine areas (`ASDH-10`). Step 2 (`On Delivery`): Verify return load and driver/company person handoff. Step 3 (`Create Movement`): Print **Expiry & Damage Back Movement Result** and deduct quarantine stock.
- **Verification:** Complete a supplier damage return task and verify stock and supplier ledger updates.

### [x] Phase 072: Task Wizard 9 — Physical Stock Count & Keypad Adjustment (`Adjustment Stock Count`)
- **Scope:** Build the interactive physical stock audit wizard (Wireframe Pages 210–213 — Pending Tasks Complete milestone).
- **Backend & Frontend:** List batches by `Zone`, `Area`, `Product Name`, `MFG/EXP`, and `Available QTY (Pack & Base)`. Clicking `Form` opens the **Check Conditions & Count** screen featuring the dual on-screen numeric keypads (`0–9`, `+`, `-`) for **Pack** and **Base** units across `Normal`, `Missing`, and `Damaged` tabs (with tap `History` chips like `345 | 12`). Commit the adjustment and print **Adjustment Stock Movement Result**.
- **Verification:** Count stock using the touch keypad, record missing/damaged units, and verify ERP stock reconciles.

---

## Milestone 8: Dedicated Field & Counter Portals — Booker, POS Store & Salesman (Phases 073–082)

### [x] Phase 073: Order Booker Mobile Portal — Today Booking & Beat Acceptance (`/portal/booker`)
- **Scope:** Build the Booker landing portal and Beat acceptance screen (Wireframe Pages 214–216).
- **Backend & Frontend:** Display assigned daily Beats (`Beat ID: IFTI-001`, `Beat Day: Monday`, `Beat Name: QASBA To M.P.R`) with `Accept` buttons, `Accepted Beat Details` (`Total Areas: 3`, `T. Credited Customer: 65`, `T. Paid Customer: 86`), and `Start Booking`. Open the **Visited Customer List** with Area filter pills (`ALIGARH`, `BANARAS`, `RAEES AMROHI`), credit/paid filter (`Credit`, `Paid`, `Mix`), search bar, `+ Create New` customer button, and customer cards with `Book Order`, `Recover Payment`, and `Cancel` buttons.
- **Verification:** Log in as a Booker on a `375px` mobile viewport, accept Monday's Beat, and filter customers by area.

### [x] Phase 074: Order Booker Mobile Portal — Touch Product Grid, Keypad & Invoice Preview
- **Scope:** Build the fast mobile Order Booking screen for Bookers (Wireframe Pages 221–225).
- **Backend & Frontend:** Provide horizontal Category & Brand filter pills (`Detergent Surf`, `Dish Wash`, `Shampoo`, `Cleaners` / `SURAJ`, `White Wash`, `Waves`, `Green`), product search, and a 2-column product card grid showing `Product Name`, `Quantity`, `Sale Rate`, and `Unit` (`Carton` / `Piece`). Tapping a card opens the batch/unit selector and `<TouchKeypadModal />` (`0–9`, `X`, `OK`). Clicking `Check Order` previews the **Normal Invoice**, and `Create Order` submits the order and updates the customer card to `Complete`. Clicking `Booking Complete` prints/shares the daily **Booking Result**.
- **Verification:** Book an order on mobile using the touch keypad, preview the invoice, and complete the Beat.

### [x] Phase 075: Order Booker Mobile Portal — Beat & Brand Setup Drill-Down & Booking History Reports
- **Scope:** Build the Booker's `Beat & Brand Setup` and `Booking History & Reports` screens (Wireframe Pages 226–237 — Booker Profile Complete milestone).
- **Backend & Frontend:**
  - `Beat & Brand Setup`: Drill down through `Beats → Areas → Routes → Clients (with Street/Pehchan)` and `Categories → Brands → Products (with Pic & Rate)`.
  - `Booking History & Reports`: Filter past booking batches by `Date To Date`, `Day`, and `Batch Select`, and generate printable/shareable `Credited Reports` and `Booking Item` summary sheets.
- **Verification:** Navigate the Booker drill-downs and generate a Booking Item report for sharing.

### [x] Phase 076: Point of Sale (POS — Retail & Wholesale) Counter Portal (`/portal/pos`)
- **Scope:** Build the fast-checkout POS Store portal (Wireframe Pages 238–240).
- **Backend & Frontend:** Support both `Order to Point of Sale` (Walk-in `Independent` customer) and registered `Retail & Wholesale` customers. Include Category (`Liquid`, `Detergent Surf`, `Shampoo`, `Dish Wash`) and Sub-Category (`Bar`, `Liquid`, `Powder`) filter pills, Barcode/Name search with instant `+` add buttons, product cards with `Quantity`, `Sale Rate`, and `Unit` (`Carton` / `Piece`), `Check Order` modal, and 1-click `Print Invoice` / `Share` (A4 or Thermal POS receipt).
- **Verification:** Execute a walk-in POS sale and a wholesale POS sale; verify immediate stock deduction and receipt printing.

### [x] Phase 077: POS History, Daily Profit Tracking & Customer-Wise Sale Reports
- **Scope:** Build the `POS History & Reports` screen (Wireframe Pages 241–244 — POS Part Complete milestone).
- **Backend & Frontend:** Track daily POS batches showing `ID`, `Date`, `Day`, `Total Sale`, `Profit Value`, and `Total Client`. Support generating, previewing, printing, and sharing `Booking Item`, `Credited Reports`, and `Customer Wise Sale` reports.
- **Verification:** Verify POS daily profit calculation (`Sale Rate - Purchase Rate`) and report export.

### [x] Phase 078: Salesman Mobile Portal — Delivery Plan Verification (Bills, Recovery & Dispatch Stock)
- **Scope:** Build the Salesman portal landing & pre-trip verification workflow (`/portal/salesman`, Wireframe Pages 245–250).
- **Backend & Frontend:** Before starting delivery, the Salesman verifies 3 tabs:
  1. `Bill Received`: List of approved customer orders assigned for delivery.
  2. `Recovery Received`: List of past credit invoices assigned for collection.
  3. `Dispatch Received`: Consolidated product/batch quantities (`Normal Dispatch` and `Extra Dispatch` buffer stock, with ability to log `+ New Extra Item`).
- **Verification:** Log in as Salesman, verify all 3 pre-trip tabs, and click `Start Delivery`.

### [x] Phase 079: Salesman Mobile Portal — Route Customer List & On-Spot Invoice Modification (`Start Deal`)
- **Scope:** Build the Salesman's `Client Deal` & on-spot invoice editing engine (Wireframe Pages 251–258).
- **Backend & Frontend:** From the `Customer List`, clicking `Start Deal` opens the 3-tab deal workbench (`Original Invoice`, `Edit Invoice`, `Final Invoice`):
  - **Order Cancel:** Cancel entire order with mandatory `Remark` (`Cancel Status: Return`).
  - **Item Cancel / Item Edit:** Reduce item quantity (`Increase Item Quantity: -2 -> Status: Return` or `Damage`), edit `Sale Rate` (`1280`) or `Discount`.
  - **Extra Return:** Pick up additional damaged/expired items from the customer (`Damage / Expire / Return`, `MFG/EXP`, `-15760`).
  - **Extra Item Enter:** Sell additional quantities directly from the van's `Extra Items List` (`Delivered QTY` vs `Extra QTY -> Add In Order`).
- **Verification:** Modify an invoice on the spot (reduce 2 cartons as return, add 1 carton from extra dispatch stock) and verify `Final Invoice` math.

### [x] Phase 080: Salesman Mobile Portal — Grand-Level Deal Edit, Multi-Mode Payment & Trip Expense Logger
- **Scope:** Build the Salesman payment settlement, grand discount edit, and trip expense screens (Wireframe Pages 259–273).
- **Backend & Frontend:**
  - `Grand Level Edit`: Apply on-spot `Extra Discount Off: -200` with remark.
  - `Payment Submit`: Collect `Cash`, `Online` (`JazzCash`/`EasyPaisa` + `Trans ID`), and `Cheque` (`Check No`, `Bank`, `Due Date`).
  - `Expenses`: Log daily trip expenses across `Gas / Petrol`, `Enjoyment / Refreshment`, and `Work / Maintenance` with amounts and remarks.
  - `Supply Complete`: Generate printable **Sales Result (Salesman Sheet)** and **Recovery Result**, and automatically trigger Storekeeper Return Put-Away tasks for any undelivered/returned stock.
- **Verification:** Complete a full Salesman route, log fuel expense, close supply, and verify return tasks appear in Storekeeper queue.

---

## Milestone 9: Human Resource Management (HRM) & Double-Entry Financial Accounting (Phases 081–090)

### [x] Phase 081: HRM — Employee Master, Profile & Granular Work-Part Assignments (`/hrm/employees`)
- **Scope:** Build `Employee Master & Profile` and `Assign Work` screens (Wireframe Pages 274–277).
- **Backend & Frontend:** Manage employees (`Profile ID: GC-04523`, `Employ Name: IFTIKHAR AHMED`, Cloudinary photo, `Contact`, `Email`, `Login Info`, `Auto Linked Warehouse`, `Employ Role: Booker / Salesman / Storekeeper / POS / Accountant`). Build the **Work & Task** assignment panel allowing the Admin to toggle `Accept` / `Non Accept` for:
  - `Order Booker`
  - `Warehouse M`
  - `POS Store`
  - `Normal Invoice`
  - `Advance Invoice`
  - `Salesman`
- **Verification:** Toggle work parts for an employee and verify their sidebar navigation and route permissions update immediately.

### [x] Phase 082: HRM — Attendance, Leave Management, Payroll & Commission Engine (`/hrm/attendance`, `/hrm/payroll`)
- **Scope:** Build the complete HRM Attendance, Leave, Salary, and History/Reports modules (Wireframe Pages 278–281 & PRD Section 6/9).
- **Backend & Frontend:** Implement daily attendance check-in/out (`Present`, `Absent`, `Leave`, `Half-Day`), leave approval, monthly payroll generation (`Basic Salary` + automated `Booker/Salesman Commission` on delivered sales/recoveries - `Salary Advances`), payslip printing, and Employee Task Performance history.
- **Verification:** Record attendance, calculate monthly payroll with sales commission, and print a payslip.

### [x] Phase 083: ERP Accounts — Account Movement Verification Queue (`/accounts/movements`)
- **Scope:** Build the ERP Account Movement verification center (Wireframe Pages 282–285).
- **Backend & Frontend:** List all financial/stock movements (`Move. ID: M-011`, `Ref. ID: R-21`, `Date`, `Movement: Recovery | Delivery | POS Sale | Custom Sale`, `Payment Amount: 27000 | 118800`, `Prepare`, `Assign`, `Status: Pending | Approve`). Allow the Accountant/Admin to inspect the full report preview (`View Result`), click `Approved` to post final ledger entries, or `Generate Report` (`Export`, `Print`, `Send`).
- **Verification:** Approve a pending Recovery and Delivery settlement in `/accounts/movements` and verify ledger posting.

### [x] Phase 084: Double-Entry Chart of Accounts, Journal Voucher Engine & Day Book (`/accounts/ledgers`)
- **Scope:** Implement PRD Section 12 Double-Entry Financial Accounting (`AccountLedger.model.js`).
- **Backend & Frontend:** Maintain standard Chart of Accounts (`Assets`: Cash in Hand, Bank Accounts, JazzCash/EasyPaisa, Accounts Receivable, Inventory Stock; `Liabilities`: Accounts Payable, GST Payable; `Equity`; `Revenue`: Wholesale/Retail Sales; `Expenses`: COGS, Discounts Allowed, Freight/Loading, Salesman Fuel/Trip Expenses, Stock Damage/Loss, Salaries). Automatically post balanced Debit/Credit journal entries on every approved transaction and display the **Day Book** and **General Ledger** with full audit history.
- **Verification:** Verify `Total Debits === Total Credits` across automated and manual journal entries.

### [x] Phase 085: Accounts Receivable (Customer Ledger) & Accounts Payable (Supplier/Company Ledger)
- **Scope:** Build dedicated Customer and Supplier Ledgers with running balances and aging brackets (`0–30`, `31–60`, `61–90`, `90+ days`).
- **Backend & Frontend:** Provide filterable ledger statements showing Opening Balance, Invoice Debits, Cash/Online/Cheque Credits, Sales Returns, and Closing Balance, with 1-click PDF/Excel export and WhatsApp statement sharing.
- **Verification:** Reconcile a customer's ledger statement against their Sales Master and Recovery records.

### [x] Phase 086: Cheque Management, Bank Reconciliation & Expense Vouchers
- **Scope:** Build post-dated cheque tracking (`Pending` -> `Deposited` -> `Cleared` / `Bounced`) and Bank Reconciliation.
- **Backend & Frontend:** When a cheque collected during Recovery is marked `Cleared`, move funds from `Cheques in Hand` to `Bank Account`; if marked `Bounced`, automatically reverse the credit and restore the customer's `Outstanding Balance` with an alert notification.
- **Verification:** Test both Cheque Clearance and Cheque Bounce accounting reversals.

### [x] Phase 087: Financial Statements — Trial Balance, Profit & Loss (P&L), Balance Sheet & Cash Flow (`/accounts/statements`)
- **Scope:** Implement the 4 core financial statements required in PRD Section 12.
- **Backend & Frontend:** Build real-time aggregation pipelines and printable statement views for:
  1. **Trial Balance** (Debit vs. Credit column totals)
  2. **Income Statement / Profit & Loss (P&L)** (Gross Revenue, Returns, Net Sales, COGS, Gross Profit, Operating/Trip/Salary Expenses, Net Profit)
  3. **Balance Sheet** (Assets = Liabilities + Equity)
  4. **Cash Flow Statement** (Operating, Investing, Financing cash flows)
- **Verification:** Verify Trial Balance and Balance Sheet balance to the exact rupee (`PKR`).

### [x] Phase 088: Procurement & Supplier Purchase Order / Payment Workflow (`/procurement`)
- **Scope:** Complete PRD Section 8 Procurement & Supplier Management (`Supplier Master`, `Purchase Request`, `Purchase Order`, `Goods Receiving`, `Purchase Invoice`, `Purchase Returns`, `Supplier Payments`).
- **Backend & Frontend:** Connect low-stock purchase requirements into formal Supplier Purchase Orders, link Goods Receiving to the `Purchase` Stock Movement engine, and track Supplier Payments against Accounts Payable.
- **Verification:** Convert a Low-Stock Purchase Requirement into a Purchase Order, receive goods into a batch, and record a supplier payment.

### [x] Phase 089: Company Information Sharing Portal & Restricted B2B Export (`/reports/company-share`)
- **Scope:** Implement PRD Section 13.1 Company Information Sharing.
- **Backend & Frontend:** Allow Admins and authorized Bookers to generate and share company-isolated reports (`Company-wise Stock Position`, `Low Stock Information`, `Product Requirements`, `Company-wise Order & Sales History`) restricted strictly to that manufacturer's brands/SKUs so confidential data of other companies is never exposed.
- **Verification:** Generate a company share pack for `Green Chemicals` and confirm zero products from `Qazi Chemicals` appear.

### [x] Phase 090: Accounting & Procurement Milestone Audit
- **Scope:** Audit Phases 081–089 for transactional atomicity, audit logging, and export accuracy.
- **Verification:** Verify all financial statements and ledgers export cleanly to PDF, Excel, and CSV.

---

## Milestone 10: 10 Module Dashboards, 19+ Business Reports, Automation Engine & Final Polish (Phases 091–100)

### [x] Phase 091: Main Executive Dashboard & Role-Permissioned Dashboard Hub (`/dashboard`)
- **Scope:** Build the Main Business Executive Dashboard and unified switcher for all 10 required dashboards (PRD Section 10).
- **Backend & Frontend:** Ensure role-based visibility across:
  1. `Main Business Dashboard`
  2. `Inventory Dashboard`
  3. `Stock & Warehouse Dashboard`
  4. `Purchase Dashboard`
  5. `Sales Dashboard`
  6. `Accounts Dashboard`
  7. `Customer / CRM Dashboard`
  8. `Supplier Dashboard`
  9. `Employee / Task Dashboard`
  10. `POS Dashboard`
- **Verification:** Verify each of the 10 dashboards renders live MongoDB Atlas KPIs, charts, and pending work queues inside the viewport-locked shell.

### [x] Phase 092: Business Reporting Center — Part 1 (Sales, Purchase & Profitability Reports) (`/reports/center`)
- **Scope:** Implement Reports 1–6 and 17–19 from PRD Section 11:
  - `Daily Sales`, `Weekly Sales`, `Monthly Sales`, `Yearly Sales`, `Purchase Reports`, `Profit & Loss`, `Product-wise Profitability`, `Customer-wise Profitability`, and `Company/Brand-wise Performance`.
- **Backend & Frontend:** Provide unified filters (`Date Range`, `Product`, `Employee`, `Customer`, `Company`, `Brand`, `Warehouse`), full-page print preview, and 1-click `PDF`, `Excel (.xlsx)`, and `CSV` exports.
- **Verification:** Test filtering and exporting each report with real transaction data.

### [x] Phase 093: Business Reporting Center — Part 2 (Stock, Expiry, Task, Recovery, Expense & Tax Reports)
- **Scope:** Implement Reports 7–16 from PRD Section 11:
  - `Cash Flow`, `Customer Ledger`, `Supplier Ledger`, `Stock Movement`, `Batch-wise Stock`, `Expiry Reports`, `Employee Task Reports`, `Recovery Reports`, `Expense Reports`, and `Tax Reports`.
- **Verification:** Verify all 19+ reports are linked to actual MongoDB transactions and support custom print templates.

### [x] Phase 094: Real-Time Notification Center & 12 Automated Alert Triggers
- **Scope:** Implement PRD Section 14.1 Automatic Notifications (`Notification.model.js` + Topbar Bell flyout).
- **Backend & Frontend:** Trigger real-time notifications for all 12 events:
  1. `Low Stock Alerts`
  2. `Expiry Alerts`
  3. `Pending Order Approval`
  4. `Payment Due Alerts`
  5. `Customer Outstanding / Credit Limit Alerts`
  6. `Supplier Payment Due`
  7. `Employee Task Deadlines`
  8. `Delivery Pending`
  9. `Purchase Required`
  10. `Invoice Modification Alerts`
  11. `Invoice Cancellation Alerts`
  12. `Daily Business Summary`
- **Verification:** Trigger a low-stock event and an on-spot invoice edit; verify unread alerts appear in the Topbar Notification Bell.

### [x] Phase 095: Configurable Business Automation Rules Engine & Idempotency Guard
- **Scope:** Implement PRD Sections 14.2, 14.3 & 14.4 Automation Rules & Safety (`/settings/automation`).
- **Backend & Frontend:** Allow Admin to configure automated workflows (e.g., when a batch/product falls below `minStockPack`, automatically: 1. Flag low-stock product, 2. Fire low-stock alert, 3. Draft a Purchase Requirement, 4. Notify authorized staff, 5. Attach to Company Report) with strict idempotency keys so duplicate purchase requirements or duplicate accounting entries are never created.
- **Verification:** Deduct stock below minimum threshold twice and confirm only one active Purchase Requirement draft is generated.

### [x] Phase 096: Global Keyboard Shortcuts (`Ctrl+K` Command Palette) & Quick Action Launcher
- **Scope:** Wire the Topbar `Quick Start / Command Palette` (`Ctrl+K` / `Cmd+K`) for rapid navigation across all modules, quick order creation, POS launch, stock movement creation, and customer lookup.
- **Verification:** Press `Ctrl+K` from any screen, search a module or customer SKU, and jump directly without page reload.

### [x] Phase 097: High-Load Performance Stress Test, MongoDB Index Audit & Query Optimization
- **Scope:** Audit all 22 Mongoose models and aggregation pipelines for `explain("executionStats")` index usage, lean queries (`.lean()`), debounced search inputs, and zero `useEffect` re-render loops.
- **Verification:** Verify all paginated endpoints respond in `< 300ms` and UI interactions maintain `< 200ms` INP.

### [x] Phase 098: Cross-Device Responsive Audit (`320px` Mobile, `768px` Tablet, `1440px+` Desktop)
- **Scope:** Audit every page, table, modal, and print preview across mobile and desktop viewports.
- **Verification:** Confirm zero horizontal scrollbars, proper mobile card transformations on `< 768px`, and viewport-locked `100dvh` behavior on desktop.

### [x] Phase 099: Theme Consistency (Blue/White & Blue/Black), Zero-Purple & Anti-Slop Final Sweep
- **Scope:** Scan the entire `client/src/` codebase to ensure 100% adherence to `.agents/design.md` (Zero purple classes, smooth theme transitions, crisp 1px borders, `tabular-nums`, and human-crafted microcopy).
- **Verification:** Run a regex search across `client/src/` for `purple|violet|indigo|alert\(|confirm\(` and verify `0` matches.

### [x] Phase 100: Production Build Verification, `.env.example` Sync & Final Release Tag (`v1.0.0`)
- **Scope:** Final production readiness check across `client/` and `server/`.
- **Actions:** Verify `client/.env.example` and `server/.env.example` are complete, run `npm run build` in `client/`, verify `server` boots cleanly with Super Admin auto-seed, update all 100 phase checkboxes in `.agents/features-phases.md`, and push the final release commit following `.agents/git-sync.md`.
- **Verification:** ELITE DIST ERP v1.0.0 is 100% production-ready.

---

## Milestone 11: Master PRD v1.0 Final Baseline Alignment & Gap Closure (Phases 101–115)
*(Added after reconciling the 69-page Master PRD v1.0 against Phases 001–100. All phases below carry mandatory PRD §30.5 6-field traceability metadata.)*

### [x] Phase 101: Product Master Alignment — Optional Purchase Rate, Purchase Price Visibility RBAC & 8-Step Unit Versioning Engine
- **Scope:** Remove mandatory `purchaseRate` validation from Product creation/update; implement `unitVersions[]` inside `Product.model.js`, snapshot immutable `unitVersionId` & `conversionQty` onto `StockBatch.model.js`, auto-promote active default version when older batch stock hits zero, and strip/hide cost fields whenever `user.permissions.purchasePriceVisibility === false`.
- **Traceability (§30.5):**
  - `PRD Section`: §5.2, §5.3, §5.7, §5.8
  - `Source Module / Page`: Inventory / Product Master (`ProductForm`, `/api/v1/inventory/products`)
  - `Classification`: Confirmed / Extended
  - `Acceptance Criteria`: AC-03, AC-04
  - `Test Case`: Create SKU without `purchaseRate` (201); create Unit Version v2 (`50 pcs`) with existing v1 stock (`48 pcs`); verify dual-version transactions and cost column masking for non-authorized employee.
  - `Status`: Complete

### [x] Phase 102: Stock Issue Policy (`FIFO` / `FEFO` / `Manual`), Custom Condition Labels & `Blocked` Status Control
- **Scope:** Add `DistributorPolicy.model.js` storing `stockIssuePolicy` (`FIFO|FEFO|MANUAL`) and `customStockConditions[]` mapped cleanly onto official conditions (`FRESH|NORMAL|DAMAGE|EXPIRE`). Update `stockLedger.service.js` batch reservation sorting to obey distributor policy and block `BLOCKED`/`QUARANTINED`/`DAMAGE`/`EXPIRE` stock from normal allocation.
- **Traceability (§30.5):**
  - `PRD Section`: §6.1–6.7
  - `Source Module / Page`: Settings & Stock Allocation (`/settings/stock-policy`, `stockLedger.service.js`)
  - `Classification`: Confirmed / Extended
  - `Acceptance Criteria`: AC-06
  - `Test Case`: Switch policy from `FIFO` to `FEFO` and approve order; verify earliest-expiring non-expired batch is reserved while `Blocked` batches are skipped and `Available = Current - Reserved`.
  - `Status`: Complete

### [x] Phase 103: Warehouse Hierarchy (`Warehouse -> Zone -> Area`), Physical Stock Count Variance & 4-Step Zero-Stock Guard
- **Scope:** Standardize UI, routes, and labels to strict `Warehouse -> Zone -> Area` (`Normal/Mix/Temperature/Cold Store`; `Floor/Rack/Walked`), capture explicit Physical Stock Count columns (`System Qty`, `Physical Count Qty`, `Difference Qty`, `Updated Balance`), expose all 8 Warehouse Dashboard KPIs, and enforce the 4-step zero-stock deletion guard across all three levels.
- **Traceability (§30.5):**
  - `PRD Section`: §7.1–7.9, §8.6–8.7
  - `Source Module / Page`: Warehouse & Storage / Physical Stock Count (`/stock/warehouses`, `/stock/zones`, `/stock/areas`, `/stock/movements`)
  - `Classification`: Existing / Confirmed
  - `Acceptance Criteria`: AC-05
  - `Test Case`: Attempt to delete Area/Zone/Warehouse with `currentBaseQty > 0` -> expect 400 with remaining unit count; transfer stock to 0 -> verify deletion succeeds; verify Physical Count records `Difference = Physical - System`.
  - `Status`: Complete

### [x] Phase 104: 5-Step Purchase Receiving, Expected vs Received MFG/EXP Discrepancies & Segregated Put-Away + Purchase Return
- **Scope:** Upgrade `Purchase` movement workflow into all 5 stages (`Purchase Received -> Check & Received -> Move & Put Away -> Create Movement -> Purchase Movement Result` [24 fields]), add Expected vs Received quantity & MFG/EXP mismatch alerts, segregate `Normal` / `Damaged` / `Expired` destination storage areas at put-away, and link `Purchase Return` directly to source batch/company payable.
- **Traceability (§30.5):**
  - `PRD Section`: §9.1–9.8
  - `Source Module / Page`: Purchase Movement & Receiving (`/stock/purchase-receiving`, `/stock/movements/create`)
  - `Classification`: Existing / Confirmed
  - `Acceptance Criteria`: AC-07
  - `Test Case`: Receive 100 expected vs 95 Normal + 3 Damaged + 2 Expired with MFG mismatch alert; confirm 3 separate `StockBatch` condition placements and 24-field `Purchase Movement Result`.
  - `Status`: Complete

### [ ] Phase 105: Company-Wise Operational Payable Ledger & Isolated General Business Expenses (`Loading` / `Transport` / `Other`)
- **Scope:** Implement `Company-Wise Payable Account` (`Purchases`, `Purchase Returns`, `Payments Made`, `Outstanding Payable`, method/account/Ref no/Due date/Source transaction) under operational accounts, plus `GeneralExpense.model.js` for `Loading`, `Transport`, and `Other` general expenses guaranteed NEVER to alter `StockBatch.purchaseRate`.
- **Traceability (§30.5):**
  - `PRD Section`: §9.9, §9.10
  - `Source Module / Page`: Operational Accounts / Company Payable & General Expenses (`/accounts/company-payables`, `/accounts/expenses`)
  - `Classification`: Confirmed / Extended
  - `Acceptance Criteria`: AC-07
  - `Test Case`: Record PKR 50,000 Purchase + PKR 2,500 Transport expense -> confirm `StockBatch.purchaseRate` remains unchanged while `CompanyPayable` = 50,000 and `GeneralExpense` = 2,500.
  - `Status`: Pending

### [ ] Phase 106: Granular 5D Distribution Authorization (`Company x Brand x Product x Territory x Area`) & Multi-Shop Single-Owner CRM
- **Scope:** Add `territoryArrangements` 5D check helper on companies/territories so SKU sales/booking permissions validate exact `Company x Brand x Product x Territory x Area` eligibility; add `ownerGroupKey` on `Customer.model.js` linking multiple shops (e.g., Orangi / Baldia / Qasba) under one owner with completely isolated shop balances, ledgers, contacts (`Shopkeeper`, `Accountant`, `Store Keeper`), and payment accounts.
- **Traceability (§30.5):**
  - `PRD Section`: §4.2–4.5, §10.1–10.5, §11.1–11.3
  - `Source Module / Page`: CRM Customers, Companies & Territories (`/crm/customers`, `/inventory/companies`, `/crm/territories`)
  - `Classification`: Confirmed / Extended
  - `Acceptance Criteria`: AC-02, AC-08
  - `Test Case`: Link 2 shops to one Owner; sell SKU authorized in Area A but blocked in Area B -> verify Area B order rejected while Shop 1 balance stays isolated from Shop 2.
  - `Status`: Pending

### [ ] Phase 107: Independent Booker Visit Completion (`Visited` Tag), Daily Beat Ops & `Booking Skip` Workflow
- **Scope:** Add `VisitLog.model.js` and upgrade Booker portal (`/portal/booker`) so checking in at a customer completes the stop with final tag **`Visited`** independently of whether an order, recovery, or payment occurred; wire all 12 Booker actions including **`Booking Skip`** with structured reason logging and Beat Duplication + Daily Beat booking counters.
- **Traceability (§30.5):**
  - `PRD Section`: §11.4–11.5, §12.1–12.4
  - `Source Module / Page`: CRM Beats & Booker Mobile Portal (`/crm/beats`, `/portal/booker`)
  - `Classification`: Confirmed
  - `Acceptance Criteria`: AC-08
  - `Test Case`: Complete Booker visit with zero order (`Booking Skip` with reason) -> verify customer visit status = `Visited` and skip reason logged in Booking Sheet.
  - `Status`: Pending

### [ ] Phase 108: Order Verification (`Official` Source, `Write Your Own` Customer), POS/Booking Permission Guards & Rule Snapshots
- **Scope:** Enforce verified Order sources (`Online`, `Booker`, `Admin`, `Official`) & types (`Urgent`, `POS`, `Special`, `Regular`, `Normal`, `S. Dispatch`), add **`Write Your Own`** inline ad-hoc customer mode in Orders & POS, enforce `Product.posPermission` / `bookingPermission`, and persist immutable `ruleApplicationSnapshot` + `customerSnapshot` on approval.
- **Traceability (§30.5):**
  - `PRD Section`: §5.2, §13.1–13.5, §18.6–18.8
  - `Source Module / Page`: Order Create / POS Portal (`/orders/create-normal`, `/orders/create-advance`, `/portal/pos`)
  - `Classification`: Existing / Confirmed
  - `Acceptance Criteria`: AC-09
  - `Test Case`: Place POS sale using `Write Your Own` customer; attempt POS sale for SKU with `posPermission: false` (blocked); update discount rule after approval and verify existing order invoice math stays frozen.
  - `Status`: Pending

### [ ] Phase 109: Salesman Client Deal 3-Stage Architecture (`Original` Immutable Snapshot, `Edit` Deltas, `Final`) & `Sales Skip`
- **Scope:** Refactor `SaleInvoice.model.js` and Salesman Deal UI (`/portal/salesman`, `/sales/master`) into 3 explicit stages: frozen `Original Invoice` (`Report 22.13`), tracked `Edit Invoice` deltas (`Item Return/Cancel`, `Extra Item`, `Extra Return` [`OK`/`SKIP`], `Grand Level Edit`), and `Final Invoice` (`Report 22.14`). Implement 6-rule **`Sales Skip`** producing explicit `Sales Result` entries in Salesman Sheets.
- **Traceability (§30.5):**
  - `PRD Section`: §15.1–15.10, §22.13–22.14
  - `Source Module / Page`: Salesman Portal & Sales Master (`/portal/salesman`, `/sales/master`)
  - `Classification`: Existing / Confirmed / Extended
  - `Acceptance Criteria`: AC-10
  - `Test Case`: Edit invoice qty and add return/extra item at doorstep -> confirm `Original Invoice` snapshot matches initial approved bill untouched; perform `Sales Skip` and verify `Sales Result` appears on Salesman Sheet without faking `$0` completed sale.
  - `Status`: Pending

### [ ] Phase 110: Recovery Skip, Split Payment Methods, Field Recovery Expenses & Cash Handover Reconciliation
- **Scope:** Upgrade `Recovery.model.js` and Recovery screens (`/recovery/assign`, `/recovery/cash-handover`, `/portal/booker`) for multi-method split recovery entries (`Cash`, `Check`, `Online`, `Bank account`, `Easy Paisa`, `Jazz Cash`), **`Recovery Skip`** generating `Recovery Result` in Recovery Sheets, and **Cash Handover** capturing `Gas / Petrol`, `Enjoyment`, `Works`, `Total Due Cash`, `Total Cash Received`, and `Shortage / Extra`.
- **Traceability (§30.5):**
  - `PRD Section`: §16.1–16.9, §22.8
  - `Source Module / Page`: Recovery & Cash Handover (`/recovery/assign`, `/recovery/ledger`, `/recovery/cash-handover`)
  - `Classification`: Confirmed / Extended
  - `Acceptance Criteria`: AC-11
  - `Test Case`: Collect PKR 10,000 cash + log PKR 800 Gas/Petrol + receive PKR 9,100 physical cash -> verify `Total Due Cash = 9,200`, `Shortage = -100`, customer receivable credited full PKR 10,000, and `Recovery Skip` writes non-payment Result row.
  - `Status`: Pending

### [ ] Phase 111: Operational Accounts Alignment (10 Record Types + 5 Invoice/Recovery Ledger Types) & §29 Exclusions Cleanup
- **Scope:** Replace/refactor `AccountLedger` GL endpoints into `OperationalLedger` serving all 10 PRD §17.3 operational account views (`Customer Ledger`, `Recovery Ledger`, `Invoice Ledger` with strict 5 event types [`Extra Return`, `Extra Item`, `Extra Discount`, `Charge Off`, `Paid Payment`], `Company-Wise Payable`, `Payment History`, `Outstanding`, etc.), and cleanly hide/de-scope excluded §29 modules (`Journal Entries`, `Trial Balance`, `Balance Sheet`, standalone `Supplier Master`, `PR`/`PO`, `Marketplace`).
- **Traceability (§30.5):**
  - `PRD Section`: §4.2, §9.1, §17.1–17.3, §22.15, §29
  - `Source Module / Page`: Operational Accounts & Inventory/Purchase (`/accounts/*`, Sidebar nav)
  - `Classification`: Confirmed / Out of Scope Cleanup
  - `Acceptance Criteria`: AC-12
  - `Test Case`: Verify Invoice/Recovery Ledger filters strictly by all 5 official event types; confirm excluded Journal/Trial Balance/Balance Sheet/PO/Supplier routes are removed from operational flow.
  - `Status`: Pending

### [ ] Phase 112: 13-Point Employee Permission Matrix, Warehouse Scoping & Mandatory `Coming Soon` Gating (§30.2)
- **Scope:** Implement the full 13-point permission editor & backend middleware checks (`moduleAccess`, `screenAccess`, `canView`, `canCreate`, `canEdit`, `canDelete`, `canSubmit`, `canApprove`, `canStockMovement`, `canPayment`, **`purchasePriceVisibility`**, `reportAccess`, `assignedWarehouseIds[]`). Gate all `§30.2` incomplete areas (`Tax Group`, flagged incomplete `Scheme Group` sections, `HRM History & Reports`, `Payroll & Salary`, `Attendance & Leaving`, and public `/auth/signup`) with HTTP `501` backend guards & UI `<ComingSoonModal />` badges.
- **Traceability (§30.5):**
  - `PRD Section`: §1.3, §18.2, §18.5, §20.1–20.5, §30.2
  - `Source Module / Page`: HRM Employees, Commercial Rules & Auth (`/hrm/*`, `/settings/rules`, `/auth/signup`)
  - `Classification`: Confirmed / Pending (`Coming Soon`)
  - `Acceptance Criteria`: AC-03, AC-13
  - `Test Case`: Restrict user to Warehouse A and toggle `purchasePriceVisibility = false` -> verify Warehouse B stock is inaccessible and purchase cost hidden; click Tax Group / HRM Payroll -> verify `<ComingSoonModal />` opens cleanly.
  - `Status`: Pending

### [ ] Phase 113: Dual Reporting System (System A Official vs System B Shareable Custom Templates) & All 15 Official Reports (§22.1–22.15)
- **Scope:** Implement/verify all **15 Official Reports (`22.1` Current Stock through `22.15` Invoice / Recovery Ledger List)** with exact PRD §22.8 & §23 reconciliation formulas and all 20 global filter dimensions; separate protected **System A ELITE DIST Official Reports** from **System B User-Specific Custom Report Templates** with tenant data sanitization before template sharing.
- **Traceability (§30.5):**
  - `PRD Section`: §18.9–18.15, §21.1–21.3, §22.1–22.15, §23.1–23.8
  - `Source Module / Page`: Reports Center & Custom Templates (`/reports/center`, `/settings/templates`)
  - `Classification`: Confirmed / Extended
  - `Acceptance Criteria`: AC-12
  - `Test Case`: Run `22.8 Delivery Sales Movement`, verify exact `Net Amount` & `Balance` equations; attempt to edit official report as tenant admin (blocked); share custom template across Tenant A -> Tenant B verifying zero Tenant A records appear.
  - `Status`: Pending

### [ ] Phase 114: 16-Part Navigation, 4 Module Dashboards, Urdu/English Print Layouts & 7-Operation Idempotency Guard
- **Scope:** Align `<Sidebar />` cleanly around the **16 Main Navigation Parts (`§24.1`)**, focus top dashboard tabs on the **4 Confirmed Module Dashboards** (`Product`, `Stock`, `Customer`, `Warehouse`), upgrade `PrintTemplate` for Urdu/English Header/Footer/Notes & 6 Invoices + 4 Supply Docs (`Delivery Dispatch`, `Salesman Sheet`, `Recovery Sheet`, `Booking Sheet`), and wire `IdempotencyRecord` (`idempotencyKey` middleware) across all **7 critical write operations (`§26.4`)**.
- **Traceability (§30.5):**
  - `PRD Section`: §18.9, §24.1–24.4, §25.1–25.4, §26.4–26.6
  - `Source Module / Page`: AppShell Navigation, Print Preview & API Idempotency Middleware (`Sidebar.jsx`, `PrintPreviewModal.jsx`, `idempotency.service.js`)
  - `Classification`: Confirmed / Recommended
  - `Acceptance Criteria`: AC-01, AC-13
  - `Test Case`: Replay identical Order/Payment/Purchase/Movement request twice rapidly with same `idempotencyKey` -> verify single DB document written cleanly with idempotent replay response.
  - `Status`: Pending

### [ ] Phase 115: Master PRD v1.0 End-to-End Acceptance Verification (`AC-01` to `AC-13`) & Production Parity Audit
- **Scope:** Execute end-to-end verification covering all 13 Acceptance Criteria groups (`AC-01` through `AC-13`), Historical Data Protection checks (`§3.3`), Light/Dark Blue & Zero-Purple CSS checks, `100dvh` desktop + `375px` mobile stacked card responsive verification, `node --check`, and `npm run build`.
- **Traceability (§30.5):**
  - `PRD Section`: §3.3, §28.1–28.13, §30.4–30.5
  - `Source Module / Page`: Full `client/` & `server/` Integration
  - `Classification`: Confirmed
  - `Acceptance Criteria`: AC-01 through AC-13
  - `Test Case`: Full regression run across DUA reference tenant + secondary SaaS tenant verifying zero cross-tenant leakage, zero console errors, zero dead buttons, and 100% pass across AC-01..AC-13.
  - `Status`: Pending
