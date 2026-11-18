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

---

## 5. Outside-In Layout Architecture & Container Hierarchy

1. **Fixed Outside-In Region Budgets:** Design layouts from the outer viewport shell inward using explicit CSS region tokens:
   - `SideNav`: `240px–280px` (`--region-sidenav-width: 260px`) for primary workspace navigation.
   - `IconRail`: `64px–72px` (`--region-rail-width: 68px`) when collapsed on desktop.
   - `DetailPanel` / Inspector Drawer: `340px–420px` (`--region-panel-width: 380px`).
   - **Content Width Caps vs. Full-Bleed Tables:** Focused forms and auth/settings panels cap width at `--content-width-form` (`640px`) or mixed analytical grids at `--content-width-mixed` (`960px`); high-density `<SmartDataTable />` operational listings expand full-bleed inside the inner viewport container.
2. **Weakest Container Hierarchy (`gap` → `Divider` → `Section` → `Card`):** Reach for whitespace (`gap`) first, subtle `1px` dividers second, flat semantic sections third, and elevated `Card` surfaces last. Prevent **Card soup** (cards nested inside cards) and **Flexbox soup** (deep ad-hoc flex wrappers where CSS Grid belongs).
3. **Single Left Content Line & Spacing Rhythm:** Align headings, filter bars, and inner sections along one crisp left content edge. Pair **tight** spacing (`--spacing-1` / `--spacing-2`, `4px–8px`) between closely coupled labels, inputs, and action pairs with **generous** spacing (`--spacing-4` to `--spacing-6`, `16px–24px`) between distinct layout regions.
4. **Reflowing Grids:** Use `.grid-reflow-cards` (`grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr))`) so KPI strips and card grids wrap smoothly down to `320px` without hardcoded breakpoint guesswork.
5. **Explicit Responsive Contract:**
   - **Desktop (`> 1024px`):** Viewport-locked `100dvh` `<AppShell />` with persistent collapsible `SideNav`/`IconRail`, internal scroll containment (`overscroll-contain`), and tabular data views (`28px–36px` fine-pointer control heights).
   - **Tablet (`768px–1024px`):** Collapsible navigation drawer/rail and adaptive split panes that preserve single-column reading comfort without horizontal overflow.
   - **Mobile (`< 768px`):** `<SmartDataTable />` switches to stacked cards; coarse pointers (`@media (pointer: coarse)`) scale controls (`--size-element-sm: 36px`, `md: 40px`, `lg: 44px`, `--size-touch-target: 44px`) paired with `<TouchKeypadModal />`.

---

## 6. Core Design Tokens Summary (`globals.css`)

- **Spacing Scale (`4px` / `0.25rem` base):** `--spacing-0` (`0rem`) through `--spacing-12` (`3rem`) in `0.25rem` increments.
- **Shape & Concentric Radius:** `--radius-none` (`0px`), `--radius-inner` (`8px`), `--radius-element` (`12px`), `--radius-container` (`16px`), `--radius-page` (`32px`), and `--radius-full` (`9999px`). Nested surfaces follow the concentric formula `max(0px, calc(outerRadius - padding))` (`.concentric-inner`).
- **Typography Scale (`14px` × `1.2` Geometric Scale):** Base `--font-size-base: 0.875rem` (`14px`) with `--font-size-sm` (`0.75rem`), `--font-size-lg` (`1.0625rem`), `--font-size-xl` (`1.25rem`), `--font-size-2xl` (`1.5rem`), weights `400/500/600/700`, `4px`-aligned unitless `line-height: 1.5`, `rem` sizing, and `clamp()` for fluid display headings.
- **Border, Focus & High Contrast:** `--border-width: 1px`; crisp keyboard focus ring tokens (`--focus-outline-width: 2px`, `--focus-outline-style: solid`, `--focus-outline-color: var(--accent-primary)`, `--focus-outline-offset: 3px`) plus `@media (forced-colors: active)` (`CanvasText` borders, `Highlight` focus outlines).
- **Zero-Purple Data-Viz Palette:** Categorical series tokens `--color-data-categorical-blue` (`#0171E3`), `-cyan` (`#0171A4`), `-teal` (`#08A3A3`), `-green` (`#0B991F`), `-orange` (`#EB6E00`), `-red` (`#F5394F`), and adaptive `--color-data-neutral` (`light-dark(#8494A3, #8C939B)`).

---

## 7. Motion Architecture

- **Duration Bands & Curves:**
  - **Fast (`130ms–230ms`, `--duration-fast: 175ms`):** Hover states, focus fades, dropdowns, micro-reveals, and modal/dialog entrances (`--ease-entrance: cubic-bezier(0.24, 1, 0.4, 1)`).
  - **Medium (`310ms–550ms`, `--duration-medium: 410ms`):** Off-canvas drawers and large spatial layout shifts (`--ease-move: cubic-bezier(0.24, 1, 0.4, 1)`).
  - **Slow (`--duration-slow: 975ms`) & Exit (`--duration-exit: 175ms`):** Ambient progress/shimmer cycles and snappy exit transitions (`--ease-exit: cubic-bezier(0.3, 0, 0.6, 0.6)`).
  - Supports `interpolate-size: allow-keywords` for intrinsic height animations, respects `@media (prefers-reduced-motion: reduce)`, and never animates `scrollbar-color`.
- **Where Motion Helps vs. Where Motion Hurts:**
  - **Helps:** Spatial orientation in drawers (`FormModal`, mobile `Sidebar`), confirmation/popover scale-ins, skeleton shimmers, and theme view transitions.
  - **Hurts:** High-density ERP data tables (`table, thead, tbody, tr, th, td`) and long list rows—hover highlights MUST remain instantaneous (zero transition delay) so fast cursor scanning never lags. Coarse-pointer touch transitions cross-fade at `<= 200ms`.

---

## 8. Modern Web Guidance Form, Dialog & Smart Auto-Selection Patterns

- **Auto-Sizing Textareas:** `<textarea>` uses `resize: vertical; field-sizing: content; min-block-size: 3lh; max-block-size: 15lh;` so remarks and address notes expand naturally without clipping.
- **IME-Safe Search & Enter Submit:** Every Enter-to-submit handler (including `<FilterToolbar />`) guards IME composition (`if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return;`) before triggering immediate search/submit.
- **Premature-Error-Free Validation:** CSS validation uses `:user-invalid` (excluding `[type="range"]`) and `:has(:user-invalid)` parent label highlighting—never bare `:invalid`—so untouched forms stay calm until interaction.
- **Drag-Safe Light Dismiss & Scroll Containment:** Backdrop overlays (`FormModal`, `ConfirmModal`) track `pointerdown` origin (`pointerDownOnBackdropRef`) so dragging text selection outside a modal never triggers an accidental backdrop close; modal and table scroll bodies set `overscroll-contain`.
- **Browser `autocomplete` & Smart Defaults:** Auth and contact inputs expose standard `autocomplete` tokens (`username`, `current-password`, `email`, `tel`). Creation modals auto-suggest structured codes (`SKU`, `COMP`, `BR`, `CAT`, `SUB`, `WH`, `ZN`, `AR`, `TER`, `BAT`) and bidirectionally auto-select parent/single-option relations (`Company ↔ Brand ↔ Category ↔ Sub-Category`, `Warehouse → Zone → Area`).
