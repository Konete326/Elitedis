# ELITE DIST — UI/UX Design System & Frontend Guardrails
## Strict Blue & White (Light) / Blue & Black (Dark) Specification — Zero Purple

---

## 1. Visual Theme Architecture & Strict Color Lock
ELITE DIST enforces a sharp, enterprise distribution visual identity featuring **two crisp themes** and an **absolute ban on purple/violet/indigo hues**.

### 1.1 Color Tokens (`client/src/styles/globals.css`)
| Semantic Token | Light Mode (Blue & White) | Dark Mode (Blue & Black) | Purpose |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#F8FAFC` | `#06090F` | Primary viewport shell background |
| `--bg-surface` | `#FFFFFF` | `#0B1120` | Cards, drawers, modals, data tables |
| `--bg-surface-muted` | `#F1F5F9` | `#111827` | Zebra rows, table headers, input fill |
| `--border-subtle` | `#E2E8F0` | `#1E293B` | Mandatory `1px` crisp structural dividers |
| `--accent-primary` | `#0284C7` (Ocean Blue) | `#38BDF8` (Cyan Blue) | Active nav items, primary CTAs, focus rings |
| `--accent-strong` | `#2563EB` (Royal Blue) | `#3B82F6` (Electric Blue) | Action buttons, active tabs, KPI highlights |
| `--text-primary` | `#0F172A` | `#F8FAFC` | Primary headings & table values |
| `--text-secondary` | `#475569` | `#94A3B8` | Sublabels, metadata, timestamps |
| `--status-success` | `#059669` | `#34D399` | Approved, Visited, Normal, Completed |
| `--status-warning` | `#D97706` | `#FBBF24` | Low/Warning, Transfer Pending, Skipped Stops |
| `--status-danger` | `#DC2626` | `#F87171` | Damage, Expired, Blocked, Overdue, Shortage |

> **ZERO PURPLE MANDATE:** Never use `#8b5cf6`, `#a855f7`, `#6366f1`, `purple-*`, `violet-*`, or `indigo-*` anywhere in Tailwind classes, SVG icons, chart series, or inline CSS.

### 1.2 Typography & Numeric Discipline
- **Primary UI Font:** `Inter` / system sans-serif.
- **Numeric & Code Font (`font-variant-numeric: tabular-nums`):** `JetBrains Mono` strictly enforced on all SKUs, Batch IDs, Unit Conversions, PKR Currency, Weights (`kg`), Volumes, Counts, and Reconciliation Totals so table columns align vertically to the pixel.
- **No AI Slop:** Never use the `Sparkles` icon or conversational marketing filler text inside ERP screens.

---

## 2. Viewport-Locked `<AppShell />` (`100dvh`) & Z-Index Hierarchy
### 2.1 Desktop (`>= 1024px`) Viewport Lock
- Root layout uses `h-dvh overflow-hidden flex`.
- Fixed elements: Collapsible **Sidebar** (16 Main Navigation Parts per PRD §24.1), **Topbar** (Breadcrumb, Search, Pending Task badge, Notifications, Theme toggle), **Page Header**, **KPI Strip**, and `<FilterToolbar />`.
- **Inner Scroll Containment:** Only the `<SmartDataTable />` body container scrolls internally if row content requires it, backed by server-side pagination (`5` rows on dashboards, `10` rows on master tables).

### 2.2 Mobile Field Layout (`< 768px`)
- `<SmartDataTable />` automatically transforms tabular rows into **Mobile Stacked Cards** with `min-h-[44px]` touch targets for Order Bookers, Salesmen, Recovery Crews, and Warehouse Staff.
- Rapid quantity/payment input invokes `<TouchKeypadModal />`.

### 2.3 Strict Z-Index Stack
| Layer | Z-Index | Components |
| :--- | :--- | :--- |
| Sticky Table Headers & Footers | `z-10` | `<SmartDataTable />`, `<PaginationBar />` |
| Collapsible Sidebar & Fixed Topbar | `z-20` / `z-30` | `<Sidebar />`, `<Topbar />` |
| Filter Popovers & Dropdown Selectors | `z-40` | `<FilterToolbar />`, Unit Version Picker |
| Form Drawers, Print Preview, Touch Keypad, Coming Soon | `z-50` | `<FormModal />`, `<PrintPreviewModal />`, `<TouchKeypadModal />`, `<ComingSoonModal />` |
| Critical Confirmations & Toasts (5s auto-dismiss) | `z-60` | `<ConfirmModal />`, `<ToastContainer />` |

---

## 3. Master PRD v1.0 Specific UI/UX Contracts
1. **Purchase Price Masking (`PRD §5.3, §20.4`):** When `user.permissions.purchasePriceVisibility === false`, completely **omit** `Purchase Rate`, `Cost Value`, `Margin`, and `Stock Valuation (Cost)` columns/cards/fields from DOM rendering (never render `Rs. 0` as a misleading cost figure).
2. **Unit Versioning Badge & Coexistence (`PRD §5.7`):** Product forms append a new versioned packing row without mutating old versions. Batch rows and Order picklists render a clear version pill (e.g., `Carton v1 • 48 pcs` vs `Carton v2 • 50 pcs`).
3. **Stock Issue Policy Banner & Warehouse Selector (`PRD §6.3, §7.2`):** Distributor Settings exposes an explicit `FIFO` / `FEFO` / `Manual Batch Selection` segmented selector. Warehouse views strictly render the 3-tier breadcrumb `Warehouse → Zone → Area` and disable Delete buttons visually with helpful stock-clearance guidance when `currentBaseQty > 0`.
4. **Purchase Receiving 5-Step Stepper & Discrepancy Highlight (`PRD §9.4–9.6`):** Receiving UI walks cleanly across `Purchase Received -> Check & Received -> Move & Put Away -> Create Movement -> Purchase Movement Result`. Any Expected vs Received qty delta or `MFG/EXP` mismatch highlights in high-contrast Warning Amber; Put-Away enforces separated quantity buckets for `Normal`, `Damage`, and `Expire`.
5. **`Write Your Own` Ad-Hoc Customer Switch (`PRD §13.2`):** Order Creation & POS checkout provide a crisp 3-way customer selector (`Select Customer`, `Create Customer`, `Write Your Own`), dynamically toggling shop ledger checks vs fast inline ad-hoc fields.
6. **Client Deal 3-Tab Doorstep Architecture (`PRD §15.3`):** Salesman Deal screen enforces three tabs:
   - Tab 1: **`Original Invoice` (Read-Only / Lock Icon)** — visibly locked snapshot never overwritten (`Report 22.13`).
   - Tab 2: **`Edit Invoice`** — quantity edits, `Item Return/Cancel`, `Extra Item`, `Extra Return (OK/SKIP)`, `Grand Level Edit`.
   - Tab 3: **`Final Invoice`** — real-time net payable breakdown matching `Report 22.8` & `22.14`.
7. **Structured `Skip` Modals & Booker `Visited` Badge (`PRD §12.3–12.4, §15.9, §16.7`):**
   - Booker check-in sets an unmistakable Emerald/Blue **`Visited`** badge independently of order creation.
   - `Booking Skip`, `Sales Skip`, and `Recovery Skip` open a shared confirmation modal requiring skip reason & status, producing an explicit Result pill (`SKIPPED`) in Booking/Salesman/Recovery Sheets—never `$0` fake sales/collections.
8. **Recovery Field Expenses & Cash Handover Widget (`PRD §16.8, §22.8`):** Depot Cash Handover panel renders four distinct rows (`Cash Collections`, `Field Expenses [Gas/Petrol, Enjoyment, Works]`, `Total Due Cash`, `Total Cash Received`) and automatically displays exact `Shortage / Extra` in `JetBrains Mono` red/emerald.
9. **Mandatory `<ComingSoonModal />` Enforcement (`PRD §1.3, §30.2`):** Navigation links, tabs, or buttons pointing to **`Tax Group`**, incomplete **`Scheme Group` sections**, **`HRM History & Reports`**, **`HRM Payroll & Salary`**, **`HRM Attendance & Leaving`**, or public **`/auth/signup`** MUST display a clean `Soon` badge in `<Sidebar />`/tabs and open `<ComingSoonModal />` on click.
10. **Print Layouts (Urdu/English Header, Footer & Notes) (`PRD §18.9–18.15`):** `<PrintPreviewModal />` supports configurable Urdu/English bilingual header/note blocks, `Signature Lines`, `Page No`, `Print Date`, `Original/Duplicate` watermarks, and renders the 6 Invoice Styles & 4 Supply Docs cleanly (`Delivery Dispatch`, `Salesman Sheet`, `Recovery Sheet`, `Booking Sheet`).

---

## 4. Mandatory Global UI Rules & 8 Anti-Loop Guardrails
- **Ban Native Browser Popups:** `window.alert()`, `window.confirm()`, and `window.prompt()` are forbidden. Always use `<ConfirmModal />` and `<ToastContainer />` (toasts auto-dismiss after **5 seconds**).
- **PWA Prompt Hygiene:** Show install prompt **only** when the app is NOT already installed (once installed, suppress repeated prompts).
- **Empty States:** Zero dummy seed arrays in client state. When a table has `0` rows, render a clean theme-aware Empty State with a direct primary CTA button.
- **No Premature Validation Errors:** Never paint red border/helper text before user input or blur.

### The 8 Performance & Anti-Loop Guardrails
1. **Zero `useEffect` Fetch Loops:** Use `@tanstack/react-query` exclusively with primitive query keys.
2. **Derived Math via `useMemo`:** Compute 2-Level Invoice math, `W × L × H` volumes, Unit Version weights, `Net Amount`, and Cash Handover variances via `useMemo` or event handlers—never chained `useEffect` hooks.
3. **Debounced Search + Page Reset:** Debounce search inputs by `300ms` and reset `page = 1` inside the handler.
4. **Local Preview & `isSubmitting` Lock (`PRD §26.4`):** Preview images using `URL.createObjectURL()` (revoking on cleanup) and bind `isSubmitting` + unique `idempotencyKey` on all critical form submissions.
5. **Chart Height Bounds:** Wrap chart containers in explicit fixed height (`h-48` to `h-56`, `min-w-0`) inside Recharts/chart wrappers.
6. **Clean Scroll Restoration:** Restore `document.body.style.overflow` on modal unmount or route change via `ShellContext`.
7. **Non-Blocking Export Chunking:** Keep CSV/Excel/Print DOM serialization under `< 200ms` INP.
8. **Zero Dead Buttons:** Every button triggers its live workflow, `<ComingSoonModal />`, or `<ConfirmModal />`.
