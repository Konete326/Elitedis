# Master Project Rules & AI Agent Engineering Constitution (`project-rules.md`) — ELITE DIST

- **Product Name:** ELITE DIST — Enterprise Resource Planning (ERP) & Sales Force Automation (SFA) System for Distributors
- **Document Path:** `.agents/project-rules.md`
- **Version:** 1.0 (Production Master Governance & Coding Rules)
- **Date:** November 2026
- **Architecture Lock:** Split Monorepo (`client/` + `server/`) on the **MERN Stack** (`MongoDB Atlas` + `Express.js` + `React 19 (Vite)` + `Node.js`) + `Tailwind CSS` + `Cloudinary`

---

## 1. Mandatory Pre-Execution Protocol for AI Coding Agents

Before writing, editing, or deleting a single line of code in any phase, the AI coding agent MUST read and cross-reference all 7 specification files inside `.agents/`:
1. `.agents/PRD.md` — Product functional scope, modules, and business rules.
2. `.agents/SRD.md` — System architecture, non-functional requirements, and data isolation rules.
3. `.agents/TRD.md` — Exact folder structure, 22 Mongoose schemas, REST API routes, and `.env` contracts.
4. `.agents/design.md` — Blue & White (Light) / Blue & Black (Dark) tokens, zero-purple mandate, viewport-locked shell, and anti-loop rules.
5. `.agents/project-rules.md` — This constitution.
6. `.agents/git-sync.md` — Git branch, commit, secret protection, and phase-wise push protocol.
7. `.agents/features-phases.md` — The 100-Phase sequential execution roadmap.

---

## 2. Architecture & Split-Folder Rules (`client/` & `server/`)

### 2.1 Strict Split Monorepo Structure
- The repository is strictly divided into three top-level directories:
  - `.agents/` — Master documentation and phase tracking.
  - `server/` — Node.js + Express.js REST API + Mongoose ODM + Cloudinary SDK.
  - `client/` — React 19 + Vite + Tailwind CSS Single-Page Application (SPA).
- **Never mix frontend and backend dependencies** in a root `package.json` unless it is exclusively for workspace runner scripts. `client/package.json` and `server/package.json` must remain independent so both can be deployed separately to cloud hosts (Vercel/Netlify/Render/Railway/VPS).
- **Zero Django / Python Artifacts:** Any reference to Django in legacy sample conversations was strictly for structural inspiration. Creating `.py`, `manage.py`, `requirements.txt`, or SQLite files is a critical violation.

### 2.2 File Size & Modularity Cap (Max 300–400 Lines)
- No controller, service, model, or React component may exceed **350–400 lines of code**.
- If a module (such as the 2-Level Invoice Workbench or Stock Movement Wizard) grows complex, split sub-sections into focused sub-components or service helpers rather than dumping everything into one giant file.

### 2.3 Latest Stable Package Rule
- Whenever installing packages in `client/` or `server/`, always install the latest stable release (`npm install <pkg>@latest`) and verify peer dependency compatibility with React 19 and Node 20+.

---

## 3. Environment Variables & Zero-Hardcoded Secrets Rule (`.env`)

### 3.1 Dual `.env` Isolation
- `server/.env` controls all backend configurations: `PORT`, `MONGODB_URI` (MongoDB Atlas), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_ROOT_FOLDER`, `CLIENT_URL`, and Super Admin bootstrap credentials (`SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PHONE`, `SUPER_ADMIN_PASSWORD`, `DEFAULT_DISTRIBUTOR_CODE`, `DEFAULT_DISTRIBUTOR_NAME`).
- `client/.env` controls all frontend configurations: `VITE_APP_NAME`, `VITE_API_BASE_URL`, `VITE_DEFAULT_PAGE_SIZE`, `VITE_DASHBOARD_PAGE_SIZE`, and `VITE_CLOUDINARY_UPLOAD_PRESET`.

### 3.2 Zero Hardcoded Credentials
- Never hardcode MongoDB URIs, Cloudinary keys, JWT secrets, localhost ports, or Super Admin passwords inside any `.js` or `.jsx` file.
- Maintain `server/.env.example` and `client/.env.example` with safe placeholder keys so any developer or deployment pipeline knows the exact required variables.
- On server startup (`server/src/config/env.js`), validate that all required `.env` keys exist; if any critical key is missing, log a clear human-readable error message and exit cleanly.

### 3.3 Idempotent Super Admin Bootstrap
- On server startup (`server/src/config/seedSuperAdmin.js`), check if a user with `email: process.env.SUPER_ADMIN_EMAIL` exists in MongoDB Atlas.
- If not found, automatically hash `process.env.SUPER_ADMIN_PASSWORD` with `bcryptjs` and create the `SUPER_ADMIN` account under `process.env.DEFAULT_DISTRIBUTOR_CODE` with all `workParts` enabled (`true`).
- Never overwrite or duplicate the Super Admin on subsequent server restarts.

---

## 4. Database, Cloudinary Media & High-Load Scalability Rules

### 4.1 MongoDB Atlas & Zero Dummy Bloat Mandate
- **No Fake Dummy Data Arrays in Code:** Never ship hardcoded dummy arrays (`const dummyProducts = [...]`) inside frontend pages or backend controllers. Every table, chart, dropdown, and KPI card must query real data from MongoDB Atlas via the Express API.
- **Clean Empty States:** When a collection has `0` records, render a clean, theme-aware Empty State card with a direct action button (e.g., `+ Add First Product`, `+ Create Warehouse`) so the user can immediately populate real records.
- **Compound Indexes for Heavy Load:** Every Mongoose model must define compound indexes starting with `{ distributorId: 1, ... }` (e.g., `{ distributorId: 1, skuCode: 1 }`, `{ distributorId: 1, status: 1, createdAt: -1 }`) so queries remain sub-second even with 1,000,000+ documents.
- **Mandatory Server-Side Pagination:** Every list endpoint (`GET /products`, `GET /stocks/batches`, `GET /customers`, `GET /orders`, `GET /sales`, `GET /movements`, `GET /accounts/movements`) must accept `page`, `limit`, `search`, `sortBy`, `sortOrder`, and module-specific filter query params, returning:
  ```json
  {
    "success": true,
    "data": [...],
    "pagination": {
      "totalRecords": 3465,
      "currentPage": 1,
      "totalPages": 347,
      "pageSize": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
4.2 Cloudinary Image Pipeline Rule
All images (Company Logos, Brand Logos, Brand Covers, Category Pics, Product Base Item Images, Product Pack Item Images, Customer Shop Pics, Employee Avatars, Payment/Cheque Receipts) must be uploaded to Cloudinary under structured folders (elite_dist_erp/companies, elite_dist_erp/products, elite_dist_erp/customers, etc.).

Store only { url: result.secure_url, publicId: result.public_id } in MongoDB Atlas.

Never store Base64 image strings in MongoDB documents or local disk folders that vanish on cloud redeploys.

When a record's image is replaced or the record is deleted, automatically call cloudinary.uploader.destroy(publicId) to prevent orphan cloud storage bloat.

5. Theme, UI/UX, Viewport & Anti-Slop Rules (design.md + unslop + stageshow)
5.1 Strict Blue & White / Blue & Black Theme (Zero Purple)
Light Mode: Pure White (#FFFFFF) and Cool Alabaster Slate (#F8FAFC) backgrounds with Royal/Ocean Blue (#0284C7 / #2563EB) primary accents and crisp #E2E8F0 1px borders.

Dark Mode: True Obsidian Black (#06090F) and Deep Carbon Navy (#0B1120) backgrounds with Luminous Electric/Cyan Blue (#38BDF8 / #3B82F6) primary accents and #1E293B 1px borders.

Absolute Ban on Purple: Never use #8b5cf6, #a855f7, #6366f1, purple-*, violet-*, or indigo-* classes anywhere in the app.

Unified Theme Transitions: All surfaces, borders, text, icons, and charts must transition smoothly (transition-colors duration-200 ease-out) when toggling between Light and Dark mode.

5.2 Viewport-Locked Desktop (100dvh) & Zero Unnecessary Page Scroll
Desktop layouts (>= 1024px) must use <AppShell /> locked to h-dvh overflow-hidden.

The Topbar, Page Title, KPI Summary Strip, and Filter Toolbar stay fixed in view; only the inner data container or split-panel body scrolls vertically when needed, paired with server-side pagination (5 rows on dashboard tables, 10 rows on master tables) so pages fit cleanly without browser window scrollbars.

5.3 Mobile-First Responsive Design (320px to 4K)
Built mobile-first with Tailwind CSS.

On viewports < 768px, <SmartDataTable /> must automatically switch from multi-column desktop tables to Mobile Stacked Cards with touch-friendly 44px minimum tap targets, swipe/tap actions, and <TouchKeypadModal /> for fast numeric entry in Booker, Salesman, POS, and Stock Count workflows.

5.4 Zero AI Slop & Beginner-Friendly Operational Flow
Unslop Copywriting: No robotic filler, no fake marketing slogans, no emoji headings, and no vague error messages. Every label, button, tooltip, and step wizard must be crystal clear so even a child or first-time operator immediately understands what is happening and where to click next.

Authentic Icons: Use lucide-react icons consistently sized (w-4 h-4 or w-5 h-5, strokeWidth={1.75}). Never use stock AI sparkles (Sparkles icon is banned) or mismatched cartoon SVGs.

5.5 Mandatory Global Components & Zero Native Popups
window.alert(), window.confirm(), and window.prompt() are strictly forbidden.

Every page must reuse <AppShell />, <Sidebar />, <Topbar />, <MetricCard />, <SmartDataTable />, <PaginationBar />, <FilterToolbar />, <ConfirmModal />, <FormModal />, <ComingSoonModal />, <PrintPreviewModal />, <TouchKeypadModal />, <ImageDropzone />, and <ToastContainer /> from client/src/components/global/.

Every unbuilt route or future feature button must open <ComingSoonModal />, and unknown URLs must render <NotFound404 />.

6. Critical Business Logic Rules (Non-Negotiable Domain Invariants)
Product Master vs. Stock Separation: Never mix static catalog fields with batch quantities. Every purchase creates a StockBatch record with its own batchNo, mfgDate, expDate, purchaseRate, condition, and status.

Multi-Unit & Volume Math: Every product supports a Base Unit and Packing Units (Carton, Dozen, Box, Sack) with auto-calculated packingWeightKg = baseWeightKg * conversionQty, Area = W * L, and Volume = W * L * H.

Zero-Quantity Warehouse Area Deletion Guard: A Warehouse, Zone, or Floor/Rack Area cannot be deleted if currentBaseQty > 0 for any batch stored in that location. The API must return 400 Bad Request instructing the user to execute a Stock Movement first to bring the quantity to 0.

Stock Reservation Lifecycle:

Booking an order (PENDING) does not deduct physical stock.

Approving an order (APPROVED) atomically moves the required quantity from availableBaseQty to reservedBaseQty.

Cancelling an approved order releases reservedBaseQty back to availableBaseQty.

Completing delivery deducts only the delivered quantity from currentBaseQty and reservedBaseQty.

Two-Level Invoice Calculation Engine:

Level 1 (Item Level): Supports Base/Packing unit rates, Reverse Custom Sale Rate (Advance % / Advance G back-calculating exact discount), Item Flat/% Discounts, Item Charges (by Rate, Qty, or KG), Item GST %, and Free Scheme rows (isFreeSchemeRow: true, rate: 0, amount: 0, weight included).

Level 2 (Grand Level): Aggregates Total Items, Total Qty, Total Weight (KG), Total Volume (Cubic Feet), and Gross Amount, then applies Grand Discounts (Amount or Weight based in General+Auto, Slab General, or % + Auto mode), Grand Charges, Grand Target Schemes, and Invoice Notes.

Mandatory Task-Wise Closing & Double-Entry Accounting Sync: Every Delivery Dispatch, Salesman Deal, Recovery Collection, Return Put-Away, Warehouse Transfer, and Stock Adjustment must close its linked PendingTask and atomically post balanced Debit/Credit entries to AccountLedger.

7. Anti-Loop & Code Quality Verification Checklist (Run Before Completing Any Phase)
Before marking any phase complete in features-phases.md, verify:

[ ] Zero useEffect infinite fetch loops (all API calls use stable primitive dependencies or TanStack Query keys).

[ ] Zero console errors, zero unhandled Promise rejections, and zero broken imports in both client/ and server/.

[ ] Both Light Mode (Blue & White) and Dark Mode (Blue & Black) render with high contrast and zero purple classes.

[ ] Desktop view (>= 1024px) fits cleanly inside 100dvh without double scrollbars; Mobile view (375px) renders responsive stacked cards without horizontal overflow.

[ ] .env variables are respected and .env files are excluded from Git tracking.