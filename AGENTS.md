# Movmak — Codex Project Instructions

Read this file and `MOVMAK_PROJECT_SPEC.md` before making changes. These are the project's standing instructions and V1 source of truth.

## Mission
Movmak, by Zeerol, is a simple digital visitor-management and front-desk operating system. It helps an organization know who is expected, who is inside, who has left, whom each visitor is visiting, when entry/exit happened, and which authorized user recorded each action.

**Principle: Simple for people. Strict behind the scenes.**

## Non-negotiable rules
- Treat `MOVMAK_PROJECT_SPEC.md` as the source of truth for V1 behavior.
- Inspect the repository before editing. Preserve existing work; never overwrite/delete files or data without permission.
- Work in small phases. Do not implement the entire application in one giant change.
- Report only commands, tests, migrations, builds, or integrations actually run and observed.
- If credentials or a human decision are required, stop and provide exact next steps. Never fabricate credentials or pretend an external service is connected.
- Avoid paid services/APIs unless the owner approves. Do not deploy, commit, or push unless explicitly asked.
- Never put secrets, passwords, service-role keys, tokens, or `.env` contents in source control, logs, screenshots, or output.
- Keep `.env.local` out of Git and provide `.env.example` with placeholder names only.
- Do not fake authentication, disable security checks, or create pretend production data.
- Prefer simple maintainable code over unnecessary abstractions and dependencies.
- Use current stable compatible package versions; avoid canary/prerelease versions unless explicitly approved.

## Approved V1 stack
- Next.js App Router
- TypeScript with strict mode
- React
- Tailwind CSS
- Supabase PostgreSQL, Auth, and Row Level Security (RLS)
- Accessible lightweight UI; use shadcn/ui only when useful
- Vercel-compatible configuration, but no deployment without permission
- Browser camera for QR scanning on supported phones/tablets/computers
- A maintained QR creation/scanning library selected after checking compatibility

Use Supabase directly from Next.js where appropriate. Do not add Express/a separate server unless a demonstrated requirement justifies it.

## Security and architecture requirements
- Enforce organization-level data isolation using Supabase RLS and server-side authorization. Hiding a button is not authorization.
- Verify permissions for every sensitive server/database operation.
- Invitation credentials, host codes, visit QR credentials, and state transitions must be validated by trusted server-side logic.
- Never trust browser-supplied organization IDs, host IDs, roles, visit status, or QR payloads without authorization checks.
- Use unpredictable cryptographically secure tokens. QR payloads must not expose personal data or be guessable.
- Store hashes of bearer-style tokens where practical; never log raw invitation secrets or QR bearer tokens.
- Enforce expiry, one-time use, and state transitions server-side/database-side, not only in UI.
- Prevent duplicate/concurrent check-in and checkout with atomic operations, constraints, or transactions where appropriate.
- Host codes are six digits, temporary/rotating, linked to an active authorized host, server-validated, rate-limited, and protected against brute-force attempts. Error messages must not reveal unnecessary personal information.
- A valid code proves possession of a currently valid host code; it does not independently prove the physical identity of the person holding the phone. The gate officer's call-back procedure remains important.
- Maintain an audit trail for important actions and authorized corrections. Ordinary users must not silently erase history.
- Store timestamps consistently in UTC and display the organization's/local timezone appropriately.
- Camera access can fail or be unavailable. Provide manual fallback.
- Do not claim Movmak guarantees security or proves a visitor's legal identity; it supports verification and accountability.

## Roles
- **Organization admin:** organization-wide inventory/history, basic reports, printable records, authorized user management.
- **Staff/host/resident:** own profile and current invitation link/code only; no organization visitor list.
- **Security/reception:** scan QR, register walk-ins/non-smartphone visitors, verify host codes, see currently-inside list, check visitors out.

Enforce roles server-side and in RLS. Membership in one organization must not grant access to another organization's data.

## Engineering standards
- Use clear names, small components, strict TypeScript, accessible forms, and responsive layouts for phones/tablets/desktop.
- Handle loading, empty, error, expired, invalid, duplicate-action, and permission-denied states.
- Do not rely on color alone for status.
- Minimize collected personal data.
- Test security-sensitive business logic.
- Run available lint, typecheck, tests, and production build after meaningful phases; report failures honestly.
- Version database migrations in the repository.
- Document setup and environment variables in README.
- Keep interface copy simple for Nigerian organizations and gate staff.

## Required phases
1. **Inspect repository/environment:** inspect folder and files, check Node/npm and Git. Do not overwrite existing files.
2. **Project foundation:** initialize Next.js + TypeScript + Tailwind, app shell, scripts, `.gitignore`, `.env.example`, README.
3. **Supabase foundation:** schema/migrations, Auth, organization membership/roles, RLS.
4. **Authentication and organization access:** login, protected routes, role checks, onboarding.
5. **Staff/host:** rotating invitation link and six-digit host code, copy/share actions, minimal profile screen.
6. **Visitor registration:** public invitation page, validation, visit creation, Visit ID, QR display/download/share.
7. **Gate workflows:** scanner, confirmation, check-in, manual registration, host-code verification, currently-inside list, checkout.
8. **Admin:** expected/inside/left inventory, history, reports, printable visitor inventory, authorized user management.
9. **Hardening:** permissions/RLS, expiry, one-time tokens, replay attempts, invalid transitions, audit trail, device checks, tests and documentation.

## Current repository state

Phases 1-7 are implemented in the repository and their ordered migrations
are applied to the linked Supabase Cloud project. Phase 8 has working admin
inventory, filters, printing, membership invitations, and audit history, but
the broader V1 hardening and isolated runtime security validation remain open.
Remote database lint, TypeScript, unit tests, ESLint, and the production build
last passed on 19 October 2026. The pgTAP suites and authenticated end-to-end
gate workflow tests have not run and must not be reported as passing.

Admin metrics, audit filters, invitation revocation, and membership lifecycle
management are implemented, and `20261015170000_admin_member_management.sql`
is applied. Runtime mutation checks for self-lockout and last-admin protection
remain deferred to an isolated test database.

A reusable organization join-link and administrator approval workflow is
implemented, and `20261019120000_secure_organization_join_links.sql` is applied
to the linked Movmak project. Its pgTAP and authenticated browser journeys
remain unexecuted because no isolated test database is available.

Continue to follow every approval, secret-handling, migration, commit, and
deployment rule above. This status note does not authorize future cloud
migrations, production-data mutation, commits, or deployment.

After each phase, report what changed, files/migrations created, checks actually run, results, blockers, and the next proposed phase. Do not begin the next phase without following the owner's workflow and approval.

## First task
Start with Phase 1 only. Inspect the current repository and environment. If empty, check Node.js/npm. Do not build UI, database schema, or features before reporting inspection findings. If ready, initialize in the current directory—do not create a nested `Movmak` folder. Ask before a potentially destructive or ambiguous action.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
