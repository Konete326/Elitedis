# ELITE DIST — Master Workspace Rules & AI Agent Constitution

This rule file is **always active** for every task executed in `d:\project\Elitedis`.

## 1. Mandatory Pre-Execution Protocol (Run Before Every Task)
Before writing, editing, or deleting a single line of code in any task or phase, you **MUST** read and cross-reference the master specification files inside `.agents/`:
1. `.agents/prd.md` — Product functional scope, modules, and business rules.
2. `.agents/srd.md` — System architecture, RBAC/work-parts, NFRs, and multi-distributor data isolation (`distributorId`).
3. `.agents/trd.md` — Exact `client/` + `server/` folder structure, 22 Mongoose models, 13 controllers, 4 services, 14 global UI components, and `.env` contracts.
4. `.agents/design.md` — Blue & White (Light) / Blue & Black (Dark) CSS tokens, Zero-Purple mandate, `100dvh` viewport-locked `<AppShell />`, mobile stacked cards, tabular numerals, z-index hierarchy, and 8 anti-loop guardrails.
5. `.agents/rules.md` — Master governance and coding rules (`project-rules.md`).
6. `.agents/git-sync.md` — Git `.gitignore`, branching, commit convention, and 6-step post-phase sync protocol.
7. `.agents/features-phases.md` — The 100-Phase sequential execution roadmap (`[ ]` -> `[x]`).

## 2. Architecture, Stack & Modularity Lock
- **Strict Split Monorepo**: Only three top-level directories: `.agents/`, `server/` (Node.js v20+ + Express.js + Mongoose + Cloudinary SDK), and `client/` (React 19 + Vite + Tailwind CSS + React Router v7 + TanStack Query + Lucide React).
- **Independent Dependencies**: Never mix frontend and backend dependencies in a root `package.json`. Install latest stable packages (`npm install <pkg>@latest`) compatible with React 19 and Node 20+.
- **Zero Prohibited Artifacts**: Never create Python/Django files (`.py`, `manage.py`, `requirements.txt`, SQLite) or Next.js SSR files.
- **File Size Cap**: No controller, service, model, or React component may exceed **350–400 lines of code**. Split complex modules into focused sub-components or helper services.

## 3. Environment Variables & Zero-Hardcoded Secrets (`.env`)
- **Dual `.env` Isolation**:
  - `server/.env` holds `PORT`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_ROOT_FOLDER`, `CLIENT_URL`, and `SUPER_ADMIN_*` / `DEFAULT_DISTRIBUTOR_*`.
  - `client/.env` holds `VITE_APP_NAME`, `VITE_API_BASE_URL`, `VITE_DEFAULT_PAGE_SIZE`, `VITE_DASHBOARD_PAGE_SIZE`, and `VITE_CLOUDINARY_UPLOAD_PRESET`.
- **Zero Hardcoded Secrets**: Never hardcode URIs, API keys, JWT secrets, ports, or passwords in `.js`/`.jsx` files. Maintain `server/.env.example` and `client/.env.example`. Validate required keys on startup (`server/src/config/env.js`) and idempotently bootstrap the Super Admin (`server/src/config/seedSuperAdmin.js`).
- **Git Secret Protection**: Never stage or commit `.env` files, `node_modules/`, or `dist/` builds.

## 4. Database, Cloudinary Media & Scalability Rules
- **Zero Dummy Data Bloat**: Never ship hardcoded dummy arrays (`const dummyProducts = [...]`). All tables, charts, dropdowns, and KPI cards must query real data from MongoDB Atlas. Render clean, theme-aware Empty State cards with direct CTA buttons when a collection has `0` records.
- **Tenant Isolation & Compound Indexes**: Scope all queries by `distributorId` via `tenantMiddleware.js`. Every Mongoose model must define compound indexes starting with `{ distributorId: 1, ... }`.
- **Mandatory Server-Side Pagination**: Every list endpoint must accept `page`, `limit`, `search`, `sortBy`, `sortOrder`, and module filters, returning `{ success: true, data: [...], pagination: { totalRecords, currentPage, totalPages, pageSize, hasNextPage, hasPrevPage } }`.
- **Cloudinary Image Pipeline**: Upload all images to structured folders (`elite_dist_erp/*`). Store only `{ url: result.secure_url, publicId: result.public_id }` in MongoDB (never Base64 or local disk files). Call `cloudinary.uploader.destroy(publicId)` when replacing or deleting records.

## 5. Theme, Viewport, UI/UX & Anti-Loop Rules (`design.md`)
- **Strict Blue & White / Blue & Black Theme (Zero Purple)**:
  - Light Mode: `#FFFFFF` / `#F8FAFC` surfaces with `#0284C7` / `#2563EB` Royal/Ocean Blue accents and `#E2E8F0` 1px borders.
  - Dark Mode: `#06090F` / `#0B1120` Obsidian/Carbon surfaces with `#38BDF8` / `#3B82F6` Electric/Cyan Blue accents and `#1E293B` 1px borders.
  - All colors must use CSS custom properties in `client/src/styles/globals.css`.
  - **Absolute Ban on Purple**: Never use `#8b5cf6`, `#a855f7`, `#6366f1`, `purple-*`, `violet-*`, or `indigo-*`.
- **Viewport-Locked Desktop (`100dvh`) & Mobile-First (`< 768px`)**:
  - Desktop (`>= 1024px`) uses `<AppShell />` locked to `h-dvh overflow-hidden` (fixed Topbar, Page Header, KPI strip, Filter Toolbar; only inner data container scrolls with 5 rows on dashboard tables / 10 rows on master tables).
  - Mobile (`< 768px`) `<SmartDataTable />` switches to Mobile Stacked Cards (`min-h-[44px]` touch targets) and `<TouchKeypadModal />` for numeric entry.
- **Typography & Global Components**:
  - Enforce `font-variant-numeric: tabular-nums` (`JetBrains Mono` for SKU/Batch/Currency/Weight) and strict z-index hierarchy (`z-10` to `z-60`).
  - `window.alert()`, `window.confirm()`, and `window.prompt()` are forbidden. Always reuse the 14 global components in `client/src/components/global/`. Unbuilt routes/actions must open `<ComingSoonModal />`; unknown URLs render `<NotFound404 />`.
  - No `Sparkles` icon, no AI copywriting slop, and no preemptive red validation errors before user interaction/blur.
- **8 Anti-Loop & Performance Guardrails**:
  1. Zero `useEffect` fetch loops — use TanStack Query with primitive keys.
  2. Compute derived totals (2-Level Invoice, $W \times L \times H$ Volume, Packing Weight) via `useMemo` or event handlers, never chained `useEffect` hooks.
  3. Debounce search inputs by 300ms and reset `page = 1` in the input handler.
  4. Preview images locally (`URL.createObjectURL` with cleanup) and lock Cloudinary uploads with `isSubmitting`.
  5. Wrap charts in fixed-height containers (`h-48` to `h-56`, `min-w-0`).
  6. Restore `document.body.style.overflow` cleanly via `ShellContext` on modal unmount/route change.
  7. Chunk large Excel/CSV/Print operations to keep INP < 200ms.
  8. Zero dead buttons.

## 6. Non-Negotiable Domain Invariants
1. **Product Master vs. Stock Batch Separation**: Static catalog/pricing lives in `Product`; dynamic quantities, `batchNo`, `mfgDate`, `expDate`, `condition` (`NORMAL`, `DAMAGE`, `EXPIRE`, `DAMAGE_EXPIRE`), and `status` (`AVAILABLE`, `RESERVED`, `LOW_WARNING`, `OUT`, `BLOCKED`, `QUARANTINED`) live in `StockBatch`.
2. **Multi-Unit & Volume Math**: Base Unit + Packing Units (`packingWeightKg = baseWeightKg * conversionQty`, `Area = W * L`, `Volume = W * L * H`) and 3-Tier pricing (Trader/Purchase, Wholesale/Sale, POS/Retail).
3. **Zero-Quantity Deletion Guard**: Block deletion (`400 Bad Request`) of any Warehouse, Zone, or Floor/Rack Area if any `StockBatch` has `currentBaseQty > 0`; instruct the operator to run a Stock Movement first.
4. **Stock Reservation Lifecycle**: `PENDING` order deducts nothing; `APPROVED` order atomically moves qty from `availableBaseQty` to `reservedBaseQty`; `CANCELLED` releases reservation; delivery deducts delivered qty from `currentBaseQty` and `reservedBaseQty`.
5. **Two-Level Invoice Calculation Engine**: Level 1 (Item rates, unit conversion, reverse custom sale rate discount calculator, item flat/% discount, item charges by rate/qty/kg, item GST %, free scheme rows at zero rate with tracked weight) -> Level 2 (Grand totals, amount/weight grand discounts in General+Auto / Slab / %, grand charges, grand target schemes, net payable).
6. **Mandatory Task-Wise Closing & Double-Entry Accounting**: Every dispatch, salesman deal, recovery, return put-away, transfer, and adjustment closes its linked `PendingTask` and atomically posts balanced Debit/Credit entries to `AccountLedger` + `AuditLog`.

## 7. Pre-Completion Verification & Git Sync Checklist (Run After Every Task/Phase)
Before completing any phase or task:
- [ ] Verify zero `useEffect` fetch loops, zero console/runtime errors, and clean `node --check src/server.js` + `npm run build` in `client/`.
- [ ] Verify Light Mode (Blue & White) and Dark Mode (Blue & Black) contrast with zero purple classes, desktop `100dvh` fit, and `375px` mobile stacked cards.
- [ ] Verify `.env` secrets are untracked (`git status`), mark completed phase `[x]` in `.agents/features-phases.md`, and commit using `<type>(phase-<XXX>): <summary>` per `.agents/git-sync.md`.
