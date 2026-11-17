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
│       ├── models/                           # 22 Mongoose Models (Strict Schemas & Indexes)
│       │   ├── User.model.js                 # Super Admin, Admin, Booker, Salesman, POS, Storekeeper
│       │   ├── Company.model.js              # Manufacturer/Supplier Master + Contacts/Banks/Socials
│       │   ├── Brand.model.js                # Brand Master + Contacts/Socials + Cloudinary Logo/Cover
│       │   ├── Category.model.js             # Category & Sub-Category Master + Linked Brands
│       │   ├── Product.model.js              # Product Master, Multi-Units, 3-Tier Rates, Volume
│       │   ├── Warehouse.model.js            # Warehouse, Zone (Section) & Area (Floor/Rack) Hierarchy
│       │   ├── StockBatch.model.js           # Batch-wise Stock, MFG/EXP, Condition, Status, Min/Max
│       │   ├── StockMovement.model.js        # Transfer, Same Transfer, Adjustment, Purchase, Damage Back
│       │   ├── Customer.model.js             # 7-Level Geo/Pehchan, Multi-Shop, Credit Limit, Rules
│       │   ├── Territory.model.js            # Brand/Warehouse/District/Booker Territories
│       │   ├── BeatPlan.model.js             # Day-wise Booker Beat, Connected Areas, Routes & Customers
│       │   ├── CommercialRule.model.js       # Tax, Discount, Charge & Scheme Groups (Level 1 & Level 2)
│       │   ├── PrintTemplate.model.js        # Invoice, Chillan, Sheet & Report Header/Footer/Notes
│       │   ├── Order.model.js                # Normal/Advance Orders, 2-Level Calc, Approval State
│       │   ├── DispatchSheet.model.js        # Delivery Planning, Load Weight/Volume, Extra Dispatch
│       │   ├── SaleInvoice.model.js          # Final Sales, POS Sales, On-Spot Edits, Outstanding
│       │   ├── Recovery.model.js             # Cash/Online/Cheque Collections, Extra Returns, Expenses
│       │   ├── PendingTask.model.js          # Assigned Tasks (Dispatch, Recovery, Put-Away, Count)
│       │   ├── AccountLedger.model.js        # Double-Entry Journal, AR/AP, Cash/Bank/Cheque Ledgers
│       │   ├── AttendancePayroll.model.js    # HRM Attendance, Leave, Salary & Commission Records
│       │   ├── Notification.model.js         # Low Stock, Expiry, Approval, Overdue & System Alerts
│       │   └── AuditLog.model.js             # Immutable Audit Trail for Stock & Financial Mutations
│       ├── controllers/                      # Modular Route Controllers (< 300 lines each)
│       │   ├── auth.controller.js
│       │   ├── inventory.controller.js
│       │   ├── warehouse.controller.js
│       │   ├── movement.controller.js
│       │   ├── crm.controller.js
│       │   ├── rules.controller.js
│       │   ├── order.controller.js
│       │   ├── salesRecovery.controller.js
│       │   ├── task.controller.js
│       │   ├── portals.controller.js         # Booker, POS & Salesman Mobile Portal Endpoints
│       │   ├── hrm.controller.js
│       │   ├── accounting.controller.js
│       │   └── dashboardReport.controller.js
│       ├── services/                         # Complex Business Logic & Calculation Engines
│       │   ├── invoiceCalc.service.js        # 2-Level Item & Grand Discount/Tax/Charge/Scheme Engine
│       │   ├── stockLedger.service.js        # Atomic Stock Reservation, Deduction & Put-Away Engine
│       │   ├── accountingPost.service.js     # Automated Double-Entry Voucher & Ledger Posting
│       │   └── automationAlert.service.js    # Low Stock, Expiry & Auto-Purchase Requirement Engine
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

4.1 users (Employees & Admins)
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
  primaryRole: "SUPER_ADMIN|ADMIN|BOOKER|SALESMAN|POS_OPERATOR|WAREHOUSE_MANAGER|STOREKEEPER|ACCOUNTANT",
  workParts: {
    orderBooker: Boolean,      // Accept / Non Accept
    warehouseManager: Boolean, // Accept / Non Accept
    posStore: Boolean,         // Accept / Non Accept
    normalInvoice: Boolean,    // Accept / Non Accept
    advanceInvoice: Boolean,   // Accept / Non Accept
    salesman: Boolean          // Accept / Non Accept
  },
  linkedWarehouseId: ObjectId,
  assignedCompanyIds: [ObjectId],
  assignedBrandIds: [ObjectId],
  status: "ACTIVE|INACTIVE|BLOCKED",
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
4.2 companies (Manufacturer / Supplier Master)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  companyCode: String, // e.g., "GC-04523"
  companyName: String, // e.g., "GREEN CHEMICALS"
  shortName: String,   // e.g., "GREEN"
  logo: { url: String, publicId: String }, // Cloudinary
  ownerName: String,   // e.g., "ASIF ATTARI"
  supplierName: String,// e.g., "AMIR ATTARI"
  accountantName: String,
  businessType: "MANUFACTURER|IMPORTER|DISTRIBUTOR|SUPPLIER",
  industryType: String,// e.g., "Chemicals"
  establishYear: Number,
  ntn: String,
  registrationNo: String,
  copyrightText: String,
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
    personName: String, // e.g., "AMIR BHAI"
    role: String,       // e.g., "Accountant", "Booker"
    contactNo: String,
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
4.5 products (Product Master — Separated from Stock)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  skuCode: String, // e.g., "GC-04523", "FA200", "SDH-10" (Indexed)
  barcode: String,
  productName: String, // e.g., "Fresh AMLA 200ml", "SURAJ Rs10"
  companyId: ObjectId,
  brandId: ObjectId,
  categoryId: ObjectId,
  subCategoryId: ObjectId,
  baseUnit: {
    unitName: String, // "Bottle", "Piece", "Bar", "Packet"
    weightValue: Number, // e.g., 0.500
    weightUnit: "g|Kg|ml|L",
    weightInKg: Number,
    traderPurchaseRate: Number, // Cost / Purchase Price (e.g., 90)
    wholesaleSaleRate: Number,  // Wholesale / Sale Price (e.g., 110)
    posRetailEndRate: Number,   // POS / Consumer End Rate (e.g., 120)
    image: { url: String, publicId: String } // Cloudinary Base Item Image
  },
  packingUnits: [{
    unitName: String, // "Carton", "Dozen", "Box", "Sack"
    conversionQty: Number, // Base units per Packing unit (e.g., 24)
    weightUnit: "Kg|g",
    packingWeightKg: Number, // Auto-calculated: baseUnit.weightInKg * conversionQty
    traderPurchaseRate: Number,
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
    image: { url: String, publicId: String }, // Cloudinary Pack Item Image
    isDefaultStockUnit: Boolean
  }],
  defaultRules: {
    taxGroupId: ObjectId,
    discountGroupId: ObjectId,
    schemeGroupId: ObjectId,
    loadingCharge: Number,
    retailProfitMarginPkr: Number,
    wholesaleMarginPkr: Number
  },
  assignedBookerIds: [ObjectId],
  showOnMarketplace: Boolean,
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
4.7 stock_batches (Batch-Level Stock & Reservation State)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  batchNo: String, // e.g., "B-001", "B001:01" (Indexed)
  productId: ObjectId,
  warehouseId: ObjectId,
  zoneId: ObjectId,
  areaId: ObjectId,
  mfgDate: Date,
  expDate: Date,
  purchaseRatePerBase: Number,
  purchaseRatePerPack: Number,
  currentBaseQty: Number,   // Total physical stock in base units
  reservedBaseQty: Number,  // Locked against approved/pending orders
  availableBaseQty: Number, // Computed: currentBaseQty - reservedBaseQty
  totalWeightKg: Number,
  totalStockValuePkr: Number,
  condition: "NORMAL|DAMAGE|EXPIRE|DAMAGE_EXPIRE",
  status: "AVAILABLE|RESERVED|LOW_WARNING|OUT|BLOCKED|QUARANTINED",
  thresholds: {
    minStockPack: Number,   // e.g., 20 Pack
    maxStockPack: Number,   // e.g., 50 Pack
    expiryAlertDays: Number // e.g., 90 Days
  },
  updatedAt: Date
}
4.8 stock_movements (Transfers, Adjustments, Purchases & Damage Returns)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  movementCode: String, // e.g., "M-011"
  movementType: "TRANSFER|SAME_TRANSFER|ADJUSTMENT|PURCHASE|EXPIRY_DAMAGE_BACK|DELIVERY_OUT|CUSTOMER_RETURN",
  taskName: String,
  fromWarehouseId: ObjectId,
  toWarehouseId: ObjectId,
  supplierCompanyId: ObjectId,
  preparedById: ObjectId,
  assignedToId: ObjectId,
  dispatchedById: ObjectId,
  receivedById: ObjectId,
  items: [{
    productId: ObjectId,
    batchId: ObjectId,
    batchNo: String,
    fromZoneId: ObjectId,
    fromAreaId: ObjectId,
    toZoneId: ObjectId,
    toAreaId: ObjectId,
    mfgDate: Date,
    expDate: Date,
    unitName: String,
    previousErpBaseQty: Number, // Used in ADJUSTMENT
    physicalCountBaseQty: Number,
    missingBaseQty: Number,
    damagedBaseQty: Number,
    movedPackQty: Number,
    movedBaseQty: Number,
    totalWeightKg: Number,
    totalValuePkr: Number,
    lineDecision: "ACCEPT|NON_ACCEPT"
  }],
  linkedTaskId: ObjectId,
  isHidden: Boolean,
  status: "DRAFT|PENDING|APPROVED|COMPLETED|CANCELLED",
  createdAt: Date,
  completedAt: Date
}
4.9 customers (CRM Customer Master & 7-Level Geo/Pehchan)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  customerCode: String, // e.g., "C-1110", "FA200", "GC-04523"
  shopName: String,     // e.g., "Lucky Store", "Al Makkah Confectionery"
  shopPic: { url: String, publicId: String }, // Cloudinary
  ownerName: String,    // e.g., "IMTIAZ AHSAN"
  ownerContact: String,
  customerType: "WHOLESALER|RETAILER|SUB_DISTRIBUTOR|POS_WALKIN",
  shopCategory: String, // "Confectionery", "General", "Store", "Supplier"
  ntn: String,
  registrationNo: String,
  locationHierarchy: {
    city: String,          // 1. City ("Karachi")
    townOrZone: String,    // 2. Town/Zone ("Orangi")
    areaId: ObjectId,      // 3. Area ("Qasba Colony")
    routeId: ObjectId,     // 4. Route ("Jamsheed Pump Road")
    street: String,        // 5. Street ("Islamiyah Ki Gali")
    pehchanRemarks: String,// 6. Pehchan ("PUMP KY ULTY HAATH ROAD PER ULTY HAATH JALI WALI SHOP")
    mapLink: String,
    gps: { lat: Number, lng: Number }
  },
  contacts: [{ personName: String, role: String, contactNo: String, channelType: String, isDefault: Boolean }],
  paymentAccounts: [{ accountType: String, providerName: String, accountTitle: String, accountNo: String, ibanOrRef: String, isDefault: Boolean }],
  financialTerms: {
    paymentCondition: "PAID_CASH|ALLOW_CREDIT|ADVANCE",
    creditLimitPkr: Number,
    creditDays: Number,
    outstandingBalancePkr: Number
  },
  commercialAssignments: {
    assignedBookerIds: [ObjectId],
    territoryId: ObjectId,
    taxGroupId: ObjectId,
    discountGroupId: ObjectId,
    schemeGroupId: ObjectId
  },
  visitPosition: "NORMAL|VISITED|ORDERED|DELIVERED",
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
4.11 commercial_rules (Taxes, Discounts, Charges & Schemes)
JavaScript
{
  _id: ObjectId,
  distributorId: String,
  ruleCategory: "TAX|DISCOUNT|CHARGE|SCHEME",
  level: "PRODUCT_LEVEL|GRAND_LEVEL",
  ruleName: String, // e.g., "Trader Offer Rs20", "10K Per Rs100 Offer", "10 Per 1 Free"
  calculationMode: "GENERAL_FLAT|PERCENTAGE|SLAB_GENERAL|FIX_GENERAL|FIX_PERCENT|PRODUCT_WISE_SCHEME|SLAB_SCHEME|TARGET_SCHEME",
  compareBasis: "NONE|RATE|QUANTITY|WEIGHT_KG|AMOUNT_PKR",
  thresholdValue: Number, // e.g., 10000 PKR or 50 KG or 10 Cartons
  benefitValue: Number,   // e.g., 100 PKR or 7.5% or 1 Free Qty
  schemeDetails: {
    paidProductId: ObjectId,
    paidUnit: String,
    paidQty: Number,
    freeProductId: ObjectId,
    freeUnit: String,
    freeQty: Number
  },
  timeline: {
    isAllTime: Boolean,
    startDate: Date,
    endDate: Date
  },
  status: "ACTIVE|EXPIRED|INACTIVE",
  createdAt: Date
}
4.12 orders, sale_invoices, recoveries & pending_tasks
JavaScript
// orders (Normal & Advance Orders with 2-Level Invoice Calculation)
{
  _id: ObjectId,
  distributorId: String,
  orderCode: String, // e.g., "O-01"
  orderMode: "NORMAL|ADVANCE|POS",
  orderType: "REGULAR|URGENT|SPECIAL|DISPATCH|CUSTOM_SALE",
  source: "ONLINE|BOOKER|ADMIN|POS|WHATSAPP",
  customerId: ObjectId,
  bookerId: ObjectId,
  areaId: ObjectId,
  routeId: ObjectId,
  lineItems: [{
    productId: ObjectId,
    batchId: ObjectId,
    unitName: String, // "Carton", "Dozen", "Piece"
    unitWeightKg: Number,
    baseRate: Number,
    customSaleRate: Number, // Supports reverse discount calculation
    quantity: Number,
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
  invoiceStyle: {
    layoutType: "CHILLAN_FINANCE|DETAILED_LANDSCAPE|ADVANCE_INVOICE|EXPIRY_BATCH_CHILLAN|POS_RETAIL",
    originalAndDuplicate: Boolean,
    selectedNotes: [String]
  },
  approvalInfo: {
    status: "DRAFT|PENDING|APPROVED|DELIVERY_ASSIGNED|COMPLETED|CANCELLED",
    approvedById: ObjectId,
    approvedAt: Date
  },
  assignedSalesmanId: ObjectId,
  assignedStorekeeperId: ObjectId,
  createdAt: Date
}
5. REST API & Frontend Route Architecture
5.1 Backend REST API Endpoints (/api/v1)
/api/v1/auth -> POST /login, POST /register, POST /refresh, POST /logout, GET /me

/api/v1/upload -> POST /image (Cloudinary multipart upload returning { url, publicId }), DELETE /image

/api/v1/inventory -> CRUD + Bulk Rules for /companies, /brands, /categories, /sub-categories, /products

/api/v1/warehouses -> CRUD + Zero-Qty Delete Guard for /warehouses, /zones, /areas

/api/v1/stocks -> GET /batches, POST /rules, GET /valuation, POST /movements (Transfer, Same Transfer, Adjustment, Purchase, Expiry/Damage Back)

/api/v1/crm -> CRUD + Bulk Rule Assignment for /customers, /areas, /routes, /territories, /beats

/api/v1/rules -> CRUD for /taxes, /discounts, /charges, /schemes, /templates

/api/v1/orders -> GET /, POST /calculate-preview (2-Level Engine), POST /, PATCH /approve-batch, POST /delivery-plan

/api/v1/sales-recovery -> GET /sales, POST /recovery-assign, POST /recovery-collect, POST /extra-return

/api/v1/tasks -> GET /my-tasks, PATCH /:id/start, PATCH /:id/dispatch, PATCH /:id/put-away, PATCH /:id/stock-count, PATCH /:id/complete

/api/v1/portals -> Dedicated mobile endpoints for /booker/*, /pos/*, and /salesman/*

/api/v1/hrm -> /employees, /work-assignments, /attendance, /payroll

/api/v1/accounts -> /movements, /approve, /ledgers, /trial-balance, /profit-loss, /balance-sheet, /cash-flow

/api/v1/dashboards-reports -> /dashboards/:moduleSlug (10 Dashboards), /reports/:reportSlug (19+ Reports + PDF/Excel/CSV/Share)

5.2 Frontend React Router Map (client/src/routes/AppRoutes.jsx)
/auth/login, /auth/signup -> Public Auth Screens

/dashboard -> Role-aware redirect or Executive Dashboard (with tabs/links to all 10 Module Dashboards)

/inventory/products, /inventory/companies, /inventory/brands, /inventory/categories, /inventory/sub-categories

/stock/overview, /stock/list, /stock/warehouses, /stock/zones, /stock/areas, /stock/movements, /stock/movements/create

/crm/dashboard, /crm/customers, /crm/areas-routes, /crm/territories, /crm/beats

/orders/master, /orders/create-normal, /orders/create-advance, /orders/operations

/sales/master, /recovery/assign, /recovery/ledger

/settings/rules, /settings/templates

/tasks/pending, /tasks/execute/:taskId

/portal/booker, /portal/pos, /portal/salesman

/hrm/employees, /hrm/attendance, /hrm/payroll, /hrm/reports

/accounts/movements, /accounts/ledgers, /accounts/statements

/reports/center, /reports/company-share

* -> NotFound404.jsx (Theme-Aware Custom 404 Safety Net)

6. Global Component & Performance Contracts
Zero Native Browser Popups: window.alert(), window.confirm(), and window.prompt() are strictly banned. All confirmations (Delete Company/Area, Approve Orders, Cancel Invoice, Logout) MUST invoke <ConfirmModal /> or <ToastContainer />.

Global Component Reuse: Never write duplicate table markup, pagination footers, or KPI cards inside feature pages. Every page MUST import <SmartDataTable />, <PaginationBar />, <MetricCard />, <FilterToolbar />, and <PrintPreviewModal /> from client/src/components/global/.

Viewport-Locked Desktop & Mobile Card-List Contract:

Desktop screens (>= 1024px) use a h-dvh overflow-hidden app shell where the header and filter bar stay fixed and only the inner table body scrolls if needed, paired with server-side pagination (default 5 or 10 rows).

Mobile screens (< 768px) automatically switch <SmartDataTable /> from tabular columns to touch-friendly stacked cards with 1-tap action buttons and <TouchKeypadModal /> for fast quantity entry.