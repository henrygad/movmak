# Approved product update rollout

These changes are prepared locally. No migration, Auth provider change, SMTP change, deployment, or production-data mutation has been performed.

## Safe order

1. Back up and restore the current schema into an isolated Supabase project.
2. Apply the new `20261110*.sql` migrations there in filename order.
3. Run the pgTAP suite plus authenticated Admin, Resident, Security, family-invitation, visitor-retry, and concurrent-submission journeys.
4. Configure production SMTP and a Supabase-supported SMS provider in the isolated project. Compare Nigerian delivery rate, DND handling, sender registration, fraud controls, support, and total OTP cost before choosing Twilio Verify, Twilio Programmable Messaging, Vonage, or MessageBird. Confirm the currently supported provider list in Supabase documentation at rollout time.
5. Verify new-user and existing-user invitation email behavior. Database invitation creation and email delivery are deliberately separate; delivery attempts remain visible as `requested`, `sent`, or `failed`.
6. Apply migrations to the linked project only after owner approval, then deploy the matching application immediately. The new RPC names are additive, so the currently deployed application remains compatible while migrations are applied.

## Compatibility and recovery

- `host` remains the internal database value during this compatibility release. The product UI and canonical routes use **Resident**. `/signup/host` and `/app/host` redirect to their Resident replacements.
- Existing organizations with no physical address remain operational. Only new Resident applications are blocked until an Admin completes the address.
- Existing Security memberships remain operational while phone verification is introduced. New Security and Resident approvals require Supabase Auth phone confirmation.
- Existing free-form Resident addresses remain unchanged and do not create households. A legacy Resident must explicitly complete structured re-onboarding.
- Raw OTPs, family tokens, QR tokens, invitation tokens, and idempotency keys are never stored or logged.

If isolated validation fails, do not apply these migrations to the linked project. Fix forward with a new migration; never edit an already-applied migration.
