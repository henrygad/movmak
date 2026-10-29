# Movmak Supabase foundation

Supabase Cloud is Movmak's intended PostgreSQL and Auth platform. This
directory contains the CLI configuration, ordered migrations, and pgTAP tests
that define the hosted database. The repository is linked to the Movmak cloud
project `hzovsixdiibsinzmjqvk`. All twelve migrations listed below are applied.

`config.toml` is suitable for CLI and optional local-stack defaults. Its
localhost Auth URLs are not the hosted application's production URLs. Configure
the real Site URL and redirect allow-list in the Supabase Dashboard only after
the application URLs are known; do not run `config push` during this phase.

## Migration strategy

The initial migration is now an immutable applied baseline. It contains only
the authenticated operator function signatures; the older caller-supplied
actor UUID overloads are not created.

Do not edit applied migrations. Add every later schema change as a new
timestamped migration and obtain approval after showing its SQL and dry run.

Applied order:

1. `20261013190000_initial_schema_and_rls.sql` — core tables, enums, triggers,
   audit trail, RLS, visitor registration, QR check-in/out, and host verification.
2. `20261015010000_create_organization_onboarding.sql` — atomic organization
   creation and first administrator membership.
3. `20261015020000_membership_invitations.sql` — private one-time membership
   invitations and the one-organization-per-user rule.
4. `20261015120000_issue_host_credentials.sql` — authenticated five-minute
   host invitation and code rotation.
5. `20261015150000_gate_operations.sql` — active-host lookup, safe QR preview,
   manual gate registration, and Currently Inside queries.
6. `20261015153000_fix_qr_preview_volatility.sql` — correct PostgreSQL
   volatility metadata for QR preview.

7. `20261015170000_admin_member_management.sql` — replaces direct membership
   updates with a restricted audited RPC, adds administrator invitation
   listing, and adds exact dashboard aggregation.
8. `20261019120000_secure_organization_join_links.sql` — reusable
   hash-only organization join links, pending membership requests, explicit
   administrator approval, rotation, revocation, expiry, and rate limiting.
9. `20261019130000_limit_host_credential_issuance.sql` — limits authenticated
   host credential rotation to five pairs per minute and 60 per hour.

10. `20261021120000_member_onboarding_visibility.sql` adds a bearer-link
    preview that reveals only organization name and intended role, adds an
    authenticated applicant-only request-status RPC, prevents pending
    applicants from creating a separate organization, and preserves the role
    assigned by the join link during approval.

11. `20261024120000_launch_ui_operational_details.sql` adds official
    organization websites, organization-logo Storage with administrator-only
    writes, required host address support, immutable membership roles, fixed
    visit reasons, audited companion corrections, and security-only host
    contact details. It generates internal slugs instead of asking owners to
    choose one.
12. `20261024123000_fix_qr_preview_volatility.sql` restores the correct
    `VOLATILE` declaration for the time-sensitive QR preview routine.

The `005_host_credential_issuance.test.sql` and
`006_member_onboarding_visibility.test.sql` pgTAP suites remain unexecuted.

## Authentication and onboarding

Next.js uses Supabase SSR cookies. The request proxy refreshes claims and makes
only optimistic unauthenticated redirects; protected pages and Server Actions
load the verified Supabase user and membership again from the database.

The onboarding RPC derives the actor exclusively from `auth.uid()`. An
authenticated user with no active, suspended, or revoked membership may create
an organization and atomically become its first active administrator. Account
registration itself creates only an Auth user and profile; it grants no
organization membership.

The local application has one login and three tailored signup screens for
organization owners, residents/hosts, and security/reception. Join-link roles
come from the database, not a browser field. After confirmation, a request is
submitted and the applicant opens their host or security dashboard immediately.
The dashboard remains locked until administrator approval. The two
new read-only RPCs and pending-creation guard are active in Supabase Cloud.

The applied join-link migration replaces the earlier email-specific,
immediate-activation workflow. An active administrator creates a reusable link
with a default role. A signed-in user with a confirmed email can submit one
pending request but receives no organization access until a different active
administrator approves it. Link secrets are stored only as hashes. Links can
expire, be revoked, or be rotated, and creation is rate-limited and audited.
Approval is atomic, audited, and preserves V1's one-organization-per-user rule,
including suspended and revoked memberships. The earlier invitation RPC grants
are removed so they cannot bypass approval. A request is audited as a system
event with the verified requester's `auth.uid()` in event data because the
requester has no membership ID yet.

## Security model

- Every application table has enabled and forced Row Level Security.
- An authenticated user's organization access comes from an active membership,
  never a browser-supplied organization or role claim.
- Administrators can read organization visit history, audit events, and manage
  memberships in their own organization.
- Hosts can read only their own membership/profile and their organization. They
  have no visitor inventory permission.
- Security users can read only `INSIDE` visits and their related visitor rows.
- Credential and verification tables have no client-facing policies or grants.
- Public visitor registration is separate and executable only by Supabase's
  `service_role` database role from trusted server code.
- Host-code verification, QR check-in, and checkout run as authenticated RPCs.
  They derive the operator from `auth.uid()` and require that user to have an
  active `security` membership in the target organization. They accept no actor
  UUID, role, or membership ID from the caller.
- Next.js operator routes call these RPCs in the verified user's Supabase
  session. They do not replace the user's session with the service role key.
- Invitation and QR bearer tokens are stored only as 32-byte hashes.
- Six-digit codes are domain-separated HMAC-SHA-256 hashes created on the
  trusted server with the existing server-only service-role secret before
  reaching PostgreSQL. The service-role key is never used by browser code.
- Audit events and host-code attempts are append-only.

`SUPABASE_SERVICE_ROLE_KEY` is server-only. It must never be prefixed with
`NEXT_PUBLIC_`, sent to a browser, committed, or logged. Do not paste
credentials into chat or Codex prompts.

## Application RPCs

- `create_organization_with_admin` creates an organization and its first admin.
- `update_organization_settings` updates the official website and logo URL for
  an active administrator after a validated Storage upload.
- `create_membership_invitation`, `accept_membership_invitation`, and
  `revoke_membership_invitation` are historical functions with no authenticated
  execution grants. Existing records remain intact.
- `create_organization_join_link`, `rotate_organization_join_link`, and
  `revoke_organization_join_link` manage reusable administrator-controlled links.
- `request_organization_membership`, `list_organization_join_access`, and
  `review_organization_membership_request` implement verified pending requests
  and explicit administrator review.
- `issue_host_credentials` rotates an active host's five-minute credentials.
- `register_invited_visit` is the service-role-only public registration
  transaction.
- `verify_host_code`, `preview_visit_by_qr`, `check_in_visit_by_qr`,
  `register_gate_visit`, `get_currently_inside`, `list_active_hosts`, and
  `check_out_visit` are authenticated security operations. They derive the
  operator and organization from `auth.uid()`.
- `update_visit_companions` lets same-organization security correct companions
  on an Expected or Inside visit and writes an audit event. PostgreSQL continues
  to store total `group_size`, including the primary visitor.

## Environment variables

Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_SUPABASE_URL` — public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — browser-safe publishable key.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; used for public registration and
  domain-separated host-code HMACs. Never expose it to clients.

Real `.env*` files are Git-ignored while `.env.example` remains trackable.

## Cloud connection and migration workflow

Docker is not required for linked Supabase Cloud operations. The repository is
already linked; inspect the target and migration plan before every change:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Confirm the linked project reference and review the dry run before requesting
separate approval for:

```powershell
npx supabase db push --linked
```

Do not use `db reset --linked`. Enter the database password only in the local
CLI prompt or a local secret store; never put it in source code or messages.

## Optional local validation

A local stack is optional. It requires the Supabase CLI and a running
Docker-compatible runtime:

```powershell
npx supabase start
npx supabase db reset --local
npx supabase db lint --local --level warning --fail-on warning
npx supabase test db --local
```

The pgTAP suites cover table/RLS configuration, sensitive-function privileges,
organization isolation, operator identity, invalid visit transitions,
invitation and QR replay, onboarding, and join-link approval. They remain
unexecuted because Docker and a separate test database are unavailable; static
review is not a passing test.

`007_launch_operational_details.test.sql` reviews the pending website/logo,
immutable-role, host-detail, companion authorization, privilege, locking, and
audit design. It has not executed.

## Last verified state

On 19 October 2026, the linked Movmak project recorded all eight migrations;
the post-migration dry run found none pending. Read-only catalog checks verified
the new table constraints, forced RLS, no direct table grants, six new RPC
signatures and grants, and revoked legacy invitation RPC grants. Database lint
found no schema errors. Existing organization, user, membership, visitor, visit,
and audit-event counts were unchanged. TypeScript, 49 unit tests, ESLint, and
the production build passed. The join-link pgTAP suite and authenticated
end-to-end mutations have not run; catalog checks do not prove RPC behavior.

A later read-only browser check with an existing dedicated admin account passed:
sign-in, access management, refresh persistence, and redirect away from
onboarding. No join link or membership request was created. Read-only catalog
checks passed for join-table RLS, grants, role permissions, and RPC source
guards. The live database has no unassigned account, so the applicant and
approval browser journey was not run. The pgTAP suites are still unexecuted.
The obsolete three-policy membership assertion in `001_schema_and_rls.test.sql`
has since been corrected to check the single SELECT policy, revoked direct-write
grants, and the restricted management RPC. Read-only linked catalog queries
confirmed those policy and grant values, and the retired invitation RPC grants;
these queries did not execute the pgTAP suites or test runtime RLS behavior.

The CLI supports `supabase test db --db-url <encoded-test-url>`. Because the
pgTAP suites create and mutate fixtures, do not point that command at the live
Movmak database. With Docker and `psql` unavailable, use a separate disposable
Supabase test project, apply the migrations there, and run both pgTAP and
authenticated gate workflow tests with dedicated admin, host, and security
accounts. No such isolated database is currently configured.

## Type generation

The generated database types match the applied linked cloud schema. Regenerate
them after each approved schema migration:

```powershell
npx supabase gen types --lang typescript --linked > src/types/database.types.ts
```

For developers using the optional local stack, replace `--linked` with
`--local`. Regenerate the file whenever the schema changes. Do not access a
linked project until external access has been explicitly approved.
