Technical Requirements Document (TRD) — ELITE DIST (Distribution ERP & SFA Platform)

- **Product Name:** ELITE DIST — Enterprise Resource Planning (ERP) & Sales Force Automation (SFA) System for Distributors
- **Document Path:** `.agents/TRD.md`
- **Version:** 1.0 (Production Master Technical Specification)
- **Date:** November 2026
- **Architecture:** Split Client-Server Monorepo (`client/` + `server/`) on the **MERN Stack**

---

## 1. Technology Stack & Package Policy (100% MERN Stack Lock)

### 1.1 Backend Stack (`server/`)
- **Runtime & Framework:** Node.js (v20+ LTS) + Express.js (RESTful API Architecture)
- **Database & ODM:** MongoDB Atlas (Cloud Cluster) + Mongoose ODM (with ACID Multi-Document Transactions, Compound Indexing, and Lean Aggregation Pipelines)
- **Media Storage & CDN:** Cloudinary SDK (`cloudinary` + `multer` memory storage for streaming images directly to Cloudinary folders and storing `secure_url` + `public_id` in MongoDB Atlas)
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken` for Access + HTTP-Only Refresh Tokens), `bcryptjs` (Password Hashing), `helmet`, `cors`, `express-rate-limit`, `express-mongo-sanitize`, and `zod` / `express-validator` for strict request schema validation
- **Document & Report Generation:** `exceljs` / `xlsx` (Excel & CSV exports), `pdfkit` / `@react-pdf/renderer` (Printable Invoices, Chillans, Salesman/Recovery/Dispatch Sheets)

### 1.2 Frontend Stack (`client/`)
- **Framework & Bundler:** React 19 + Vite (Fast HMR, Code Splitting, Lazy Route Loading)
- **Styling & Theme Engine:** Tailwind CSS (Mobile-First Responsive `320px` to `4K`, CSS Custom Properties for instant **Blue & White** Light Mode and **Blue & Black** Dark Mode switching with `transition-colors duration-200`, strictly **Zero Purple**)
- **Routing & State Management:** React Router v7 (`react-router-dom`), Zustand / React Context for Auth, Theme, Sidebar & Active Portal state, and TanStack Query (`@tanstack/react-query`) for zero-lag server cache, pagination prefetching, and optimistic updates
- **Icons & Charts:** `lucide-react` (clean, consistent stroke icons — zero AI sparkles or bloated SVGs) + `recharts` / `chart.js` (theme-aware responsive charts fitted to compact viewport heights)

### 1.3 Latest Stable Package Policy
- Whenever any npm dependency is installed or updated in `client/package.json` or `server/package.json`, the **latest stable version** MUST be installed (`npm install <package>@latest`).
- **Strictly Prohibited Artifacts:** Never create Python/Django files (`manage.py`, `.py`, `requirements.txt`), Next.js SSR bloat, or unapproved styling libraries.

---

## 2. Strict Modular Folder Architecture (`client/` & `server/`)

Every AI coding agent MUST follow this exact directory structure. Creating random folders or monolithic 1,000-line files is strictly prohibited (**Maximum file length: 300–400 lines**; split controllers, services, or sub-components if larger).

```text
elite-dist-erp/
├── .agents/                                  # MANDATORY AI Agent Specifications (Read First)
│   ├── PRD.md
│   ├── SRD.md
│   ├── TRD.md
│   ├── design.md
│   ├── project-rules.md
│   ├── git-sync.md
│   └── features-phases.md
│
├── server/                                   # Node.js + Express + MongoDB Atlas Backend
│   ├── .env                                  # Backend Environment Secrets & Super Admin Credentials
│   ├── .env.example                          # Template for Backend .env
│   ├── package.json
│   └── src/
│       ├── server.js                         # Express Entry Point & Process-Once Bootstrap
│       ├── config/
│       │   ├── db.js                         # MongoDB Atlas Singleton Connection & Index Sync
│       │   ├── cloudinary.js                 # Cloudinary Config & Upload/Destroy Helpers
│       │   ├── env.js                        # Strict .env Validator (Fails fast if keys missing)
│       │   └── seedSuperAdmin.js             # Idempotent Super Admin Bootstrap from server/.env
│       ├── middlewares/
│       │   ├── authMiddleware.js             # JWT Verification & Active User Check
│       │   ├── rbacMiddleware.js             # Role & Work-Part Permission Guard (@requireRole)
│       │   ├── tenantMiddleware.js           # Distributor Data Isolation Guard (distributorId)
│       │   ├── uploadMiddleware.js           # Multer Memory Storage Filter for Cloudinary
│       │   └── errorMiddleware.js            # Global Error Handler & Standardized JSON Response
│       ├── models/                           # Master PRD v1.0 Mongoose Models (Strict distributorId Indexes)
│       │   ├── DistributorPolicy.model.js    # Tenant Settings: Stock Issue Policy (FIFO/FEFO/Manual), Custom Conditions
│       │   ├── User.model.js                 # Super Admin, Admin, Booker, Salesman, POS, Warehouse, 13-Point Matrix
│       │   ├── Company.model.js              # Principal Company Master (No separate Supplier Master; Brands & Territories)
│       │   ├── Brand.model.js                # Brand Master + Contacts/Socials + Cloudinary Logo/Cover
│       │   ├── Category.model.js             # Category & Sub-Category Master + Linked Brands
│       │   ├── Product.model.js              # Variant SKUs, Optional Purchase Rate, Unit Versioning, POS/Booking Flags
│       │   ├── Warehouse.model.js            # Strict Warehouse -> Zone -> Area Hierarchy
│       │   ├── StockBatch.model.js           # 14 Batch Fields, Immutable unitVersionId, purchaseRate, Conditions/Status
│       │   ├── StockMovement.model.js        # 9 Official Movement Types, 21+ Fields, Receiving Checks, Idempotency
│       │   ├── Customer.model.js             # Multi-Shop Owner Grouping, 15 Profile Fields, Multiple Contacts/Accounts
│       │   ├── Territory.model.js            # Brand/Warehouse/District/Booker Territories + 5D Product Auth
│       │   ├── BeatPlan.model.js             # Day-wise Booker Beat, Areas, Routes, Customers & Daily Booking Ops
│       │   ├── VisitLog.model.js             # Independent Booker Stop Check-in (Final Tag: 'Visited', Booking Skip)
│       │   ├── CommercialRule.model.js       # Discount/Charge/Scheme Rules (+ Coming Soon Guard for Tax/Partial Scheme)
│       │   ├── PrintTemplate.model.js        # Print Layouts, 6 Invoices, Supply/Delivery Docs, Official vs Custom Reports
│       │   ├── Order.model.js                # Verified Sources (Online/Booker/Admin/Official), Write-Your-Own, Rule Snapshot
│       │   ├── DispatchSheet.model.js        # Delivery Planning, Normal/Extra Dispatch, Loading Sheet Reconciliation
│       │   ├── SaleInvoice.model.js          # Original Immutable Snapshot, Edit Invoice, Final Invoice, Sales Skip
│       │   ├── Recovery.model.js             # Split Payments, Recovery Skip, Field Expenses, Cash Handover Math
│       │   ├── PendingTask.model.js          # Assigned Tasks (Recovery, Dispatch, Receiving, Count, Transfer, Expiry Back)
│       │   ├── OperationalLedger.model.js    # 10 Operational Account Types + 5 Invoice/Recovery Ledger Types & Company Payable
│       │   ├── GeneralExpense.model.js       # Loading, Transport & General Business Expenses (Isolated from SKU Cost)
│       │   ├── IdempotencyRecord.model.js    # Duplicate Prevention Across 7 Critical Operations (PRD §26.4)
│       │   ├── AttendancePayroll.model.js    # Placeholder Schema (HRM Payroll/Attendance/History Gated Coming Soon §30.2)
│       │   ├── Notification.model.js         # Low, Warning, Out, Expiry, MFG/EXP Discrepancy & Approval Alerts
│       │   └── AuditLog.model.js             # Immutable Audit Trail + Rule Application History
│       ├── controllers/                      # Modular Route Controllers (< 350 lines each)
│       │   ├── auth.controller.js
│       │   ├── distributor.controller.js     # Super Admin Provisioning & Tenant Stock Issue Policies
│       │   ├── inventory.controller.js
│       │   ├── warehouse.controller.js
│       │   ├── movement.controller.js        # Purchase Receiving (5-step), Transfers, Physical Counts, Expiry/Damage
│       │   ├── crm.controller.js
│       │   ├── rules.controller.js
│       │   ├── order.controller.js
│       │   ├── salesRecovery.controller.js   # Deal Edits (Original Preserved), Skips & Cash Handover
│       │   ├── task.controller.js
│       │   ├── portals.controller.js         # Booker (Visited/Skip), POS (posPermission) & Salesman Portals
│       │   ├── hrm.controller.js             # Employees + 13-Point Matrix (Coming Soon Guard on Payroll/Attendance)
│       │   ├── accounting.controller.js      # Operational Ledgers, Company Payable, General Expenses (No GL/TB/BS)
│       │   └── dashboardReport.controller.js # 4 Module Dashboards + 15 Official Reports + Shareable Custom Templates
│       ├── services/                         # Complex Business Logic & Calculation Engines
│       │   ├── invoiceCalc.service.js        # 2-Level Item & Grand Discount/Charge/Scheme Engine + Snapshots
│       │   ├── stockLedger.service.js        # FIFO/FEFO/Manual Policy, Unit Versioning, Reservation & Put-Away Engine
│       │   ├── operationalLedger.service.js  # Customer/Company Payable, 5 Ledger Event Types & Cash Handover Service
│       │   ├── idempotency.service.js        # Request Key Validation Across 7 Critical Operations
│       │   └── automationAlert.service.js    # Low/Warning/Out/Expiry, MFG/EXP Discrepancy & Requirement Engine
│       └── routes/                           # Express API Routers (/api/v1/*)
│           └── index.js
│
└── client/                                   # React 19 + Vite + Tailwind CSS Frontend
    ├── .env                                  # Frontend Environment Config (VITE_API_BASE_URL, etc.)
    ├── .env.example                          # Template for Frontend .env
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── styles/
        │   └── globals.css                   # Blue/White & Blue/Black CSS Tokens + Viewport Rules
        ├── context/
        │   ├── AuthContext.jsx               # JWT Session, Role & Work-Part Permissions
        │   ├── ThemeContext.jsx              # Smooth Light (Blue/White) & Dark (Blue/Black) Toggle
        │   └── ShellContext.jsx              # Collapsible Sidebar, Active Portal & Modal State
        ├── services/
        │   ├── apiClient.js                  # Axios Instance Connected to VITE_API_BASE_URL
        │   └── uploadService.js              # Cloudinary Multipart Image Upload Helper
        ├── components/
        │   └── global/                       # MANDATORY Global Reusable UI Components
        │       ├── AppShell.jsx              # Viewport-Locked (100dvh) Sidebar + Topbar + Workspace
        │       ├── Sidebar.jsx               # Role-Isolated Collapsible Sidebar with "Soon" Badges
        │       ├── Topbar.jsx                # Breadcrumb, Global Search, Notification Bell, Theme Toggle
        │       ├── MetricCard.jsx            # Global KPI Stat Card (Tabular Nums + Trend Badge)
        │       ├── SmartDataTable.jsx        # Desktop Sticky Table + Mobile Stacked Cards + Pagination
        │       ├── PaginationBar.jsx         # Synchronized Server-Side Pagination Footer
        │       ├── FilterToolbar.jsx         # Multi-Criterion Filter Bar + Column Visibility Toggle
        │       ├── ConfirmModal.jsx          # Global Custom Confirm / Delete Guard Modal
        │       ├── FormModal.jsx             # Global Reusable Add/Edit Drawer or Modal
        │       ├── ComingSoonModal.jsx       # Global Theme-Aware Coming Soon Modal
        │       ├── PrintPreviewModal.jsx     # Full-Size Printable Invoice/Report/Sheet Viewer
        │       ├── TouchKeypadModal.jsx      # Mobile Numeric Keypad for Booker, POS & Stock Count
        │       ├── ImageDropzone.jsx         # Cloudinary Image Preview & Upload Component
        │       └── ToastContainer.jsx        # Non-Intrusive Stacked Toast Notifications
        ├── pages/
        │   ├── auth/                         # Login, Signup & Role Redirector
        │   ├── dashboards/                   # 10 Dedicated Module Dashboards
        │   ├── inventory/                    # Products, Companies, Brands, Categories, Sub-Categories
        │   ├── stock/                        # Stock List, Warehouses, Zones, Areas, Stock Movements
        │   ├── crm/                          # Customers, Areas, Routes, Territories, Beat Plans
        │   ├── orders/                       # Order Master, Normal/Advance Order Builder, Operations
        │   ├── sales/                        # Sales Master, Recovery Assignment & Ledgers
        │   ├── settings/                     # Tax, Discount, Charge, Scheme Rules & Print Templates
        │   ├── tasks/                        # Pending Task Queue & Guided Task Execution Wizards
        │   ├── portals/                      # Dedicated Booker, POS Store & Salesman Portals
        │   ├── hrm/                          # Employee Master, Work Assignment, Attendance, Payroll
        │   ├── accounts/                     # Account Movements, Vouchers, Trial Balance, P&L, Ledger
        │   ├── reports/                      # 19+ Business Reports & Company Info Sharing Hub
        │   └── errors/
        │       └── NotFound404.jsx           # Theme-Aware Custom 404 Page
        └── routes/
            ├── AppRoutes.jsx                 # Master Route Configuration
            └── ProtectedRoute.jsx            # Role & Work-Part Route Guard
3. Environment Variables Contract (server/.env & client/.env)
Every configuration value, secret, and Super Admin credential MUST come from .env files. Zero credentials or URLs may be hardcoded in source files.

3.1 Backend Environment (server/.env)
Code snippet
NODE_ENV=development
PORT=5000

# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/elite_dist_erp?retryWrites=true&w=majority

# JWT Authentication Secrets
JWT_ACCESS_SECRET=replace_with_strong_64_char_access_secret
JWT_REFRESH_SECRET=replace_with_strong_64_char_refresh_secret
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Super Admin Bootstrap Credentials (Auto-seeded on startup if not exists)
SUPER_ADMIN_NAME=Elite Dist Super Admin
SUPER_ADMIN_EMAIL=admin@elitedist.com
SUPER_ADMIN_PHONE=03303008109
SUPER_ADMIN_PASSWORD=ReplaceWithStrongPassword123!
DEFAULT_DISTRIBUTOR_CODE=DIST-ELITE-001
DEFAULT_DISTRIBUTOR_NAME=ELITE DIST Agency

# Cloudinary Media Storage Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_ROOT_FOLDER=elite_dist_erp

# CORS & Frontend Origin
CLIENT_URL=http://localhost:5173
3.2 Frontend Environment (client/.env)
Code snippet
VITE_APP_NAME=ELITE DIST ERP
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_DEFAULT_PAGE_SIZE=10
VITE_DASHBOARD_PAGE_SIZE=5
VITE_CLOUDINARY_UPLOAD_PRESET=elite_dist_unsigned
4. MongoDB Atlas Collections Schema (server/src/models/)
All collections reside in the elite_dist_erp database on MongoDB Atlas, scoped by distributorId and indexed for sub-second pagination and aggregation:

4.1 users (Employees, Admins, 13-Point Permission Matrix & Work Assignments)
JavaScript
{
  _id: ObjectId,
  distributorId: String, // Indexed
  profileId: String, // e.g., "GC-04523", "IFTI-001" (Unique per distributor)
  fullName: String, // e.g., "IFTIKHAR AHMED"
  email: String, // Indexed Unique
  phone: String, // e.g., "03303008109"
  passwordHash: String,
  avatar: { url: String, publicId: String }, // Cloudinary
  primaryRole: "SUPER_ADMIN|ADMIN|BOOKER|SALESMAN|POS_OPERATOR|WAREHOUSE_MANAGER|STOREKEEPER|RECOVERY_OFFICER|WHOLESALER",
  workAssignments: ["Recovery|Booking|Stock Keeper|Wholesaler|POS Keeper"], // PRD §20.1
  workParts: {
    orderBooker: Boolean,      // Accept / Non Accept
    warehouseManager: Boolean, // Accept / Non Accept
    posStore: Boolean,         // Accept / Non Accept
    normalInvoice: Boolean,    // Accept / Non Accept
    advanceInvoice: Boolean,   // Accept / Non Accept
    salesman: Boolean          // Accept / Non Accept
  },
  // Mandatory 13-Point Permission Matrix (PRD §20.4)
  permissions: {
    moduleAccess: [String],             // 1. Allowed among 16 main navigation parts
    screenAccess: [String],             // 2. Allowed frontend route keys
    canView: Boolean,                   // 3. View records
    canCreate: Boolean,                 // 4. Create records
    canEdit: Boolean,                   // 5. Edit records
    canDelete: Boolean,                 // 6. Delete records (subject to zero-stock/historical guards)
    canSubmit: Boolean,                 // 7. Finalize & submit operational workflows
    canApprove: Boolean,                // 8. Approve orders, adjustments, receiving
    canStockMovement: Boolean,          // 9. Execute transfers, put-away, adjustments, purchases
    canPayment: Boolean,                // 10. Collect recoveries, company disbursements, field expenses
    purchasePriceVisibility: Boolean,   // 11. CRITICAL: True exposes purchase rates & cost valuations; false masks/strips
    reportAccess: [String],             // 12. Allowed official & custom report slugs
    assignedWarehouseIds: [ObjectId]    // 13. Warehouse scoping (empty = all if Admin)
  },
  linkedWarehouseId: ObjectId,
  assignedCompanyIds: [ObjectId],
  assignedBrandIds: [ObjectId],
  status: "ACTIVE|INACTIVE|BLOCKED",
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
4.2 companies (Principal Company Master — No Separate Supplier Master per PRD §4.2, §9.1, §29)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  companyCode: String, // e.g., "GC-04523"
  companyName: String, // e.g., "GREEN CHEMICALS"
  shortName: String,   // e.g., "GREEN"
  logo: { url: String, publicId: String }, // Cloudinary
  ownerName: String,   // e.g., "ASIF ATTARI"
  supplierName: String,// Company-linked supplier contact context (no separate Supplier Master)
  accountantName: String,
  businessType: "MANUFACTURER|IMPORTER|DISTRIBUTOR|PRINCIPAL",
  industryType: String,// e.g., "Chemicals"
  establishYear: Number,
  ntn: String,
  registrationNo: String,
  copyrightText: String,
  associatedBrands: [ObjectId],         // Brands linked under this Company
  authorizedProducts: [ObjectId],       // Approved SKUs for distribution
  territoryArrangements: [{             // Granular 5D Authorization (Company x Brand x Product x Territory x Area)
    brandId: ObjectId,
    productIds: [ObjectId],
    territoryId: ObjectId,
    allowedAreaIds: [ObjectId],
    isAuthorized: Boolean
  }],
  companyAccountInfo: {                 // Operational payable summary (PRD §9.9)
    totalPurchasesPkr: Number,
    totalReturnsPkr: Number,
    totalPaymentsMadePkr: Number,
    outstandingPayablePkr: Number
  },
  address: {
    country: String,   // "PAKISTAN"
    province: String,  // "SINDH"
    city: String,      // "KARACHI"
    zone: String,      // "ORANGI TOWN"
    streetAddress: String,
    mapLink: String,
    gps: { lat: Number, lng: Number }
  },
  contacts: [{
    personName: String, // Required primary contact (e.g., "AMIR BHAI")
    role: String,       // e.g., "Accountant", "Booker"
    contactNo: String,  // Required primary number
    channelType: "WHATSAPP|PHONE|LANDLINE",
    purpose: String,    // e.g., "Payment Transfer"
    isDefault: Boolean
  }],
  socialLinks: [{
    platform: String,   // "Facebook", "Instagram", "Website"
    pageName: String,
    purposeType: String,// "Promotions", "Career"
    url: String,
    isDefault: Boolean
  }],
  bankAccounts: [{
    accountType: "BANK|EASYPAISA|JAZZCASH",
    providerName: String, // "Bank Al Habib", "EasyPaisa"
    accountTitle: String,
    accountNo: String,
    ibanOrRef: String,
    isDefault: Boolean
  }],
  status: "ACTIVE|INACTIVE",
  createdAt: Date,
  updatedAt: Date
}
4.3 brands (Brand Master)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  brandCode: String, // e.g., "S-01"
  brandName: String, // e.g., "SILKO", "SURAJ", "GLOSSY", "WHITE WASH"
  companyId: ObjectId,
  brandType: String, // "Personal Care", "Cosmetics", "Home Care", "Detergent"
  logo: { url: String, publicId: String },       // Cloudinary
  coverImage: { url: String, publicId: String }, // Cloudinary
  ownerName: String,
  brandManager: String,
  salesManager: String,
  description: String,
  contacts: [{ personName: String, role: String, contactNo: String, channelType: String, isDefault: Boolean }],
  socialLinks: [{ platform: String, pageName: String, purposeType: String, url: String, isDefault: Boolean }],
  status: "ACTIVE|INACTIVE",
  createdAt: Date,
  updatedAt: Date
}
4.4 categories (Categories & Sub-Categories)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  code: String, // e.g., "S-01", "F-01", "SS-F"
  name: String, // e.g., "Shampoo" (Category) or "Fresh" (Sub-Category)
  level: "CATEGORY|SUB_CATEGORY",
  parentCategoryId: ObjectId, // null if CATEGORY, populated if SUB_CATEGORY
  companyId: ObjectId,
  linkedBrandIds: [ObjectId], // Selected Brands sub-table
  image: { url: String, publicId: String }, // Cloudinary
  description: String,
  status: "ACTIVE|INACTIVE",
  createdAt: Date,
  updatedAt: Date
}
4.5 products (Product Master — Variant-Per-SKU, Optional Purchase Rate & 8-Step Unit Versioning)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  skuCode: String, // Separate SKU per size/variant (e.g., "SS-500G", "SS-1KG") (Indexed)
  barcode: String,
  productName: String, // e.g., "Sufi Surf 500g", "Fresh AMLA 200ml"
  companyId: ObjectId,
  brandId: ObjectId,
  categoryId: ObjectId,
  subCategoryId: ObjectId,
  baseUnit: {
    unitName: String, // Smallest indivisible saleable unit ("Piece", "Bottle", "Sachet")
    weightValue: Number, // e.g., 0.500
    weightUnit: "g|Kg|ml|L",
    weightInKg: Number,
    traderPurchaseRate: Number, // OPTIONAL in Product Master (PRD §5.3); masked unless purchasePriceVisibility=true
    wholesaleSaleRate: Number,  // Wholesale / Sale Price
    posRetailEndRate: Number,   // POS / Consumer End Rate
    image: { url: String, publicId: String } // Cloudinary Base Item Image
  },
  packingUnits: [{
    unitName: String, // "Piece", "Bottle", "Dozen", "Carton", "Bag", "Sack", "Box"
    conversionQty: Number, // Base units per Packing unit (product-specific only)
    weightUnit: "Kg|g",
    packingWeightKg: Number, // Auto-calculated: baseUnit.weightInKg * conversionQty
    traderPurchaseRate: Number, // OPTIONAL & RBAC-masked (PRD §5.3)
    wholesaleSaleRate: Number,
    posRetailEndRate: Number,
    dimensions: {
      sizeUnit: "Inch|Feet|cm",
      width: Number,
      length: Number,
      height: Number,
      areaSq: Number,     // Auto: width * length
      volumeCubic: Number // Auto: width * length * height
    },
    image: { url: String, publicId: String },
    isDefaultStockUnit: Boolean
  }],
  // Unit Versioning History (PRD §5.7 — coexists per StockBatch, never mutates old stock)
  unitVersions: [{
    versionNo: Number,           // e.g., 1, 2
    unitVersionId: String,       // Immutable ID referenced by StockBatch & Order lines (e.g., "UV-1", "UV-2")
    unitName: String,            // e.g., "Carton"
    conversionQty: Number,       // e.g., v1=48 pcs, v2=50 pcs
    packingWeightKg: Number,
    effectiveFrom: Date,
    versionStatus: "ACTIVE_DEFAULT|COEXISTING|DEPLETED" // Auto-retires v1 when linked batch stock hits 0
  }],
  posPermission: Boolean,        // Governs visibility/sale in POS portal (PRD §5.2)
  bookingPermission: Boolean,    // Governs visibility/booking in Booker & Order workflows (PRD §5.2)
  defaultRules: {
    taxGroupId: ObjectId,        // Tax rule ref (Tax Group setup Coming Soon per PRD §18.2, §30.2)
    discountGroupId: ObjectId,
    schemeGroupId: ObjectId,
    loadingCharge: Number,
    retailProfitMarginPkr: Number,
    wholesaleMarginPkr: Number
  },
  assignedBookerIds: [ObjectId],
  futureMarketplaceCompatible: Boolean, // Reserved Phase 3 schema compatibility only (Excluded from v1.0 UI)
  shortDescription: String,
  longDescription: String,
  status: "ACTIVE|INACTIVE",
  createdAt: Date,
  updatedAt: Date
}
4.6 warehouses (Warehouse, Zone & Floor/Rack Area Hierarchy)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  warehouseCode: String, // e.g., "P-01", "ORANGI-001", "BALDIA-001"
  warehouseName: String, // e.g., "Plot No 01"
  warehouseType: "MAIN|SHOP|SUB_STORE",
  managerId: ObjectId,
  address: {
    country: String,
    province: String,
    city: String,
    zone: String,
    area: String,
    fullAddress: String,
    mapLink: String,
    gps: { lat: Number, lng: Number }
  },
  staffContacts: [{ personName: String, role: String, contactNo: String, channelType: String, isDefault: Boolean }],
  zones: [{
    _id: ObjectId,
    zoneCode: String, // e.g., "S-01", "SB-01"
    zoneName: String, // e.g., "Main Plot", "Main Shop", "Center Shop"
    zoneType: "NORMAL|MIX|TEMPERATURE|COLD_STORE",
    storageType: "NORMAL|DAMAGE|MIX|EXPIRY",
    condition: "NORMAL|FREEZE|TEMPERATURE",
    dimensions: { sizeUnit: String, width: Number, length: Number, height: Number, totalArea: Number, totalVolume: Number },
    areas: [{
      _id: ObjectId,
      areaCode: String, // e.g., "SDH-Rs10", "A-001"
      areaName: String, // e.g., "1st Floor", "SURAJ Rs10 Floor"
      areaType: "FLOOR|RACK|WALKED",
      storagePurpose: "NORMAL|DAMAGE|MIX|EXPIRY",
      condition: "NORMAL|FREEZE|TEMPERATURE",
      dimensions: { sizeUnit: String, width: Number, length: Number, height: Number, areaSq: Number, volumeCubic: Number },
      allowedProducts: [{
        productId: ObjectId,
        minQtyPacking: Number, // e.g., 5
        maxQtyPacking: Number  // e.g., 1000
      }]
    }]
  }],
  utilizationPct: Number,
  status: "ACTIVE|INACTIVE",
  createdAt: Date,
  updatedAt: Date
}
4.7 stock_batches (14 Batch Fields, Immutable Unit Version Snapshot & FIFO/FEFO Allocation State)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  batchNo: String, // 1. Batch ID (Indexed)
  productId: ObjectId, // 2. Product/SKU
  purchaseDate: Date,  // 3. Purchase Date (Used for FIFO sorting)
  mfgDate: Date,       // 4. MFG Date
  expDate: Date,       // 5. EXP Date (Used for FEFO sorting)
  warehouseId: ObjectId, // 12. Warehouse
  zoneId: ObjectId,      // 13. Zone
  areaId: ObjectId,      // 14. Area (Warehouse -> Zone -> Area hierarchy)
  unitVersionId: String, // Immutable snapshot from Product.unitVersions (PRD §5.7)
  unitName: String,      // 8. Unit
  packingSpecification: String, // 9. Packing specification snapshot
  conversionQty: Number, // Immutable conversion factor preserved for this batch
  purchaseRatePerBase: Number, // 6. Purchase rate (originates from Purchase Movement; RBAC masked)
  purchaseRatePerPack: Number,
  initialPurchaseBaseQty: Number, // 7. Initial Purchase Quantity
  currentBaseQty: Number,   // 11. Remaining stock in base units
  reservedBaseQty: Number,  // Locked against APPROVED orders
  availableBaseQty: Number, // Formula: currentBaseQty - reservedBaseQty (PRD §6.4)
  totalWeightKg: Number,    // 10. Weight
  totalStockValuePkr: Number, // RBAC-filtered cost valuation
  condition: "FRESH|NORMAL|DAMAGE|EXPIRE|DAMAGE_EXPIRE", // Official system conditions (PRD §6.5)
  customConditionLabel: String, // Optional distributor supplementary tag (never replaces official condition)
  status: "NORMAL|LOW|WARNING|OUT|BLOCKED|QUARANTINED", // PRD §6.6 statuses
  thresholds: {
    minStockPack: Number,
    maxStockPack: Number,
    expiryAlertDays: Number
  },
  updatedAt: Date
}
4.8 stock_movements (9 Official Types, Expected vs Received Checks, Physical Count & Idempotency)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  idempotencyKey: String, // Unique per distributor (PRD §26.4 duplicate prevention)
  movementCode: String, // e.g., "M-011"
  movementType: "PURCHASE|DELIVERY|TRANSFER|SAME_TRANSFER|ADJUSTMENT|EXPIRY_DAMAGE_BACK|RECOVERY|POS_SALE|CUSTOM_SALE|CUSTOMER_SALE", // PRD §8.2
  taskName: String,
  receivingStage: "PURCHASE_RECEIVED|CHECK_AND_RECEIVED|MOVE_AND_PUT_AWAY|MOVEMENT_CREATED|RESULT_FINALIZED", // PRD §9.4
  supplierContext: String, // Company-linked supplier/contact text (No separate Supplier Master per §9.1)
  fromWarehouseId: ObjectId,
  toWarehouseId: ObjectId,
  companyId: ObjectId,
  brandId: ObjectId,
  categoryId: ObjectId,
  preparedById: ObjectId,
  assignedToId: ObjectId,
  dispatchedById: ObjectId,
  receivedById: ObjectId,
  items: [{
    productId: ObjectId,
    batchId: ObjectId,
    batchNo: String,
    unitVersionId: String,
    conversionQty: Number,
    fromZoneId: ObjectId,
    fromAreaId: ObjectId,
    toZoneId: ObjectId,
    toAreaId: ObjectId,
    mfgDate: Date,
    expDate: Date,
    receivedMfgDate: Date, // Used for Expected vs Received MFG/EXP discrepancy check (PRD §9.5)
    receivedExpDate: Date,
    hasDateDiscrepancy: Boolean,
    unitName: String,
    expectedBaseQty: Number,
    receivedBaseQty: Number,
    differenceBaseQty: Number, // received - expected (PRD §9.5)
    // Segregated Put-Away quantities (PRD §9.6)
    putAwayNormalBaseQty: Number,
    putAwayDamageBaseQty: Number,
    putAwayExpireBaseQty: Number,
    // Physical Stock Count / Adjustment fields (PRD §8.7)
    systemBaseQty: Number,
    physicalCountBaseQty: Number,
    updatedBalanceBaseQty: Number,
    purchaseRatePerPack: Number, // Isolated per batch (Never includes Loading/Transport §9.10)
    movedPackQty: Number,
    movedBaseQty: Number,
    totalWeightKg: Number,
    totalValuePkr: Number,
    lineDecision: "ACCEPT|NON_ACCEPT"
  }],
  linkedTaskId: ObjectId,
  isHidden: Boolean,
  status: "DRAFT|PENDING|TRANSFER_PENDING|APPROVED|COMPLETED|CANCELLED",
  remarks: String,
  createdAt: Date,
  completedAt: Date
}
4.9 customers (CRM Multi-Shop Under Single Owner, 15 Profile Fields, Multi-Contacts & Rule Controls)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  customerCode: String, // Isolated Customer ID per shop (e.g., "C-1110")
  ownerGroupKey: String,// Links multiple shops under one owner (e.g., Orangi / Baldia / Qasba §10.1)
  shopName: String,     // e.g., "Shop 1 — Orangi Lucky Store"
  shopPic: { url: String, publicId: String }, // Cloudinary
  ownerName: String,    // e.g., "HAJI AKRAM"
  ownerContact: String,
  customerType: "WHOLESALER|RETAILER|SUB_DISTRIBUTOR|POS_WALKIN",
  shopCategory: String, // "Confectionery", "General", "Store"
  cnic: String,
  ntn: String,
  strn: String,
  registrationNo: String,
  locationHierarchy: {
    city: String,
    townOrZone: String,
    areaId: ObjectId,
    routeId: ObjectId,
    street: String,
    pehchanRemarks: String,
    mapLink: String,
    gps: { lat: Number, lng: Number }
  },
  contacts: [{
    personName: String,
    role: "SHOPKEEPER|ACCOUNTANT|STORE_KEEPER|OTHER", // PRD §10.4
    contactNo: String,
    channelType: "WHATSAPP|PHONE|LANDLINE",
    isDefault: Boolean
  }],
  paymentAccounts: [{ accountType: "BANK|EASYPAISA|JAZZCASH|OTHER", providerName: String, accountTitle: String, accountNo: String, ibanOrRef: String, isDefault: Boolean }],
  financialTerms: {
    paymentCondition: "PAID|CREDIT|ADVANCE", // PRD §10.4
    allowCredit: Boolean,
    creditLimitPkr: Number,
    creditDays: Number,
    outstandingBalancePkr: Number // Shop-isolated balance
  },
  commercialAssignments: {
    assignedBookerIds: [ObjectId],
    territoryId: ObjectId,
    taxGroupId: ObjectId,
    discountGroupId: ObjectId,
    schemeGroupId: ObjectId
  },
  visitPosition: "NORMAL|VISITED|ORDERED|DELIVERED", // Independent Booker Visited tag supported (§12.3)
  status: "ACTIVE|INACTIVE|BLOCKED",
  createdAt: Date,
  updatedAt: Date
}
4.10 territories & beat_plans (Geo Areas, Routes, Territories & Beats)
JavaScript
// territories & routes master
{
  _id: ObjectId,
  distributorId: String,
  territoryCode: String, // e.g., "T-01"
  territoryName: String, // e.g., "SURAJ Double Horse", "ORANGI HOUSE"
  territoryType: "BRAND_WISE|WAREHOUSE_WISE|DISTRICT_WISE|BOOKER_WISE",
  linkedBrandId: ObjectId,
  linkedWarehouseId: ObjectId,
  linkedBookerId: ObjectId,
  areas: [{
    areaCode: String, // "AQC-23"
    areaName: String, // "QASBA COLONY"
    city: String,
    subDistrict: String,
    areaType: "MARKET|MALL|SHOPS|FACTORY",
    routes: [{
      routeCode: String, // "R-1"
      routeName: String, // "JAMSHEED PUMP ROAD"
      routeType: String,
      isAccepted: Boolean
    }]
  }],
  status: "ACTIVE|INACTIVE"
}

// beat_plans
{
  _id: ObjectId,
  distributorId: String,
  beatCode: String, // e.g., "BATB-1"
  beatName: String, // e.g., "ALIGARH TO BANARAS"
  beatDay: "MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY",
  assignedBookerId: ObjectId,
  connectedAreas: [{
    areaId: ObjectId,
    areaName: String,
    connectedRoutes: [{
      routeId: ObjectId,
      routeName: String,
      customers: [{
        customerId: ObjectId,
        customerType: "WHOLESALER|RETAILER",
        decision: "ACCEPT|NON_ACCEPT"
      }]
    }]
  }],
  totalWholesalers: Number,
  totalRetailers: Number,
  status: "ACTIVE|INACTIVE"
}
4.11 commercial_rules (Discounts, Charges & Schemes — Tax Group & Partial Scheme Marked Coming Soon §30.2)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  ruleCategory: "TAX|DISCOUNT|CHARGE|SCHEME", // NOTE: TAX is Coming Soon (§18.2, §30.2); SCHEME target/slab sections gated until completed
  isComingSoonGated: Boolean, // True for incomplete Tax Group / partial Scheme Group modes
  level: "PRODUCT_LEVEL|GRAND_LEVEL", // Strictly separated Product vs Grand engines (PRD §18.7)
  ruleName: String,
  calculationMode: "GENERAL_AUTO|ADVANCE_GENERAL|PERCENTAGE_AUTO|TARGET_WISE|YES_NO|SLAB|PRODUCT_WISE_SCHEME|SLAB_SCHEME",
  compareBasis: "NONE|RATE|QUANTITY|WEIGHT_KG|AMOUNT_PKR",
  thresholdValue: Number,
  benefitValue: Number,
  schemeDetails: {
    schemeSubType: "SAME_PRODUCT|PRODUCT_WISE|SLAB_SCHEME|TARGET_WISE",
    paidProductId: ObjectId,
    paidUnit: String,
    paidQty: Number,
    freeProductId: ObjectId,
    freeUnit: String,
    freeQty: Number
  },
  invoiceRuleToggles: {
    discountAllow: Boolean,
    taxAllow: Boolean,
    rateAllow: Boolean,
    schemeAllow: Boolean,
    chargesAllow: Boolean
  },
  timeline: {
    isAllTime: Boolean,
    startDate: Date,
    endDate: Date
  },
  status: "ACTIVE|EXPIRED|INACTIVE",
  createdAt: Date
}
4.12 orders (Verified Sources, Write-Your-Own Customer Mode, 5D Auth & Immutable Rule Snapshots)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  idempotencyKey: String, // Unique per distributor (PRD §26.4 duplicate prevention)
  orderCode: String, // e.g., "O-01"
  orderMode: "NORMAL|ADVANCE|POS",
  orderType: "URGENT|POS|SPECIAL|REGULAR|NORMAL|S_DISPATCH", // PRD §13.1
  source: "ONLINE|BOOKER|ADMIN|OFFICIAL", // Only verified sources (PRD §13.1, §29)
  customerSelectionMode: "SELECT_CUSTOMER|CREATE_CUSTOMER|WRITE_YOUR_OWN", // PRD §13.2
  customerId: ObjectId, // Null if WRITE_YOUR_OWN
  writeYourOwnCustomer: {
    shopOrPersonName: String,
    phone: String,
    addressText: String
  },
  customerSnapshot: { shopName: String, ownerName: String, addressText: String, paymentCondition: String }, // Frozen at approval (§3.3)
  bookerId: ObjectId,
  areaId: ObjectId,
  routeId: ObjectId,
  stockIssuePolicyApplied: "FIFO|FEFO|MANUAL", // Recorded from DistributorPolicy (§6.3)
  lineItems: [{
    productId: ObjectId,
    batchId: ObjectId,
    unitVersionId: String,
    conversionQty: Number,
    unitName: String,
    unitWeightKg: Number,
    baseRate: Number,
    customSaleRate: Number,
    quantity: Number,
    baseQty: Number,
    grossRateTotal: Number,
    totalWeightKg: Number,
    itemDiscountRuleId: ObjectId,
    itemDiscountAmount: Number,
    itemChargeRuleId: ObjectId,
    itemChargeAmount: Number,
    itemTaxAmount: Number,
    schemeRuleId: ObjectId,
    isFreeSchemeRow: Boolean,
    netLineAmount: Number
  }],
  grandSummary: {
    totalItems: Number,
    totalQuantity: Number,
    totalWeightKg: Number,
    totalVolumeCubic: Number,
    grossAmount: Number,
    totalItemDiscounts: Number,
    grandDiscountRuleId: ObjectId,
    grandDiscountAmount: Number,
    grandChargeRuleId: ObjectId,
    grandChargeAmount: Number,
    grandTaxAmount: Number,
    netPayableAmount: Number
  },
  ruleApplicationSnapshot: Object, // Immutable copy of all applied discounts, charges & schemes (§18.8)
  invoiceStyle: {
    layoutType: "LANDSCAPE|CHILLAN_FINANCE|DETAILED_LANDSCAPE|ADVANCE_INVOICE|POS_RETAIL", // PRD §13.4
    originalAndDuplicate: Boolean,
    selectedNotes: [String]
  },
  approvalInfo: {
    status: "DRAFT|PENDING|APPROVED|DELIVERY|COMPLETE|CANCEL", // PRD §13.5
    approvedById: ObjectId,
    approvedAt: Date
  },
  assignedSalesmanId: ObjectId,
  assignedStorekeeperId: ObjectId,
  createdAt: Date
}
4.13 sale_invoices, recoveries & visit_logs (Doorstep Immutability, Skips, Cash Handover & Visits)
JavaScript
// sale_invoices (Supports Original Immutable Invoice, Edit Deltas, Final Invoice & Sales Skip §15.3-15.10)
{
  _id: ObjectId,
  distributorId: String,
  idempotencyKey: String,
  invoiceCode: String,
  orderId: ObjectId,
  dispatchSheetId: ObjectId,
  customerId: ObjectId,
  salesmanId: ObjectId,
  dealOutcome: "FINALIZED_SALE|SALES_SKIP", // Never treat SALES_SKIP as a zero completed sale (§15.9)
  salesSkipInfo: {
    skipReason: String,
    skipStatus: String,
    remarks: String,
    skippedAt: Date
  },
  // Immutable Original Invoice preserved forever for Report 22.13 vs 22.14 (§15.3)
  originalInvoiceSnapshot: {
    lineItems: [Object],
    grossAmount: Number,
    discountAmount: Number,
    chargeAmount: Number,
    netAmount: Number,
    capturedAt: Date
  },
  editDeltas: [{
    editType: "QTY_ADJUST|ITEM_RETURN|ITEM_DAMAGE|ITEM_EXPIRE|EXTRA_ITEM|EXTRA_RETURN_OK|EXTRA_RETURN_SKIP|GRAND_EDIT",
    productId: ObjectId,
    batchId: ObjectId,
    unitVersionId: String,
    qtyDelta: Number,
    valueDeltaPkr: Number,
    reason: String,
    editedAt: Date
  }],
  // Delivery Sales Movement totals (Report 22.8 Formula §22.8)
  financialSummary: {
    totalAmount: Number,
    extraValue: Number,
    returnValue: Number,
    extraReturnValue: Number,
    extraDiscountValue: Number,
    netAmount: Number,       // Total Amount + Extra Value - Return Value - Extra Return Value - Extra Discount Value
    totalPaidAmount: Number,
    balanceAmount: Number    // Net Amount - Total Paid Amount
  },
  status: "DRAFT|FINALIZED|SKIPPED|CANCELLED",
  completedAt: Date
}

// recoveries (Recovery Skip, Multi-Method Split Payments & Cash Handover §16.4-16.9)
{
  _id: ObjectId,
  distributorId: String,
  idempotencyKey: String,
  recoveryCode: String,
  customerId: ObjectId,
  recoveryOfficerId: ObjectId,
  dispatchSheetId: ObjectId,
  outcome: "COLLECTED|RECOVERY_SKIP", // SKIP generates Recovery Result; never collected payment (§16.7)
  recoverySkipInfo: { skipReason: String, skipStatus: String, remarks: String },
  paymentEntries: [{
    paymentMethod: "CASH|CHECK|ONLINE|BANK_ACCOUNT|EASY_PAISA|JAZZ_CASH", // PRD §17.3
    paymentAccount: String,
    refNo: String,
    dueDate: Date,
    paidAmountPkr: Number
  }],
  extraReturns: [{
    productId: ObjectId,
    batchId: ObjectId,
    returnType: "DAMAGE|EXPIRE|RETURN",
    qty: Number,
    valuePkr: Number,
    putAwayCompleted: Boolean
  }],
  // Field Expenses & Cash Handover Reconciliation (PRD §16.8, §22.8)
  fieldExpenses: {
    gasPetrolPkr: Number,
    enjoymentPkr: Number,
    worksPkr: Number,
    remarks: String
  },
  cashHandover: {
    totalDueCashPkr: Number,      // Cash Collected - Approved Field Expenses
    totalCashReceivedPkr: Number, // Physical cash counted at depot
    shortageOrExtraPkr: Number    // Cash Received - Due Cash
  },
  linkedTaskId: ObjectId,
  status: "DRAFT|FRESH|COMPLETE|SKIPPED",
  createdAt: Date
}

// visit_logs (Independent Booker Visit Completion Tag = 'Visited' §12.3-12.4)
{
  _id: ObjectId,
  distributorId: String,
  beatPlanId: ObjectId,
  bookerId: ObjectId,
  customerId: ObjectId,
  visitStatus: "VISITED", // Completes solely by visit regardless of order/recovery outcome (§12.3)
  bookingActionOutcome: "BOOKED|RECOVERED|BOOKING_SKIP|NO_ORDER_VISITED",
  bookingSkipReason: String,
  gps: { lat: Number, lng: Number },
  visitedAt: Date
}
4.14 operational_ledgers & general_expenses (Replaces Conventional GL per PRD §9.9-9.10, §17, §22.15, §29)
JavaScript
// operational_ledgers (Stores all 10 Operational Account types & 5 Invoice/Recovery Ledger event categories)
{
  _id: ObjectId,
  distributorId: String,
  idempotencyKey: String,
  ledgerDomain: "CUSTOMER_LEDGER|RECOVERY_LEDGER|INVOICE_LEDGER|COMPANY_PAYABLE_LEDGER|PAYMENT_HISTORY|OUTSTANDING|RECOVERY_RESULT|PURCHASE_PAYMENT_HISTORY|CASH_ACCOUNT_RECORD",
  invoiceRecoveryEventType: "EXTRA_RETURN|EXTRA_ITEM|EXTRA_DISCOUNT|CHARGE_OFF|PAID_PAYMENT|NONE", // PRD §22.15 5 Types
  companyId: ObjectId,  // Populated for Company-Wise Payable Ledger (§9.9)
  customerId: ObjectId, // Populated for shop-isolated AR ledger (§10.2)
  sourceTransactionRef: String,
  sourceModel: "StockMovement|SaleInvoice|Recovery|Payment",
  paymentMethod: "CASH|CHECK|ONLINE|BANK_ACCOUNT|EASY_PAISA|JAZZ_CASH",
  paymentAccount: String,
  refNo: String,
  dueDate: Date,
  debitOrIncreasePkr: Number,
  creditOrDecreasePkr: Number,
  runningBalancePkr: Number,
  remarks: String,
  createdById: ObjectId,
  createdAt: Date
}

// general_expenses (Loading, Transport & Other Expenses — NEVER allocated into StockBatch.purchaseRate §9.10)
{
  _id: ObjectId,
  distributorId: String,
  expenseCategory: "LOADING|TRANSPORT|OTHER_GENERAL_BUSINESS_EXPENSE|RECOVERY_FIELD_EXPENSE",
  linkedMovementOrDispatchRef: String,
  amountPkr: Number,
  paymentMethod: "CASH|BANK_ACCOUNT|EASY_PAISA|JAZZ_CASH",
  description: String,
  recordedById: ObjectId,
  expenseDate: Date
}
4.15 distributor_policies, idempotency_records & report_templates (SaaS Policy & Shared Templates §6.3, §21, §26.4)
JavaScript
// distributor_policies
{
  _id: ObjectId,
  distributorId: String, // Unique
  distributorName: String,
  stockIssuePolicy: "FIFO|FEFO|MANUAL", // Admin selectable (PRD §6.3)
  customStockConditions: [{ label: String, mappedSystemCondition: "FRESH|NORMAL|DAMAGE|EXPIRE" }], // §6.5
  defaultInvoiceStyle: String,
  subscriptionTier: "DUA_INTERNAL|SAAS_STANDARD|SAAS_ENTERPRISE",
  status: "ACTIVE|SUSPENDED"
}

// idempotency_records (Duplicate Submission Prevention Across 7 Critical Ops §26.4)
{
  _id: ObjectId,
  distributorId: String,
  operationType: "PURCHASE_MOVEMENT|STOCK_MOVEMENT|PAYMENT|ORDER|SALES_RESULT|RECOVERY_RESULT|ADJUSTMENT",
  idempotencyKey: String, // Unique compound { distributorId, operationType, idempotencyKey }
  responseStatus: Number,
  resourceId: ObjectId,
  expiresAt: Date
}

// print_templates / custom_report_templates (Official System vs Shareable Custom Templates §18.9, §21.2)
{
  _id: ObjectId,
  distributorId: String, // "PLATFORM_GLOBAL" for official templates
  templateScope: "OFFICIAL_ELITE_DIST|USER_CUSTOM_PRIVATE|USER_CUSTOM_SHARED",
  isProtectedOfficial: Boolean, // Blocks tenant edits (PRD §18.15)
  category: "PRINT_LAYOUT|INVOICE_TEMPLATE|DELIVERY_DOC|SUPPLY_DOC|REPORT_DOC|CUSTOM_REPORT_DEFINITION",
  subType: String, // e.g., "Landscape", "Delivery Dispatch", "Salesman Sheet", "Recovery Sheet", "Booking Sheet"
  sanitizedSchemaConfig: Object // Pure layout/column/filter structure — ZERO tenant business data (§25.2)
}
5. REST API & Frontend Route Architecture (Aligned to 16 Nav Parts, 15 Official Reports & §29 Exclusions)
5.1 Backend REST API Endpoints (/api/v1)
/api/v1/auth -> POST /login, POST /register (501/Gated Coming Soon while Super Admin controlled provisioning is active), POST /refresh, POST /logout, GET /me

/api/v1/distributor -> GET/PATCH /policy (Stock Issue Policy FIFO/FEFO/Manual, Custom Stock Conditions), Super Admin tenant provisioning

/api/v1/upload -> POST /image (Cloudinary multipart upload returning { url, publicId }), DELETE /image

/api/v1/inventory -> CRUD + Bulk Rules for /companies (no separate Supplier Master), /brands, /categories, /sub-categories, /products (optional purchaseRate, purchasePriceVisibility projection filter, unitVersions)

/api/v1/warehouses -> CRUD + 4-Step Zero-Qty Delete Guard for /warehouses, /zones, /areas (strict Warehouse -> Zone -> Area hierarchy)

/api/v1/stocks -> GET /batches (RBAC-filtered cost), PATCH /policy-select, GET /valuation (RBAC-filtered), POST /movements (Idempotency guarded: Purchase Receiving 5-Step, Transfer, Same Transfer, Adjustment, Physical Count, Expiry/Damage Back)

/api/v1/crm -> CRUD + Apply Rules for /customers (Multi-Shop ownerGroupKey), /areas, /routes, /territories (5D Authorization), /beats

/api/v1/rules -> CRUD for /discounts, /charges, /schemes (partial Coming Soon §30.2), /templates (Official vs Shared Custom); NOTE: /taxes returns 501 Coming Soon (§18.2, §30.2)

/api/v1/orders -> GET /, POST /calculate-preview (2-Level Engine), POST / (Online/Booker/Admin/Official + Write Your Own + idempotencyKey), PATCH /approve-batch (FIFO/FEFO/Manual reservation), POST /delivery-plan

/api/v1/sales-recovery -> GET /sales, POST /deal-edit (preserves Original Invoice Snapshot §15.3), POST /sales-skip, POST /recovery-assign, POST /recovery-collect (split payments), POST /recovery-skip, POST /extra-return, POST /cash-handover

/api/v1/tasks -> GET /my-tasks, PATCH /:id/start, PATCH /:id/dispatch, PATCH /:id/put-away, PATCH /:id/stock-count, PATCH /:id/complete

/api/v1/portals -> Dedicated mobile endpoints for /booker/* (Visited tag + Booking Skip), /pos/* (posPermission enforced + Write Your Own), and /salesman/*

/api/v1/hrm -> /employees, /work-assignments, /permissions-matrix (13-point matrix); NOTE: /attendance, /payroll, /history-reports gated Coming Soon (§20.5, §30.2)

/api/v1/accounts -> /ledgers (Customer, Recovery, Invoice [5 Event Types]), /company-payables, /general-expenses (Loading/Transport isolated), /cash-accounts (NOTE: Conventional GL/Journal Entries/Trial Balance/Balance Sheet Excluded per PRD §29)

/api/v1/dashboards-reports -> /dashboards/:moduleSlug (4 Confirmed Module Dashboards: Product, Stock, Customer, Warehouse), /reports/:reportSlug (All 15 Official Reports §22.1-22.15 + 20 Global Filter Dimensions + Anonymized Custom Report Templates)

5.2 Frontend React Router Map (16 Main Navigation Parts per PRD §24.1)
/auth/login -> Public Login Screen (/auth/signup gated with Coming Soon per single-tenant/controlled onboarding guard)

/dashboard -> Executive & 4 Confirmed Module Dashboards (Product, Stock, Customer, Warehouse); /quick-start -> Quick Start Guide

/inventory/products, /inventory/companies, /inventory/brands, /inventory/categories, /inventory/sub-categories

/stock/overview, /stock/list, /stock/warehouses, /stock/zones, /stock/areas, /stock/movements, /stock/movements/create, /stock/purchase-receiving

/crm/dashboard, /crm/customers, /crm/areas-routes, /crm/territories, /crm/beats

/booking/order-for-booking, /orders/master, /orders/create-normal, /orders/create-advance, /orders/operations

/sales/master, /recovery/assign, /recovery/ledger, /recovery/cash-handover

/settings/rules, /settings/templates, /settings/stock-policy, /settings/users-logging

/tasks/pending, /tasks/execute/:taskId

/portal/booker, /portal/pos, /portal/salesman, /sfa/overview

/hrm/employees, /hrm/work-assignments (History & Reports, Payroll & Salary, Attendance & Leaving route to <ComingSoonModal />)

/accounts/movements, /accounts/ledgers, /accounts/company-payables, /accounts/expenses

/reports/center (15 Official Reports §22.1-22.15 + Custom Shared Templates), /reports/company-share

* -> NotFound404.jsx (Theme-Aware Custom 404 Safety Net)

6. Global Component & Performance Contracts
Zero Native Browser Popups: window.alert(), window.confirm(), and window.prompt() are strictly banned. All confirmations (Delete Company/Area, Approve Orders, Cancel Invoice, Logout) MUST invoke <ConfirmModal /> or <ToastContainer />.

Global Component Reuse: Never write duplicate table markup, pagination footers, or KPI cards inside feature pages. Every page MUST import <SmartDataTable />, <PaginationBar />, <MetricCard />, <FilterToolbar />, and <PrintPreviewModal /> from client/src/components/global/.

Viewport-Locked Desktop & Mobile Card-List Contract:

Desktop screens (>= 1024px) use a h-dvh overflow-hidden app shell where the header and filter bar stay fixed and only the inner table body scrolls if needed, paired with server-side pagination (default 5 or 10 rows).

Mobile screens (< 768px) automatically switch <SmartDataTable /> from tabular columns to touch-friendly stacked cards with 1-tap action buttons and <TouchKeypadModal /> for fast quantity entry.