---
name: elite-dist-erp
description: >-
  Master workflow and specification lookup skill for the ELITE DIST Distribution
  ERP & SFA platform. Use on every coding, architecture, UI, database, or phase
  execution task in the Elitedis workspace to load exact schemas, routes,
  wireframe rules, and phase checklists from .agents/*.md.
---

# ELITE DIST — Phase Execution & Specification Runbook

Use this skill whenever implementing, debugging, or verifying any feature or phase in the ELITE DIST repository.

## 1. Specification Lookup Map (Read Relevant Sections Before Coding)
- **Master Constitution & Rules**: [rules.md](../../rules.md)
- **UI/UX Tokens, `100dvh` AppShell & Anti-Loop Guardrails**: [design.md](../../design.md)
- **System Architecture, RBAC Roles & Work-Parts**: [srd.md](../../srd.md)
- **Folder Tree, 22 Mongoose Schemas, API Routes & `.env` Contracts**: [trd.md](../../trd.md)
- **Product Modules, 2-Level Invoice Math, Warehouses, CRM & Portals**: [prd.md](../../prd.md)
- **100-Phase Implementation Roadmap & Checkboxes**: [features-phases.md](../../features-phases.md)
- **Git Branching, `.gitignore` & 6-Step Post-Phase Sync**: [git-sync.md](../../git-sync.md)

## 2. Step-by-Step Phase Execution Workflow
1. **Locate Target Phase**: Read the target phase entry in [features-phases.md](../../features-phases.md) and cross-reference its schema/route definitions in [trd.md](../../trd.md) and functional rules in [prd.md](../../prd.md).
2. **Backend Implementation (`server/`)**:
   - Enforce `tenantMiddleware` (`distributorId`), `authMiddleware`, and `rbacMiddleware`.
   - Define compound indexes starting with `{ distributorId: 1, ... }`.
   - Implement server-side pagination (`page`, `limit`, `search`, `sortBy`, `sortOrder`) and atomic Mongoose transactions for stock/accounting mutations.
   - Keep each file under 350–400 lines.
3. **Frontend Implementation (`client/`)**:
   - Render inside `<AppShell />` (`100dvh` desktop lock) using only global components from `client/src/components/global/` and CSS variables from `client/src/styles/globals.css` (Blue/White Light, Blue/Black Dark, Zero Purple).
   - Fetch data via TanStack Query with primitive keys; support `<SmartDataTable />` mobile card view (`< 768px`) and `tabular-nums`.
4. **6-Step Verification & Git Sync ([git-sync.md](../../git-sync.md))**:
   - Run `git status` to ensure `client/.env`, `server/.env`, and `node_modules/` are never tracked.
   - Run `node --check src/server.js` in `server/` and `npm run build` in `client/`.
   - Update the phase checkbox from `[ ]` to `[x]` in [features-phases.md](../../features-phases.md).
   - Commit with `<type>(phase-<XXX>): <concise summary>` and sync to remote when requested.
