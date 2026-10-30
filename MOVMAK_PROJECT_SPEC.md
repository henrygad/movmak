# Movmak V1 — Final Product Specification

**Product:** Movmak | **Company:** Zeerol | **Status:** Locked V1 scope; implementation in progress

## Current implementation status (29 October 2026)

On 21 October 2026, local onboarding code gained separate owner, host, and
reception signup screens, one shared login, automatic join requests after email
confirmation, and immediate routing to the role-specific dashboard. The account
role is recorded at signup, while pending applicants have no invitation, gate,
or visitor-data actions until administrator approval unlocks them. The
supporting `20261021120000_member_onboarding_visibility.sql` migration is
applied to the linked Movmak project. Its pgTAP suite and the full browser
journey have not run. The host issuance limit migration `20261019130000` is applied, but its
fixture-writing pgTAP suite and full authenticated host journey remain unrun.

The product requirements below remain the V1 source of truth. The current
implementation uses Next.js App Router Server Components and Server Actions,
Supabase Auth with SSR cookies, and Supabase PostgreSQL with forced RLS.

Implemented in code and migrated to Supabase Cloud:

- Email/password sign-up and sign-in, verified session handling, protected
  routes, role checks, self-service organization creation, and administrator
  approval of membership requests made through reusable join links.
- One organization membership per user. New organization creators become the
  first active administrator; sign-up alone grants no membership or role.
- Five-minute host invitation links and four-digit host codes. Rotation revokes
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
  rate-limit migration `20261019130000` is applied, while its fixture-writing
  database tests and the full authenticated browser journey are unverified.

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
  basic reporting.

Outstanding V1 work includes browser-level end-to-end coverage, executing the
pgTAP security suite in an isolated database, organization settings,
hardened error/loading states, and final security and
accessibility review. No deployment has been performed.

The current local launch update adds an official organization website,
Supabase Storage-backed organization logos, required host phone and house/unit
address, immutable account roles, a fixed purpose list, and a user-facing
**Companions** count. PostgreSQL keeps `group_size` as the total
(`companions + 1`) for emergency totals and existing reports. Authorized
security can correct companions on Expected or Inside visits through a locked,
audited database operation. Admin dashboard cards are links, pending-member and
expected-visitor previews are visible, and visit rows open detail dialogs.
Migrations `20261024120000_launch_ui_operational_details.sql` and the follow-up
QR-preview volatility correction `20261024123000` are applied to Supabase Cloud.
Remote database lint passes and generated TypeScript types match the live schema;
authenticated browser journeys and fixture-writing pgTAP tests remain unexecuted.

The current update adds security-verified host addresses and
landlord/tenant status before host approval, verifier and approver attribution,
required security name and phone with an optional private profile photo,
four-digit newly issued host codes, visitor phone confirmation, organization
branding during onboarding, separate administrator/security visit-detail
pages, and security visit history from the security account&apos;s creation time.
Security can re-verify an active host after an address change. Crucial profile,
approval, companion, revoke, and manual-checkout actions use confirmation
dialogs. Migration `20261029160000_verified_profiles_and_security_history.sql`
is applied to the linked Movmak project. Its pgTAP suite and authenticated
browser journeys remain unexecuted and must not be marked verified.

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
Sees organization and own profile details, current invitation link, and current four-digit host code; can copy/share them. Does **not** see or manage visitor lists.

### Security / reception
Scans visit QR codes, manually registers walk-ins and visitors without smartphones, verifies host codes when required, sees Currently Inside, and checks visitors out. Actions are tied to the authenticated security/reception user.

## 4. Invitation flow
1. Host opens a minimal home screen showing organization details, their profile, current invitation link and four-digit invitation code.
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
3. Host opens Movmak and provides their current unique four-digit host code.
4. Visitor tells the code to security.
5. Security enters the code in Movmak.
6. Movmak validates it server-side, identifies the host, and confirms the host is an active/authorized staff member, host, or resident in that organization.
7. Movmak displays the verified host and records them against the visit.
8. Security manually records visitor name, phone (or N/A), purpose and companions, then checks the visitor in.
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
V1 records the primary visitor plus a **Companions** count. The primary visitor
is always one person and is not included in the Companions field. Example: John
Doe with 3 companions means 4 total people. Security may correct companions at
arrival or while the visit is Inside; every correction is audited. Do not
require individual companion records or imply their identities were verified.

## 8. Check-in and checkout
### QR check-in
Security scans with a supported phone/tablet/computer camera. Movmak validates the QR server-side and immediately checks an expected visit in, then displays the visitor, phone, host, purpose, group count and resulting status. Record time and authenticated user. Reject invalid, expired, already-closed, or unauthorized visits.

### QR checkout
Security scans the same visit QR again. Movmak verifies the visit is active and inside, immediately checks it out, records the time and authenticated user, and closes the QR/visit credential permanently.

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
- **Host Home:** organization details, own profile, current invitation link, current four-digit host code, copy/share actions.
- No visitor list.

### Security/reception screens
- **Gate Home:** three primary actions—**Scan QR**, **New Visitor**, **Currently Inside**.
- **QR Result:** visitor/host/purpose/group details and the automatic check-in or checkout result.
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
3. Security scans a valid expected-visit QR to check in automatically, then scans the same QR later to check out automatically.
4. Closed QR reuse is rejected.
5. Security manually registers and checks out a visitor without a smartphone.
6. No-smartphone flow requires current four-digit host code, identifies an active host, and records the host.
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
