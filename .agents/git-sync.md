# Git Synchronization, Branching & Release Protocol (`git-sync.md`) — ELITE DIST

- **Product Name:** ELITE DIST — Enterprise Resource Planning (ERP) & Sales Force Automation (SFA) System for Distributors
- **Document Path:** `.agents/git-sync.md`
- **Version:** 1.0 (Production Git & DevOps Sync Standard)
- **Date:** November 2026

---

## 1. Core Git Philosophy & Repository Hygiene

1. **Phase-Aligned Atomic Commits:** Every phase in `.agents/features-phases.md` (Phases 001 through 100) maps to a clean, verifiable Git checkpoint. Never bundle 10 unrelated modules into a single broken commit.
2. **Absolute `.env` & Secret Protection:** Neither `server/.env` nor `client/.env` (nor any Cloudinary API secret, MongoDB Atlas password, or Super Admin password) may **ever** be staged or committed to Git.
3. **Zero Build Bloat in Repository:** `node_modules/`, `client/dist/`, `.DS_Store`, `*.log`, coverage reports, and temporary upload buffers must remain strictly ignored via `.gitignore`.
4. **Always Push Working Builds:** Never commit or push a phase if `server` fails to boot or `client` fails `npm run build`.

---

## 2. Mandatory Root `.gitignore` Specification

Ensure the root `.gitignore` file contains these exact rules before initializing or syncing the repository:

```gitignore
# Dependencies
node_modules/
client/node_modules/
server/node_modules/

# Environment Variables & Secrets (CRITICAL: NEVER COMMIT)
.env
.env.*
!.env.example
client/.env
client/.env.*
!client/.env.example
server/.env
server/.env.*
!server/.env.example

# Build & Production Artifacts
client/dist/
client/build/
server/dist/
server/build/

# Logs & Runtime Data
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
pids
*.pid
*.seed
*.pid.lock

# OS & Editor Files
.DS_Store
Thumbs.db
.vscode/*
!.vscode/extensions.json
.idea/
*.swp
*.swo

# Local Temporary Uploads / Cache
server/uploads/
server/tmp/
.cache/
.unslop/
3. Branching Strategy
main (Production-Ready Branch): Holds stable, verified milestone releases (every 10 phases or completed module).

develop (Active Integration Branch): Primary working branch where sequential phases (Phase 001 -> Phase 100) are integrated and tested end-to-end.

Feature / Phase Branches (Optional for Multi-Agent or Team Workflows):

Naming convention: phase/<phase-number>-<short-slug>

Examples:

phase/001-monorepo-env-foundation

phase/015-product-master-multi-unit

phase/042-two-level-invoice-engine

phase/068-booker-mobile-portal

4. Standardized Commit Message Convention
Every commit message must follow the structured Phase + Conventional Commit format so the project history is crystal clear and auditable:

Plaintext
<type>(phase-<XXX>): <concise summary of implemented module/feature>

- <bullet 1: backend models/controllers/routes added or updated>
- <bullet 2: frontend pages/global components/hooks wired>
- <bullet 3: verification performed (pagination, mobile view, theme, .env check)>
Allowed <type> Prefixes:
feat: New phase feature, schema, API endpoint, or UI screen (e.g., feat(phase-014): implement product master multi-unit and volume calculator).

fix: Bug fix, calculation correction, or layout overflow fix (e.g., fix(phase-045): resolve reverse sale rate discount rounding in level-1 invoice).

refactor: Code splitting to keep files under 350 lines or query optimization.

style: Theme token refinement (Blue & White / Blue & Black) or responsive layout polish.

docs: Updates to .agents/*.md documentation or phase status tracking.

chore: Package updates (@latest), .gitignore, or build configuration.

5. Step-by-Step Pre-Commit & Sync Workflow (Run After Every Phase)
Every time a phase from .agents/features-phases.md is completed, execute this exact 6-step workflow:

Step 1: Secret & Tracked File Audit
Verify that no .env file or node_modules folder is staged:

Bash
git status
If client/.env or server/.env appears in untracked/modified files, stop immediately and verify .gitignore.

Step 2: Backend Syntax & Boot Verification
Bash
cd server
npm run lint --if-present
node --check src/server.js
cd ..
Step 3: Frontend Production Build & Bundle Check
Bash
cd client
npm run build
cd ..
Fix any broken imports, missing Lucide icon names, or JSX syntax errors before proceeding.

Step 4: Update Phase Tracker in .agents/features-phases.md
Mark the completed phase checkbox from [ ] to [x] inside .agents/features-phases.md so the next agent session knows the exact state of the project.

Step 5: Stage & Commit Changes
Bash
git add .
git commit -m "feat(phase-XXX): <clear description of completed phase>"
Step 6: Pull Rebase & Push to Remote
Bash
git pull --rebase origin develop
git push origin develop
(Or push to main if operating directly on the primary branch: git pull --rebase origin main && git push origin main.)

6. Emergency Recovery & Rollback Commands
Unstage accidentally staged files before commit:

Bash
git reset HEAD <file-path>
Remove a accidentally tracked .env from Git cache without deleting it from disk:

Bash
git rm --cached server/.env client/.env
git commit -m "chore(security): untrack .env files from git index"
Inspect the last 5 phase commits:

Bash
git log --oneline -n 5