# Movmak V1 — Final Product Specification

**Product:** Movmak | **Company:** Zeerol | **Status:** Locked V1 scope; implementation in progress

## Current implementation status (19 October 2026)

The product requirements below remain the V1 source of truth. The current
implementation uses Next.js App Router Server Components and Server Actions,
Supabase Auth with SSR cookies, and Supabase PostgreSQL with forced RLS.

Implemented in code and migrated to Supabase Cloud:

- Email/password sign-up and sign-in, verified session handling, protected
  routes, role checks, self-service organization creation, and administrator
  approval of membership requests made through reusable join links.
- One organization membership per user. New organization creators become the
  first active administrator; sign-up alone grants no membership or role.
- Five-minute host invitation links and six-digit host codes. Rotation revokes
  the previous active pair. PostgreSQL stores only token hashes and keyed code
  hashes.
- Public invitation registration with name, phone, purpose, group size, atomic
  invitation consumption, unique Visit ID, and a separate opaque visit QR that
  can be displayed or downloaded.
- Security/reception home, camera QR scanning, manual QR fallback, QR preview,
  atomic check-in, host-code verification, direct/manual registration,
  Currently Inside with group headcount, and atomic checkout.
- Administrator status totals, visit inventory, text/status/date filters,
  print-friendly reports, organization join links, and audit history.

- Exact database-aggregated dashboard metrics, filtered audit history,
  invitation listing/revocation, and member role/status management with
  self-lockout and last-active-admin protection are implemented and migrated.
- QR scanning supports both check-in and checkout. Protected workspaces and
  public visitor registration have route-level loading and recovery screens.
- The implemented UI uses a consistent responsive Movmak design system with a
  text wordmark, role-specific navigation, active states, clearer dashboards,
  searchable Currently Inside records, and visible host/visitor action feedback.

Partially implemented or not yet runtime-verified:

- The resident/host workspace now includes own-profile editing, organization
  identity, encrypted same-browser restoration of current credentials, a
  server-checked expiry renewal, and clearer visitor instructions. Public
  registration now pre-validates invitations and can restore the latest QR on
  the same browser while the visit is active. The forward-only host issuance
  rate-limit migration `20261019130000` remains unapplied, so its database
  behavior and the full authenticated browser journey are unverified.

- A reusable organization join-link and administrator approval workflow is
  implemented and migrated in `20261019120000`. Pending requests remain
  outside active memberships; link secrets are hash-only and support rotation,
  revocation, expiry, rate limiting, and auditing. The legacy immediate-join
  RPCs are no longer executable by authenticated users. A read-only browser
  check confirmed existing admin access; applicant, approval, and denial
  journeys remain unverified.

- Cloud migrations and database lint pass, but authenticated end-to-end gate
  operations have not been exercised with a dedicated test organization and
  role-specific test accounts.
- Database pgTAP suites exist but have not executed because the optional local
  Docker runtime is unavailable. They must not be described as passing.
- Admin inventory is limited to the latest 500 matching database rows and V1
  basic reporting. Authorized visit corrections and richer visit detail views
  remain outstanding.

Outstanding V1 work includes browser-level end-to-end coverage, executing the
pgTAP security suite in an isolated database, organization settings,
hardened error/loading states, and final security and
accessibility review. No deployment has been performed.

## 1. Mission
Movmak replaces or improves the traditional paper visitor register with a simple digital process from arrival to departure. The organization should be able to answer: who is inside, whom they are visiting, when they entered/left, how many people entered under the visit, and who recorded each action. Organizations may print records on paper when they want.

**Principle: Simple for people. Strict behind the scenes.**

## 2. Entry modes
Organizations may use:
1. **Invitation-based visitor management**
2. **Direct gate/reception registration**

Both modes feed the same organization visitor inventory and history. Support both for an organization if this can be implemented simply and securely; otherwise use a clear organization-level mode setting and document the decision.

## 3. Roles and access
### Organization admin
Sees Expected/Inside/Left inventory, searches history, prints visitor reports, manages authorized organization users, and reviews audit history. Authorized corrections must not silently erase history.

### Staff / host / resident
Sees organization and own profile details, current invitation link, and current six-digit host code; can copy/share them. Does **not** see or manage visitor lists.

### Security / reception
Scans visit QR codes, manually registers walk-ins and visitors without smartphones, verifies host codes when required, sees Currently Inside, and checks visitors out. Actions are tied to the authenticated security/reception user.

## 4. Invitation flow
1. Host opens a minimal home screen showing organization details, their profile, current invitation link and six-digit invitation code.
2. Link/code refresh every **5 minutes**. Old credentials expire; successful registration consumes the authorization.
3. Host sends the link/code by WhatsApp, SMS, email, phone or another channel.
4. Visitor opens the link in a normal browser—no app or account required.
5. Visitor enters **Full Name, Phone Number, Purpose of Visit**.
6. Server validates the invitation, creates a visit record and unique Visit ID, then issues a visit-specific QR.
7. Visitor can display, screenshot, download or share the QR.

**Invitation token and visit QR are different credentials.** The five-minute invitation authorizes registration. The visit QR identifies one registered visit and works only while the visit is active. Checkout closes it permanently. A later visit needs a new visit record and QR. Registration alone does not mean the visitor is physically inside; the visit remains **EXPECTED** until check-in.

## 5. Visitor without a smartphone — required host verification flow
1. Visitor arrives without a smartphone or usable QR.
2. Security asks the visitor to call the person they claim to be visiting.
3. Host opens Movmak and provides their current unique six-digit host code.
4. Visitor tells the code to security.
5. Security enters the code in Movmak.
6. Movmak validates it server-side, identifies the host, and confirms the host is an active/authorized staff member, host, or resident in that organization.
7. Movmak displays the verified host and records them against the visit.
8. Security manually records visitor name, phone (or N/A), purpose and number of people entering, then checks the visitor in.
9. On departure, security finds the visit under **Currently Inside** and checks it out.

The host code is temporary/rotating, not a permanent employee PIN. Apply rate limits and safe error messages. A code proves possession of a currently valid host code; it does not independently prove the physical identity of the person using the phone. The call-back procedure and gate officer's judgment remain important.

## 6. Direct gate registration
For organizations that do not want invitations:
1. Visitor arrives.
2. Security selects **New Visitor**.
3. Security enters **Full Name, Phone Number or N/A, Person Being Visited, Purpose of Visit, Number of People Entering**.
4. Security selects **Check In**.
5. Movmak records the visit and the user who checked the visitor in.
6. At departure, security opens **Currently Inside**, finds the visit and selects **Check Out**.

No visitor account, smartphone, invitation link, or QR is required.

## 7. Visitors with companions
V1 records the primary visitor and **Number of People Entering**. Example: John Doe — 4 people means John plus three companions. Do not require individual companion records in V1. Show the recorded group count in the active inventory and consider it for emergency accountability; do not imply individual identities were verified.

## 8. Check-in and checkout
### QR check-in
Security scans with a supported phone/tablet/computer camera. Movmak validates the QR server-side and displays visitor, host, purpose, group count and status. Security confirms the person and selects **Check In**. Record time and authenticated user. Reject invalid, expired, already-checked-in, or closed visits.

### QR checkout
Security scans the same visit QR, Movmak verifies the visit is active and inside, and security selects **Check Out**. Record time and user; close the QR/visit credential.

### Manual checkout
Security opens **Currently Inside**, finds the active visit and selects **Check Out**. Required for visitors without smartphones/QRs. If camera permission or hardware is unavailable, provide a safe manual fallback.

## 9. Statuses and Visit ID
Invitation flow: **EXPECTED → INSIDE → LEFT**. Direct registration: **INSIDE → LEFT**. Check-in—not registration—establishes that someone is inside.

Every visit has a unique Visit ID, e.g. `VIS-2026-000184`. The actual ID must be unique and must not be used as a security token. A person and a visit are different: one person can have many visits. Each visit stores host, purpose, entry method, group count, check-in/out times, status and users responsible for actions.

## 10. Screens and flow map
### Public visitor screens
- **Invitation Registration:** organization logo/name, name, phone, purpose, submit.
- **Registration Result:** visit confirmation, Visit ID/reference, visit QR, screenshot/download/share options.
- Clear invalid/expired/used invitation states.

### Staff/host screens
- **Host Home:** organization details, own profile, current invitation link, current six-digit host code, copy/share actions.
- No visitor list.

### Security/reception screens
- **Gate Home:** three primary actions—**Scan QR**, **New Visitor**, **Currently Inside**.
- **QR Confirmation:** visitor/host/purpose/group details and check-in action.
- **New Visitor:** manual registration.
- **Host Verification:** code entry and verified host display for no-smartphone flow.
- **Currently Inside:** active visits, search and checkout action.
- Helpful errors for invalid QR, expired invitation, duplicate check-in, already checked out and failed host-code validation.

### Admin screens
- **Dashboard/Inventory:** Expected, Inside, Left.
- **Visitor/Visit History:** search and useful filters.
- **Visit Detail/Audit:** recorded details and event history.
- **Printable Visitor Inventory/Report.**
- **User and Role Management.**
- Basic reporting only; avoid complex analytics in V1.

## 11. Printable visitor inventory
Organizations can choose to print visitor inventory/records. Provide a print-friendly report with organization identity, appropriate filters, visitor and host details, status, dates/times, group count and necessary visit fields. Never print secret invitation tokens or raw QR bearer credentials. Limit printed personal data to what the authorized user needs. This supports organizations that want both digital and paper records.

## 12. Security and audit requirements
- Every important event records who performed it and when.
- Audit registration, check-in, checkout and authorized corrections.
- Ordinary users cannot silently delete historical visits.
- Prevent duplicate actions and invalid state transitions.
- Expired/used invitation credentials cannot be replayed; closed visit QR codes cannot be reused.
- Host codes are temporary, rate-limited and server-validated.
- Use Supabase RLS and server-side authorization to isolate organizations; hiding UI is not authorization.
- Use unpredictable visit-specific QR tokens; do not put sensitive personal data in QR payloads.
- Store timestamps in UTC and display appropriate local time.
- Handle concurrent check-in requests safely.
- Protect audit records from ordinary editing/deletion.
- Camera scanning must have a manual fallback.
- Movmak supports verification/accountability but does not guarantee identity or replace physical security procedures.

## 13. Explicitly out of scope for V1
Do not build without owner approval: facial recognition, biometrics, GPS tracking, phone surveillance, AI camera surveillance, hardware access control, badge printing, contractor/delivery/vehicle management, individual companion registration, complex enterprise analytics, or a required native visitor app.

## 14. Acceptance criteria
1. Active host shares invitation; expired/used credentials are rejected.
2. Visitor registers in a browser without account and receives visit-specific QR.
3. Security scans a valid QR, confirms, checks in, and later checks out.
4. Closed QR reuse is rejected.
5. Security manually registers and checks out a visitor without a smartphone.
6. No-smartphone flow requires current six-digit host code, identifies an active host, and records the host.
7. Security sees current-inside visits and group count.
8. Admin sees expected/inside/left and historical visits.
9. Admin can print inventory without exposing secret tokens.
10. Important actions link to authenticated user and audit history.
11. One organization cannot access another organization's records.
12. Responsive layout works on phone/tablet/desktop and manual fallback works without camera access.
13. Lint, typecheck, tests and production build pass, or remaining failures are reported honestly.

## 15. Locked V1 statement
**Invitation:** Invite → Register → Get visit QR → Check In → Check Out.

**No smartphone/direct gate:** Arrive → Call host when verification is required → Verify current host code → Register → Check In → Check Out.

All routes feed the same authorized organization inventory and visit history. V1 focuses on host verification, entry/exit tracking, accountability, emergency visibility and operational simplicity.
