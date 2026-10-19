# Movmak

Movmak is Zeerol's visitor-management and front-desk operating system. The V1
scope and security requirements are defined in `MOVMAK_PROJECT_SPEC.md`.

## Requirements

- Node.js 20.9 or newer
- npm
- A Supabase Cloud project for the hosted database and Auth service

## Local setup

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000` in a browser.

Copy `.env.example` to `.env.local` and fill it locally with values from the
Supabase Dashboard. Do not paste credentials into chat, issue descriptions,
commit messages, or Codex prompts.

- `NEXT_PUBLIC_SUPABASE_URL` is the hosted project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is safe for browser use and remains
  constrained by grants and RLS.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only, bypasses RLS, and must never be
  exposed through a `NEXT_PUBLIC_` variable or browser bundle.
The existing server-only service-role key is domain-separated for temporary
host-code hashes and encrypted short-lived browser cookies. No extra
credential pepper is required.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

## Current implementation

Phase 4 adds Supabase email/password login, cookie-backed SSR sessions,
database-backed route authorization, public account registration, explicit
inactive/no-membership states, self-service organization onboarding, and
administrator-managed membership access. All eight migrations, including the
reusable join-link and approval migration, are applied to the linked Movmak
cloud project. Authenticated browser and pgTAP security tests remain pending.

The protected application starts at `/app`. Authenticated users without a
membership are sent to `/onboarding`; suspended or revoked users are sent to
`/access-inactive`. Role pages perform their own server-side database checks in
addition to the request proxy's optimistic session check.

Creating an Auth account never creates an organization membership. A new user
may either create an organization and become its first active administrator or
request access through a reusable organization join link. A request grants no
organization access until a different active administrator approves it. The
initial V1 restriction permits only one organization membership per user.

The host workspace now shows the resident's own profile and organization,
restores a still-valid invitation/code pair on the same browser without
rotating on every reload, and renews it through the server at expiry. The
public registration page checks an invitation before showing the form and
can restore the latest visit QR on the same browser while the visit is active.
These paths passed local checks, but authenticated browser and isolated
database runtime tests remain pending. The forward-only host issuance
rate-limit migration `20261019130000` is local and unapplied; it requires
separate approval before the live database receives it.

## Supabase Cloud workflow

Supabase Cloud is the intended database. Docker is not required for normal
application development or for linking and applying migrations to the hosted
project. When cloud connection is approved:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Confirm the linked project and review every pending migration before requesting
explicit approval for `npx supabase db push --linked`. Enter credentials only
in the local CLI prompt or local environment; never place them in commands,
source files, or chat. Do not use `db reset --linked`.

The initial migration is in `supabase/migrations`, and the policy tests are in
`supabase/tests`. See `supabase/README.md` for the migration strategy, security
model, optional local validation, and type-generation commands.

## Optional local Supabase stack

Docker is needed only if a developer chooses to run the full Supabase stack
locally. With the Supabase CLI and a Docker-compatible runtime installed:

```powershell
npx supabase start
npx supabase db reset --local
npx supabase db lint --local --level warning --fail-on warning
npx supabase test db --local
```
