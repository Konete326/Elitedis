# Product Requirements Document (PRD) — ELITE DIST (Distribution ERP & SFA Platform)

- **Product Name:** ELITE DIST — Enterprise Resource Planning (ERP) & Sales Force Automation (SFA) System for Distributors
- **Document Path:** `.agents/PRD.md`
- **Version:** 1.0 (Production Master Specification)
- **Date:** November 2026
- **Architecture & Tech Stack:** MERN Stack (`MongoDB Atlas` + `Express.js` + `React 19 (Vite)` + `Node.js`) + `Tailwind CSS` (Mobile-First Responsive) + `Cloudinary` (Image Storage & CDN)
- **Repository Structure:** Strictly split into `client/` (Frontend with `client/.env`) and `server/` (Backend with `server/.env`).

---

## 1. Executive Summary & Product Vision

### 1.1 Product Description
**ELITE DIST** is a high-performance, full-scale Distribution Enterprise Resource Planning (ERP) and Sales Force Automation (SFA) platform engineered specifically for distribution agencies and wholesale/retail supply businesses. The system unifies **Inventory & Multi-Unit Product Management**, **Batch & Expiry Tracking**, **Multi-Warehouse & Floor/Rack Operations**, **CRM & Beat/Route Planning**, **2-Level Invoice & Scheme Calculation Engine**, **Order Booking**, **Delivery & Dispatch Logistics**, **Payment Recovery**, **POS (Retail & Wholesale)**, **Pending Task Automation**, **HRM**, **Double-Entry Financial Accounting**, and **Business Intelligence Reporting** into one cohesive application.

### 1.2 Product Vision
To eliminate manual paperwork and calculation errors in distribution agencies by automating repetitive operations, synchronizing inventory and financial ledgers in real time, enforcing role-based employee accountability, and delivering an ultra-intuitive user experience ("so clear that even a beginner or child can understand the flow immediately") that remains fast and responsive under heavy enterprise data loads.

### 1.3 Core Engineering & Business Principles
1. **Complete Traceability:** Every business transaction (Purchase, Order, Dispatch, Return, Transfer, Adjustment, Recovery, Expense) generates an immutable, auditable record with user, timestamp, and batch references.
2. **Real-Time Inventory & Accounting Synchronization:** Stock movements and financial ledgers (AR, AP, Cash, Bank, General Ledger) update atomically within MongoDB transactions.
3. **Zero-Scroll Viewport-Locked UI & High-Load Pagination:** Pages are engineered as viewport-locked workspaces (`100dvh` desktop app shell) where unnecessary page scrolling is eliminated. All tables and lists enforce server-side pagination, quick filtering, and mobile card-list transformations (`< 768px`).
4. **Strict Visual Identity (Blue & White / Blue & Black — Zero Purple):**
   - **Light Mode:** Crisp Pure White (`#FFFFFF`) & Cool Slate (`#F8FAFC`) surfaces paired with Royal/Ocean Blue (`#0284C7` / `#2563EB`) accents inspired by the ELITE DIST logo.
   - **Dark Mode:** Deep Obsidian/Black (`#090D16` / `#0F172A`) surfaces paired with vibrant Electric/Cyan Blue (`#38BDF8` / `#3B82F6`) accents.
   - **Zero Purple & Zero AI Slop:** Purple, violet, or neon magenta gradients, fake AI sparkle icons, and hardcoded dummy bloat are strictly forbidden. Smooth CSS transitions (`transition-colors duration-200`) apply across all theme switches.
5. **Cloud Media Pipeline:** All images (Company Logos, Brand Logos/Covers, Base Item Images, Pack Item Images, Customer Shop Photos, Employee Avatars, Cheque/Payment Proofs) upload to **Cloudinary**, storing only the optimized `secure_url` and `public_id` in **MongoDB Atlas**.
6. **100% `.env` Driven Configuration:** `client/.env` and `server/.env` store all environment configurations, database URIs, Cloudinary keys, JWT secrets, and Super Admin bootstrap credentials (`SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME`). Zero credentials are hardcoded in source files.

---

## 2. Multi-Distributor Structure & Data Isolation

### 2.1 Configurable Distribution Authorization
Distribution territories and authorizations are dynamically configurable based on:
- **Company Agreements:** Exclusive or shared representation of a manufacturer (e.g., Green Chemicals, Qazi Chemicals, Mukhtar Soap).
- **Brand & Product Authorization:** Assigning specific brands (e.g., Silko, Suraj, Glossy, White Wash) or SKU subsets to specific territories or bookers.
- **Territory Agreements:** Supporting single or multiple distributors within a city/zone without data collision.

### 2.2 Strict Tenant & Distributor Data Ownership
- Each distributor agency operates in an isolated data scope (`distributorId`).
- A distributor can manage multiple companies, brands, products, warehouses, employees, vehicles, routes, and customers.
- Cross-distributor access to confidential customer ledgers, stock valuations, pricing rules, or financial statements is strictly blocked at the API middleware level.

---

## 3. User Roles, Permissions & Dedicated Portals

### 3.1 Role Hierarchy
1. **Super Admin / Distributor Owner (`SUPER_ADMIN` / `ADMIN`):**
   - Full access to all modules, master settings, rules engine, financial accounting, order approvals, warehouse approvals, employee role assignments, and all 10 dashboards.
   - Bootstrap credentials loaded directly from `server/.env`.
2. **Warehouse Manager / Storekeeper (`WAREHOUSE_MANAGER` / `STOREKEEPER`):**
   - Manages stock intake (Purchase Received), stock transfers (Inter-warehouse & Same-warehouse), physical stock adjustments, damage/expiry isolation, dispatch picking checklists, and put-away tasks.
3. **Order Booker (`BOOKER`):**
   - Dedicated mobile-first portal (`/booker`). Views assigned daily Beats, visits customers along routes, books new orders with live scheme/discount previews, records payment recoveries, logs customer returns, and shares company-wise order/stock requirements.
4. **Salesman / Delivery & Recovery Officer (`SALESMAN`):**
   - Dedicated mobile-first portal (`/salesman`). Receives approved delivery bills, dispatch sheets, and recovery sheets; executes customer deliveries ("Start Deal"), handles on-spot invoice edits (quantity decrease/return, extra item addition from extra dispatch stock, damage/expiry return), collects payments (Cash, Online/JazzCash/EasyPaisa, Cheque), and logs trip expenses (Fuel/Petrol, Maintenance, Refreshments).
5. **POS Store Operator (`POS_OPERATOR`):**
   - Dedicated fast-checkout portal (`/pos`). Handles walk-in Retail and Wholesale counter sales, barcode scanning, unit switching (Piece/Dozen/Carton), instant thermal/A4 invoice printing, and daily POS cash closing.
6. **Accountant (`ACCOUNTANT`):**
   - Manages customer/supplier ledgers, payment verifications, cheque clearance, expense vouchers, bank reconciliation, Trial Balance, P&L, and Balance Sheet.

### 3.2 Granular Work-Part Assignment
Within HRM (`Employ Master -> Work & Task`), the Admin can toggle specific operational privileges (`Accept` / `Non Accept`) per employee:
- `Order Booker`
- `Warehouse Management`
- `POS Store`
- `Normal Invoice Creation`
- `Advance Invoice Creation`
- `Salesman / Delivery & Recovery`

---

## 4. Detailed Module Specifications

### Module 1: Inventory — Companies, Brands, Categories & Product Master (`/inventory`)

#### 4.1.1 Companies Master (`/inventory/companies`)
- **Company Profile Fields:** Auto/Custom Company Code (e.g., `GC-04523`), Company Name, Short Name, Logo (Cloudinary), Owner Name, Supplier Name, Accountant Name, Business Type (`Manufacturer`, `Importer`, `Distributor`), Industry Type (e.g., `Chemicals`, `FMCG`), Establish Year, NTN, Registration No, Copyright info, Status (`Active` / `Inactive`).
- **Address & Geo Info:** Country, Province/State (e.g., `Sindh`), City (`Karachi`), Zone (`Orangi Town`), Full Street Address, Google Maps URL / GPS coordinates.
- **Multi-Contact Sub-Table:** Add multiple contact persons with Name, Role/Field (`Accountant`, `Booker`, `Brand Manager`), Contact Number, Channel Type (`WhatsApp`, `Phone`), Purpose (`Payment Transfer`, `Order Desk`), and `Default (YES/NO)` flag.
- **Multi-Social Media Sub-Table:** Platform (`Facebook`, `Instagram`, `Website`, `YouTube`), Page Name, Purpose/Type (`Promotions`, `Career`), URL Link, and `Default` flag.
- **Multi-Bank/Account Sub-Table:** Account Type (`Bank`, `EasyPaisa`, `JazzCash`), Provider/Bank Name (e.g., `Bank Al Habib`, `EasyPaisa`), Account Title, Account Number, IBAN/Reference, and `Default` flag.
- **Company Actions:** View Profile Drawer/Modal, Edit, Duplicate, Delete (guarded if active brands/products exist), Generate Company Stock/Purchase Reports, and 1-click jump to linked Brands.

#### 4.1.2 Brands Master (`/inventory/brands`)
- **Brand Profile Fields:** Brand Code (e.g., `S-01`), Brand Name (e.g., `SILKO`, `SURAJ`, `GLOSSY`, `WHITE WASH`), Parent Company link, Brand Type (`Personal Care`, `Cosmetics`, `Home Care`, `Detergent`), Brand Logo & Cover Image (Cloudinary), Owner, Brand Manager, Sales Manager, Description, Status (`Active` / `Inactive`).
- **Linked Contacts & Socials:** Multi-row contact persons and social media links specific to the brand.
- **Brand View & Analytics:** Shows Total Products, Active/Inactive Products, Linked Categories/Sub-Categories, and instant Current Stock report preview/print.

#### 4.1.3 Categories & Sub-Categories (`/inventory/categories`, `/inventory/sub-categories`)
- **Category Master:** Category Code (`S-01`), Category Name (e.g., `Shampoo`, `Detergent`, `Cleaner`, `Dish Wash`), Parent Company, Linked Brands (multi-select brand linking table with code, name, and delete guard), Category Picture (Cloudinary), Description, Status (`Active` / `Inactive`).
- **Sub-Category Master:** Sub-Category Code (`F-01`, `SS-F`), Sub-Category Name (e.g., `Fresh`, `Hair & Care`, `Medicated`), Linked Company, Brand, and Parent Category, Picture, Description, and Product count tracker.

#### 4.1.4 Product Master & Multi-Unit Pricing Engine (`/inventory/products`)
- **Strict Separation of Product Master & Stock:** Product Master holds static catalog, unit, dimension, and pricing definitions; Stock holds dynamic batch, warehouse, and quantity records.
- **Core Product Info:** Auto/Custom Product SKU Code (e.g., `GC-04523`, `FA200`, `SDH-10`), Barcode/QR string, Product Name (e.g., `Fresh AMLA 200ml`, `SURAJ Rs10`), Company, Brand, Category, Sub-Category, Status (`Active` / `Inactive`), Show on Marketplace (`Yes` / `No`), Assigned Bookers/Salespersons.
- **Base Unit & Pricing:**
  - Base Unit Type (`Piece`, `Bottle`, `Bar`, `Sachet`, `Packet`, `Kg`, `Gram`, `Liter`, `ml`).
  - Base Weight & Weight Unit (`g`, `Kg`) — e.g., `0.500 Kg`.
  - Base Item Image (Cloudinary).
  - **3-Tier Base Pricing:**
    1. `Purchase / Trader Rate` (Cost price from company)
    2. `Wholesale / Sale Price` (Price for wholesalers/traders)
    3. `Retail / POS / End Rate` (MRP / Consumer POS price)
- **Packing Unit, Conversion, Dimensions & Pricing:**
  - Secondary/Master Packing Units (`Dozen`, `Pack`, `Box`, `Carton`, `Sack`, `Bundle`, `Can`) with explicit conversion factor (`Base Units per Packing Unit`, e.g., `1 Carton = 24 Bottles` or `1 Carton = 12 Dozen = 144 Pieces`).
  - Auto-calculated Packing Weight (`Base Weight × Conversion Qty`) and Auto/Override 3-Tier Packing Rates (`Trader Rate`, `Sale/Wholesale Rate`, `POS/End Rate`).
  - Pack Item Image (Cloudinary).
  - **Physical Dimensions & Volume Calculator:** Size Unit (`Inch`, `Feet`, `cm`), Width ($W$), Length ($L$), Height ($H$), with automatic real-time calculation of **Area ($W \times L$)** and **Volume ($W \times L \times H$)** for vehicle load/dispatch capacity planning.
- **Bulk Rules & Filtration Toolbar:**
  - Filter by Company, Brand, Category, Sub-Category, Warehouse, SKU, Status.
  - Switch between **Table List View** and **Card View**, customize visible columns (`Show/Reset Columns`), and bulk-apply rules to selected products: Discount Type, Tax Type (`GST %`), Scheme Type, Loading Charges, Profit Margin Cost (`PKR`), Wholesale Margin Cost (`PKR`), and Barcode Printing.

---

### Module 2: Stock Management, Warehouses, Zones & Stock Movements (`/inventory/stocks`, `/inventory/warehouses`)

#### 4.2.1 Stock Ledger, Batches, Conditions & Statuses
- **Batch-Level Granularity:** Every purchase intake creates a distinct Batch (`Batch ID`, `MFG Date`, `EXP Date`, `Purchase Rate`, `Warehouse`, `Zone`, `Area`).
- **Dual-Unit Stock Representation:** Displays stock simultaneously in Packing and Base units (e.g., `100 CT : 12 Pcs` or `24:25`), along with Total Value (`PKR`) and Total Weight (`Kg`).
- **Stock Condition (Physical State):**
  1. `Normal / Fresh`
  2. `Damage`
  3. `Expire`
  4. `Damage + Expire`
- **Stock Status (Operational Availability):**
  1. `Available / Normal`
  2. `Reserved` (Locked against pending/approved customer orders)
  3. `Low / Warning` (Triggered when `Current Stock <= Minimum Stock Threshold` or when `Current - Reserved == 0`)
  4. `Out` (Triggered when `Current Stock == 0`)
  5. `Blocked / Quarantined`
- **Stock Rules Per Product/Location:** Set Minimum Stock (`e.g., 20 Pack`), Maximum Stock (`e.g., 50 Pack`), and Expiry Alert Window (`e.g., 90 Days` before expiry).

#### 4.2.2 Pakistan-Style Warehouse, Zone & Floor/Rack Hierarchy (`/inventory/warehouses`)
- **3-Level Physical Hierarchy:** `Warehouse (Main Plot / Shop) → Zone (Section) → Area (Floor / Rack / Walked Location)`.
- **Warehouse Master:** Warehouse Code (`P-01`, `SB-01`), Name (`Plot No 01`, `Orangi Warehouse`, `Baldia Warehouse`), Type (`Main`, `Shop`, `Sub-Store`), Manager & Assigned Staff (with WhatsApp/Phone contacts), Full Address, City/Province, GPS/Google Map link, Storage Utilization % (`e.g., 80%`), Total Batches, Stock Value, and Low Stock Alerts.
- **Zone Master:** Zone Code (`S-01`), Zone Name (`Main Shop`, `Center Shop`), Parent Warehouse, Zone Type (`Normal`, `Mix`, `Temperature`, `Cold Store`), Storage Type (`Normal`, `Damage`, `Expiry`), Condition (`Normal`, `Freeze`), Physical Dimensions ($W \times L \times H$ in Inches/Feet) with auto Area & Volume calculation.
- **Area / Storage Location Master:** Area Code (`SDH-Rs10`), Area Name, Area Type (`Floor`, `Rack`, `Walked`), Storage Purpose (`Normal`, `Damage`, `Mix`, `Expiry`), Condition (`Normal`, `Freeze`, `Temperature`), Dimensions ($L \times W \times H$), and **Allowed Products List** with `Min QTY` and `Max QTY` capacity per SKU.
- **Strict Deletion Guard (Zero-Qty Rule):** A warehouse zone or area CANNOT be deleted while it holds any product quantity. The user must first execute a Stock Movement to bring the area's product quantity to `0` before deletion is unlocked.

#### 4.2.3 Stock Movements Engine (`/inventory/movements`)
Supports 6 structured movement workflows with `Draft`, `Pending`, and `Complete/Approved` states, printable dispatch/checklists, and automatic Pending Task generation for assigned staff:
1. **Inter-Warehouse Transfer (`Transfer`):** Transfer stock from `Warehouse A (e.g., ORANGI-001)` to `Warehouse B (e.g., BALDIA-001)` with Prepared By, Dispatched By (Driver/Salesman), Assigned By, Received By (Warehouse Manager), Batch selection, Carton/Pcs quantities, and Shortage/Damage verification upon receiving.
2. **Intra-Warehouse / Same Transfer (`Same Transfer`):** Move stock within the same warehouse between different Zones and Floor/Rack Areas (e.g., `Main Plot` to `Main Shop`).
3. **Stock Adjustment (`Adjustment`):** Reconcile ERP Stock against Physical Count by batch and zone/area (`Accept` / `Non Accept`), recording Previous Stock, Physical Count, Missing/Damaged/Normal breakdown, Difference, and Approved Final Stock.
4. **Purchase Intake (`Purchase`):** Receive stock from Supplier/Company against a Purchase Order or direct invoice, auto-generating Batch IDs, MFG/EXP dates, landed cost, and Put-Away tasks.
5. **Expiry & Damage Return to Company (`Expiry & Damage Back`):** Consolidate damaged or expired batches from designated damage/expiry zones and dispatch them back to the Manufacturer/Supplier with credit note tracking.
6. **Customer Delivery & Return Movements (`Delivery` / `Costume Return`):** Automatically logged when orders are dispatched, delivered, or returned from the field.

---

### Module 3: Customer Relationship Management (CRM), Territory & Beat Planning (`/crm`)

#### 4.3.1 7-Level Geographical & Pehchan Hierarchy
`City (Karachi) → Town/Sub-District (Orangi, Baldia, Korangi, Lyari) → Area (Qasba Colony, Aligarh Town, Banaras) → Route (Qasba Moor, Jamsheed Pump Road, 100 Fit Road) → Street (Islamiyah Ki Gali) → Pehchan / Landmark ("Pump ky ulty haath road per jali wali shop") → Customer Shop`.

#### 4.3.2 Customer Master (`/crm/customers`)
- **Customer Profile Fields:** Auto/Custom Customer ID (`C-1110`, `GC-04523`), Shop/Customer Name (`Lucky Store`, `Al Makkah Confectionery`), Shop Picture (Cloudinary), Customer Type (`Wholesaler`, `Retailer`, `Sub-Distributor`, `POS Walk-in`), Shop Category (`Confectionery`, `General Store`, `Medical`, `Mart`, `Supplier`), Owner Name, Owner Contact, NTN & Registration No.
- **Multi-Shop Support:** A single owner can operate multiple shop locations; each shop maintains an independent ledger, route assignment, and order history.
- **Address & Pehchan:** Territory, Area, Route, Street, Google Maps Link, GPS (`Lat/Long`), and detailed **Address Remarks / Local Pehchan** so new delivery staff can locate the shop effortlessly.
- **Multi-Contact & Multi-Account Sub-Tables:** Multiple contact persons (`Shopkeeper`, `Owner`, `Accountant`, `Store Keeper` with WhatsApp/Phone) and multiple payment accounts (`Bank`, `EasyPaisa`, `JazzCash` with Title, Account No, IBAN).
- **Financial & Operational Controls:**
  - Payment Condition (`Paid / Cash Only`, `Allow Credit`, `Advance`).
  - Credit Limit (`PKR`), Credit Days/Terms, Current Outstanding Balance.
  - Operational Position (`Visited`, `Ordered`, `Delivered`, `Normal`) and Account Status (`Active`, `Inactive`, `Blocked`).
  - Bulk Rule Assignment: Assign Booker/Salesperson, Tax Group (`GST %`), Discount Group, and Scheme Group across filtered customer segments, plus **Customer ID Card Printing**.

#### 4.3.3 Territory & Beat Plan Engine (`/crm/territories`, `/crm/beats`)
- **Territory Management:** Create territories categorized as:
  1. `Brand Wise` (e.g., `SURAJ Double Horse Territory`)
  2. `Warehouse Wise` (e.g., `ORANGI HOUSE Territory`)
  3. `District Wise` (e.g., `ORANGI TOWN Territory`)
  4. `Booker Wise` (e.g., `IFTIKHAR SURAJ Territory`)
  - Link multiple Areas and specific Routes (`Accept` / `Non Accept`) into each territory, tracking total wholesalers and retailers.
- **Beat Plan Builder:**
  - Assign a Booker (`Assign Booker ID & Name`) to a weekly Beat Schedule (`Monday` through `Sunday`).
  - **Hierarchical Drill-Down Beat Creation:**
    1. Create Beat (`Beat ID: BATB-1`, `Beat Name: ALIGARH TO BANARAS`, `Beat Day: Monday`).
    2. Connect Areas (`Aligarh`, `Banaras`, `Raees Amrohi`).
    3. Connect Routes within each Area (`Aligarh Market Road`, `100 Fit Road`).
    4. Select individual Customers along each route (`Accept` / `Non Accept`), displaying live counts of Accepted vs. Non-Accepted Wholesalers and Retailers.
  - **Duplicate & Reassign Beat:** 1-click utility to clone an existing Beat Plan and assign it to another Booker (e.g., when a different company/brand booker covers the same market).

---

### Module 4: Master Rules Engine — Taxes, Discounts, Charges, Schemes & Print Templates (`/settings`)

#### 4.4.1 Tax, Discount, Charge & Scheme Management (`/settings/rules`)
All commercial rules support **Product Level (Level 1)** and **Grand Invoice Level (Level 2)** configurations, plus validity timelines (`All Time` or `Start Date/Time to End Date/Time` with auto `Expire` status):

1. **Tax Groups:** Configure GST / Sales Tax / Withholding Tax as Flat General (`PKR`) or Percentage (`%`) rules.
2. **Discount Groups:**
   - **Product Level:** General Flat Discount (`e.g., Trader Offer Rs20 off per unit`) or Percentage Discount (`e.g., Ramadan Offer 10% off`).
   - **Grand Level:**
     - *Amount-Based:* `General + Auto` (repeating for every threshold multiple, e.g., every `Rs 10,000` gets `Rs 100` off) or `Slab General` (fixed slab bracket), or Percentage (`e.g., 100K Per 7.5% off`).
     - *Weight-Based:* `General + Auto` or `Slab General` based on total invoice weight in `KG` (`e.g., 50KG per Rs 500 off` or `500KG per 5% off`).
3. **Additional Charge Groups (Loading, Delivery, Packing Charges):**
   - **Product Level:** Compare by `Rate`, `Quantity` (`e.g., Loading Charge Rs10 per Carton`), or `Weight (KG)` (`e.g., 1 KG per Rs20`), in Flat or Percentage mode.
   - **Grand Level:** `Fix General + Auto` (`Flat Rs 200`), `Fix % + Auto` (`1% of bill`), or threshold-based by `Weight (KG)` or `Amount (PKR)`.
4. **Scheme Engine (Free Goods & Promotional Offers):**
   - **Product Level (`Same Product` or `Cross Product`):**
     - `Product Wise`: Buy `X` Paid Quantity, get `Y` Free Quantity (`e.g., Buy 10 Cartons of SURAJ Rs10, get 1 Carton Free` or `Buy 25 Cartons of SURAJ Rs10, get 1 Piece of SURAJ 400g Free`).
     - `Slab Scheme`: Tiered free-good quantities without repeating linear multiples.
   - **Grand Level (`Target Wise`):**
     - Compare by `Total Invoice Amount (PKR)` (`e.g., 100K Per SURAJ 5Kg Free`) or `Total Invoice Weight (KG)` (`e.g., 500KG Per Item Free`).

#### 4.4.2 Customizable Print Layouts & Templates (`/settings/templates`)
- **Document Categories:**
  - *Invoices:* `Retail Invoice (POS View)`, `Wholesale Invoice (POS View)`, `Normal Invoice`, `Landscape Detailed Invoice`, `Delivery + Finance (Chillan + Finance) Invoice`, `Advance Invoice (with Batch & Expiry)`.
  - *Supply & Operational Docs:* `Delivery Dispatch Sheet`, `Salesman Sheet`, `Recovery Sheet`, `Booking Sheet`.
  - *Report Docs:* `Rate Lists`, `Customer Presentation Catalog`, `Credit Reports`, `Current Stock`, `Stock Ledger`, `Stock Valuation`.
- **Visual Header, Footer & Notes Customizer:**
  - Configure Logo placement, Company Name, Address, Subject line, Font Family (`Arial`, `Inter`, etc.), Divider Liner style, Italic/Bold toggles, Language mode (`English` / `Urdu`), up to 3 Signature Positions (`Prepared By`, `Checked By`, `Receiver Sign`), Page Numbering, Print Timestamp, and reusable **Invoice Notes** (`Delivery Note`, `Tax Note`, `Info Note`, `Caution Note`).

---

### Module 5: Order & Sales Operations, 2-Level Invoice Engine & Recovery Assignment (`/orders`, `/sales`, `/recovery`)

#### 4.5.1 Order Sources & Order Master (`/orders`)
- **Tracked Order Sources:** `ONLINE` (Marketplace/Customer App), `BOOKER` (Mobile Booker Portal), `ADMIN` (Back-office), `POS` (Counter Sale), `WHATSAPP / PHONE`.
- **Order Types:** `REGULAR / NORMAL`, `URGENT`, `SPECIAL`, `ADVANCE`, `CUSTOM SALE`.
- **Order Lifecycle Statuses:** `DRAFT → PENDING → APPROVED → DELIVERY / DISPATCH → COMPLETE` (or `CANCEL`).

#### 4.5.2 Normal & Advance Order Creation with 2-Level Calculation Engine (`/orders/create`)
- **Customer Selection & Credit Guard:** Search customer by Name, Code, Area, or Route. Immediately displays Customer Type (`Wholesaler`/`Retailer`), Current Outstanding Balance, and interactive Warning Badges (`Pending Order`, `Blocked`, `Credit Not Allowed`).
- **Level 1 (Item-Level Calculation):**
  - Select Product, Unit (`Carton`, `Dozen`, `Piece`), Quantity, and auto-fetch unit Rate & Weight (`KG`).
  - Toggle Item-Level Invoice Rules (`Discount Allow`, `Tax Allow`, `Scheme Allow`, `Charges Allow`).
  - Supports **Reverse Rate Calculation (`Advance %` / `Advance G`):** If the operator enters a target net `Sale Rate` (e.g., `Rs 1300` instead of `Rs 1450`), the engine automatically back-calculates the exact Discount Amount (`Rs 150`) or Percentage (`5% -> Rate 1368.42`) and updates `Total KG`, `Total Rate`, `Total Discount`, `Total Charges`, Free Scheme rows (inserted at `Rate: 0, Amount: 0` with weight tracked), and `Net Line Amount`.
- **Level 2 (Grand-Level Calculation):**
  - Displays live Order Summary (`Total Items`, `Total Quantity`, `Total Weight (KG)`, `Gross Amount`, `Item Discounts`, `Grand Discount`, `Total Charges`, `Tax`, and `Final Net Payable Amount`).
  - Applies Grand-Level Discounts, Grand Schemes, Grand Charges, and attaches selected Caution/Delivery/Tax Notes.
- **Invoice Style & Submission Options:**
  - Choose print format (`Chillan + Finance`, `Detailed Landscape`, `Advance Invoice`, `Expiry & Batch Chillan`, with `Original & Duplicate` toggle).
  - Actions: `View For Print`, `Print & Send` (WhatsApp/Link/PDF share to customer), `Submit & Assign` (assign directly to a Salesman/Storekeeper), or `Submit`.

#### 4.5.3 Order Operations — Approval, Delivery Planning & Sheet Generation (`/orders/operations`)
1. **Pending to Approved Tab:**
   - Filter pending orders by Date, Area, Route, Source, Type, or Customer.
   - Inspect individual order checklists (modify quantities/discounts if needed) and click **`Approve Selected`**. Approving an order automatically moves its stock from `Available` to `Reserved`.
2. **Delivery Planning & Dispatch Assignment Tab:**
   - Select multiple approved orders and optional past **Credit Sales / Recovery bills** along the same route.
   - Live load calculator displays **`Total Selected Orders`**, **`Total Order Value (PKR)`**, **`Total Weight (KG)`**, and **`Total Volume (Cubic Feet)`** so the dispatcher can match vehicle capacity.
   - Generates 4 synchronized operational documents and tasks in one click:
     - **Bills:** Individual customer invoices for the selected batch.
     - **Dispatch Sheet:** Consolidated warehouse picking list grouped by Zone, Floor/Rack Area, Product, and Batch (`MFG/EXP`), assigned as a task to the **Storekeeper**.
     - **Salesman Sheet:** Route-ordered delivery manifest assigned to the **Salesman**.
     - **Recovery Sheet:** Consolidated list of current bills + previous credit balances assigned to the **Recovery Person / Salesman / Booker**.

#### 4.5.4 Sales Master & Recovery Management (`/sales`, `/recovery`)
- **Sales Master:** Tracks all generated sales (`Sale ID`, `Linked Order ID`, `Customer`, `Area`, `Total Value`, `Outstanding Balance`, `Assigned Person`, `Source`, `Sale Status: Paid / Credit / Partial`). Supports direct `Add Payment`, invoice reprint, and credit aging reports.
- **Recovery Assignment Center:** Filter all unpaid/credit invoices by Area, Route, Booker, or Customer Aging; select multiple invoices; and assign them as a **Payment Recovery Task** to a Booker or Salesman with a printable Recovery Sheet.

---

### Module 6: Pending Tasks & Warehouse Execution Engine (`/tasks`)

Every operational assignment creates an actionable card in the **Pending Task List** showing `Task Title`, `Assigned Time & Date`, `Due Date & Time`, `Priority (URGENT / Normal)`, and `Work Status (Fresh / Draft / Pending / Complete)`. Clicking `Start Task` launches a step-by-step guided execution screen:

1. **Delivery Dispatch Task (Storekeeper):**
   - Displays required items grouped by `Zone → Area (1st Floor, 2nd Floor, Up Floor) → Category → Sub-Category → Product → Batch (MFG/EXP) → Unit & QTY`.
   - Storekeeper ticks items as picked, adjusts `R. QTY` (`- / +`), and can add **Extra Dispatch Items** (extra buffer stock loaded onto the delivery van for on-spot selling).
2. **Salesman Delivery & Deal Execution Task:**
   - Step 1: Verify `Bill Received`, `Recovery Received`, and `Dispatch Stock Received` (including Extra Dispatch items).
   - Step 2: Visit customers on the route (`Start Deal`).
   - Step 3: **On-Spot Invoice Modification:**
     - *Original Invoice* vs. *Edit Invoice* vs. *Final Invoice*.
     - Decrease/Cancel item quantity (automatically logs reason as `Return` or `Damage`), edit Sale Rate/Discount, log `Extra Return` (past damaged/expired stock picked up from customer), or sell from `Extra Dispatch Items`.
   - Step 4: Collect Payment (`Cash`, `Online — JazzCash/EasyPaisa/Bank Transfer with Transaction ID`, `Cheque — Cheque No, Bank, Due Date`), log trip `Expenses` (`Gas/Petrol`, `Maintenance/Work`, `Refreshment/Enjoyment` with remarks), and close the trip to print the final **Salesman Result & Recovery Sheet**.
3. **Return Received & Put-Away Task (Storekeeper):**
   - When the Salesman returns with undelivered goods (`Normal Return`), `Damage Return`, or `Expired Return`, the Storekeeper verifies quantities (`Check & Received`), assigns each batch back to its designated `Zone & Floor/Rack Area` (`Move & Put Away`), and generates the printed **Return Movement Result**.
4. **Inter-Warehouse & Same-Warehouse Transfer Tasks:**
   - Guided 3-step execution: `Transfer Dispatch (Source) → Transfer Received (Destination verification) → Move & Put Away (Assign Zone/Area) → Create Transfer Movement`.
5. **Normal-to-Expired Quarantine Task (`Normal On Expired`):**
   - Automatically or manually flags batches approaching/past expiry in normal racks (`Up Away`), moves them to the quarantine/expiry zone (`Move & Put Away`), and logs the movement.
6. **Purchase Received & Put-Away Task:**
   - Verifies incoming supplier deliveries by batch/unit, assigns floor/rack locations, and updates available stock.
7. **Physical Stock Count & Adjustment Task:**
   - Displays batch-wise stock per Zone/Area; operator uses an integrated numeric keypad modal to enter `Normal`, `Missing`, and `Damaged` counts (`History` log maintained per tap) and commits the stock adjustment.

---

### Module 7: Dedicated Field & Counter Portals (`/booker`, `/pos`, `/salesman`)

1. **Order Booker Portal (`/booker`):**
   - **Today Booking:** Lists assigned Beats for the day; Booker clicks `Accept` and `Start Booking` to see total areas, credited customers, and paid customers.
   - **Visited Customer List:** Filter by Area (`Aligarh`, `Banaras`, `Raees Amrohi`) or Customer Status (`Credit`, `Paid`, `Mix`, `Fresh`, `Draft`, `Complete`). One-tap buttons for `Book Order`, `Recover Payment`, or `Recovery Ledger`.
   - **Fast Mobile Order Grid:** Filter products by Category/Brand pills, tap product cards, enter quantities via an on-screen touch keypad modal (`Carton` / `Dozen` / `Piece`), preview applied schemes/discounts on the Normal Invoice, and submit.
   - **Beat & Brand Setup View:** Read-only/interactive drill-down of the Booker's assigned Beats, Areas, Routes, Customers, and authorized Categories/Brands/Products with live rates.
   - **Booking History & Reports:** Filter past booking batches by date/day and generate `Booking Item Summary` or `Credited Reports` for instant sharing.
2. **Point of Sale (POS — Retail & Wholesale) Portal (`/pos`):**
   - Fast split-screen counter interface supporting both **Walk-in Independent Customers** and registered **Wholesale/Retail Customers**.
   - Category & Sub-Category quick-filter pills, barcode/name search, instant unit selector (`Carton`, `Dozen`, `Piece`), live stock badge, 1-click `Check Order` & `Print Invoice`, and **POS History & Daily Profit Report**.
3. **Salesman Portal (`/salesman`):**
   - Unified mobile workflow for `Delivery Plan`, `Customer Deal Execution`, `Extra Stock Selling`, `Payment Recovery`, `Damage/Expiry Pickup`, and `Daily Expense Logging`.

---

### Module 8: Human Resource Management (HRM) (`/hrm`)
- **Employee Master & Profile (`/hrm/employees`):**
  - Profile ID (`GC-04523`), Employee Name, Photo (Cloudinary), Contact No, Email, Login Credentials, Auto-Linked Warehouse, Primary Role (`Booker`, `Salesman`, `Warehouse Manager`, `POS Operator`, `Accountant`), and granular `Work & Task` permission toggles (`Accept` / `Non Accept`).
- **Employee Task History & Performance Reports (`/hrm/reports`):**
  - Tracks completed vs. pending tasks, booking targets vs. actuals, delivery accuracy, and recovery efficiency.
- **Attendance, Leave & Payroll (`/hrm/attendance`, `/hrm/payroll`):**
  - Daily attendance check-in/out, leave requests, basic salary configuration, commission/incentive calculation on sales/recovery targets, salary advances, and monthly payslip generation.

---

### Module 9: Financial Accounting & ERP Accounts (`/accounts`)
- **Automated Double-Entry Accounting Engine:**
  - Every approved Sale, Purchase, Return, Recovery (Cash/Online/Cheque), Stock Adjustment (Loss/Damage), and Salesman Expense automatically posts balanced Debit/Credit journal entries.
- **Account Movement & Voucher Verification (`/accounts/movements`):**
  - Central verification queue (`Pending` -> `Approve`) for Recovery collections, Delivery settlements, POS daily closings, and Custom Sales before final ledger posting.
- **Complete Financial Statements & Ledgers:**
  1. `Customer Ledger (Accounts Receivable)` with aging analysis
  2. `Supplier / Company Ledger (Accounts Payable)`
  3. `Cash Book / Day Book` & `Bank / Mobile Wallet (JazzCash / EasyPaisa) Ledger`
  4. `Cheque Management & Bank Reconciliation` (Pending, Cleared, Bounced cheques)
  5. `General Ledger` & `Journal Entries` (with full audit history on adjustments)
  6. `Trial Balance`
  7. `Income Statement / Profit & Loss (P&L)` (Product-wise, Brand-wise, and Overall)
  8. `Balance Sheet`
  9. `Cash Flow Statement`

---

### Module 10: 10 Dedicated Dashboards, 19+ Business Reports & Automation Engine

#### 4.10.1 10 Role-Aware Module Dashboards
Every major module features a viewport-fitted dashboard displaying live KPI counters, interactive charts, pending task queues, and anomaly alerts:
1. `Main Business Executive Dashboard`
2. `Inventory & Product Dashboard` (Total, Active, Inactive, Top Products)
3. `Stock & Warehouse Dashboard` (Valuation, Utilization %, Low/Out/Expiring Stock)
4. `Purchase & Procurement Dashboard`
5. `Sales & Order Operations Dashboard`
6. `Customer / CRM & Beat Coverage Dashboard`
7. `Supplier / Company Performance Dashboard`
8. `Employee & Pending Task Dashboard`
9. `POS Counter Dashboard`
10. `Accounts & Recovery Dashboard`

#### 4.10.2 19+ Standard & Custom Business Reports
- **Report Catalog:** Daily/Weekly/Monthly/Yearly Sales, Purchase Report, Profit & Loss, Cash Flow, Customer Ledger, Supplier Ledger, Stock Movement, Batch-wise Stock, Expiry Report, Employee Task Report, Recovery Report, Expense Report, Tax Report, Product-wise Profitability, Customer-wise Profitability, Company/Brand-wise Performance, Rate List for Retail/Wholesale, and Order Requirement Report.
- **Export & Company Sharing:** All reports support `Full-Page Preview`, `PDF Export`, `Excel (.xlsx) Export`, `CSV Export`, `Direct Print`, and restricted **Company Information Sharing** (allowing Bookers/Admins to share company-specific stock positions and order requirements without exposing other companies' data).

#### 4.10.3 Notifications & Business Automation Rules
- **Real-Time Alerts:** Low Stock, Near Expiry, Pending Order Approval, Customer Credit Limit/Overdue Alert, Supplier Payment Due, Task Deadline, Invoice Modification/Cancellation Alert, and Daily Closing Summary.
- **Configurable Automation Pipeline:** When stock drops below a product's `Min QTY`, the system automatically flags the SKU, fires a Low Stock notification, drafts a Purchase Requirement for the linked Company/Supplier, and updates the Procurement Dashboard without duplicate triggers.

---

## 5. Non-Functional & UX Quality Mandates
1. **Mobile-First Responsive Design (`320px` to `4K`):** Built with Tailwind CSS. Complex data tables on desktop (`>= 768px`) automatically render as clean, touch-friendly stacked cards on mobile devices (`< 768px`).
2. **Zero-Scroll Desktop Workspace & Server-Side Pagination:** Pages are designed to fit cleanly inside the viewport without vertical page sprawl; all lists use indexed MongoDB pagination (`page`, `limit`), debounced search, and column visibility toggles so the ERP stays fast even with millions of records.
3. **Zero AI Slop & Human-Crafted Copy:** All labels, buttons, empty states, and modals use direct, clear business English and familiar Pakistani distribution terminology (`Booker`, `Beat`, `Chillan`, `Pehchan`, `Carton`, `Dozen`, `Recovery`, `Put Away`).