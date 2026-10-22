# Movmak live testing guide

Use this guide to test the complete Movmak V1 journey against the existing
Supabase project. These steps create real records in that project. Use dedicated
test accounts and clearly labelled test details. Do not use real visitor data.

## 1. Prepare the environment
    
1. Confirm the application has these values in `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY`. Never copy their values into a report.
2. In Supabase Dashboard, open **Authentication > URL Configuration**. Confirm
   the Site URL and redirect allow-list permit `http://localhost:3000` and its
   `/auth/callback` route. Do not change unrelated Auth settings.
3. Confirm the configured SMTP inbox can receive Supabase confirmation mail.
   Check spam if a message does not arrive.
4. Prepare three accessible, dedicated email accounts: one administrator, one
   host/resident, and one security/reception user. Each must be a different
   Supabase user because Movmak allows one organization membership per user.
5. From the project directory, run `npm run dev`. Wait for the ready message,
   then open `http://localhost:3000/signup`.
6. Use separate browser profiles or private windows for administrator, host,
   security, and visitor steps. This avoids mixing login and visitor-recovery
   cookies.

Expected: the signup page shows **Create your account**. If the app does not
start, record the terminal error. If signup mail fails, record the time, target
email domain, and Supabase Auth log error without copying a token or link.

## 2. Register the organization administrator

1. At `http://localhost:3000/signup`, enter the administrator's full name,
   email, and a password of at least 12 characters. Select **Create account**.
2. Expected: **Check your email to confirm your account**. Open the confirmation
   message in that inbox and follow its link. Never share the confirmation URL.
3. If the confirmation link does not establish a session, open
   `http://localhost:3000/login` and select **Sign in** with the same account.
4. At `http://localhost:3000/onboarding`, enter a test organization name and a
   unique lowercase slug using only letters, numbers, and hyphens. Select
   **Create organization**.
5. Expected: `/app` shows the organization name and an **active admin**
   membership. Select **Continue to your workspace**. `/app/admin` should show
   **Administrator overview**.
6. Refresh `/app/admin`, sign out, and sign in again. The same organization and
   administrator workspace must remain available.

Failure: no email, `/login?error=callback`, a repeated onboarding screen after
successful creation, or a non-admin workspace. Report the route, visible error,
time, and whether confirmation was completed. Do not report credentials.

## 3. Create and approve a host membership

1. As the administrator, open
   `http://localhost:3000/app/admin/invitations` or select **Members**.
2. Under **Members and join links**, choose **Resident or worker**, choose an
   expiry, and select **Create join link**. Select **Copy link** immediately;
   its secret is displayed only when created or rotated.
3. Open that link in the host's separate browser profile. A signed-out user is
   taken directly to **Create your account** with the join-link return route
   preserved. Someone who already has an account can select **Sign in** instead.
4. Register the host account and confirm its email. The confirmation/sign-in
   flow returns to **Request to join**; select **Request to join**.
5. Expected before approval: **Your request was sent** and **Request pending**.
   The host must not see organization visitor data. Opening `/app` may lead to
   onboarding because the account still has no membership; do not create a
   second organization.
6. In the administrator browser, refresh `/app/admin/invitations`. Under
   **Pending members**, confirm the correct person and **Email verified**.
   Choose **Resident or worker**, then select **Approve**.
7. In the host browser, refresh or sign in again. `/app` must show an active
   host membership, and **Continue to your workspace** must open `/app/host`.
8. As the host, open `/app/admin/visits`. Expected: redirect to `/app` with
   **Your role does not permit access to that area**. A host must not see the
   organization-wide visitor inventory.

Security edge case: use **Reject** only for a separate request you genuinely
intend to reject. A rejected request must not create a membership.

## 4. Create and approve a security membership

1. As the administrator, return to `/app/admin/invitations`.
2. Create a join link with **Security or reception** and copy it.
3. Open it in the security user's separate profile. Register and confirm the
   security email if necessary, then select **Request to join**.
4. Confirm the request remains pending and reveals no organization data.
5. As administrator, refresh **Pending members**, choose **Security or
   reception**, and select **Approve**.
6. Sign in as the security user. `/app` must show an active security membership;
   **Continue to your workspace** must open `/app/security` and show
   **Gate desk**.
7. Open `/app/admin`, `/app/admin/visits`, and `/app/admin/audit` as security.
   Expected: redirect to `/app` with the role-permission error.

## 5. Generate and send a visitor invitation

1. Sign in as the approved host and open `http://localhost:3000/app/host`.
2. Under **Your invitation and host code**, select
   **Get invitation and code**.
3. Expected: a visitor invitation URL, a six-digit code, and an expiry countdown
   close to five minutes. Select **Copy link** or **Share link**.
4. Send the complete invitation URL to the visitor. The six-digit host code is
   for the no-smartphone gate-verification flow; it is not the visitor QR.
5. Selecting **Refresh now** revokes the previous pair and creates a new
   five-minute pair. Avoid repeated refreshes: the enforced limit is five pairs
   per minute and 60 per hour.

Failure: **Fresh credentials could not be created** or a rate-limit message on
the first normal request. Report the route, time, role, and visible message.
Never include the invitation URL or six-digit code.

## 6. Register the visitor and save the QR

1. Open the host's invitation in the visitor's separate browser or device. The
   route begins `/visit/register?token=`. Do not copy the token into a report.
2. Expected: the organization identity, host name, and **Tell us about your
   visit** form.
3. Enter a clearly labelled test name, a non-personal test phone value, purpose,
   and the number of people entering. Select **Register and get QR** once.
4. Expected: **Your visit QR is ready**, a unique `VIS-...` Visit ID, and the QR.
   Registration creates an **EXPECTED** visit; it does not check the visitor in.
5. Use **Download QR**, **Print QR**, **Share QR**, or take a screenshot. Keep
   the QR private.
6. Refresh the same full invitation URL in the same browser. Expected: the QR is
   restored while the visit remains active. Recovery depends on that browser's
   encrypted cookie and the original URL; clearing cookies or switching browsers
   removes recovery.
7. Open the consumed invitation in a different private window. Expected:
   **Invitation unavailable** and no registration form. The same-browser QR
   recovery in step 6 is not invitation reuse.

Failure: a second browser can register another visit with the consumed link, or
refresh loses the QR before checkout without cookies being cleared. Record the
Visit ID, time, expected result, and visible error. Do not send the QR or token.

## 7. Check the visitor in

1. Sign in as security and open `http://localhost:3000/app/security/scan`, or
   select **Scan QR** from **Gate desk**.
2. Select **Start camera** and scan the visitor's saved QR. Browser camera access
   normally works on `localhost`; grant permission when prompted.
3. If the camera is unavailable, use **Manual QR value** only with the decoded
   Movmak QR payload. A Visit ID is not a QR credential and will not work.
4. Expected: **Confirm visitor** shows visitor, host, purpose, people entering,
   Visit ID, and status **EXPECTED**. Physically confirm the visitor, then select
   **Confirm check-in**.
5. Expected: a `VIS-... checked in` message. Open
   `http://localhost:3000/app/security/inside`; the visitor and group headcount
   must appear.
6. As administrator, refresh `/app/admin` and `/app/admin/visits`. The visit must
   now show **INSIDE**.

Failure: an authorized security user cannot preview the valid QR, wrong visitor
details appear, duplicate rows appear, or status remains expected after success.

## 8. Check the visitor out

1. As security, open `/app/security/inside`, find the visitor, and select
   **Check out**. Alternatively, scan the same QR; an inside visit offers
   **Confirm check-out**.
2. Expected: the visit disappears from **Currently inside** and the group
   headcount decreases.
3. As administrator, refresh `/app/admin/visits`. The visit must show **LEFT**
   with a checkout time in the printable report.
4. Scan the same QR again. Expected: **This visit QR is invalid, closed, or
   unavailable.** A closed visit cannot be checked out twice or reopened.
5. Refresh the original visitor URL in the visitor browser. The closed QR should
   no longer be recoverable.

## 9. Verify administrator inventory, reports, and audit history

1. As administrator, open `/app/admin`. Confirm Expected, Inside, and Left
   metrics reflect the manual test at each stage.
2. Open `/app/admin/visits`. Search by Visit ID or visitor name and use the
   **Status** filter. Confirm the host, purpose, group count, and final status.
3. Open `/app/admin/reports`. Filter if needed and confirm registration,
   check-in, and checkout information. Select **Print report** only if desired.
4. Open `/app/admin/audit`. Search for `visit` or `invitation`. Confirm recorded
   registration, invitation consumption, check-in, checkout, and QR revocation
   events, with appropriate actors and times.
5. Reconfirm that host and security accounts cannot open these administrator
   pages.

## 10. Security edge cases

Run these deliberately and record them separately from the normal journey:

1. **Expired host invitation:** generate a pair, wait more than five minutes,
   then open its invitation in a fresh private window. Expected: **Invitation
   unavailable**.
2. **Rotated invitation:** select **Refresh now**, then open the previous link in
   a fresh private window. Expected: unavailable. The new link remains usable.
3. **Consumed invitation:** after successful registration, open its link in a
   different browser. Expected: unavailable and no second visit.
4. **Closed QR replay:** after checkout, scan the QR again. Expected: invalid,
   closed, or unavailable.
5. **Invalid QR:** submit a non-Movmak value through **Manual QR value**.
   Expected: **Enter or scan a valid Movmak visit QR**.
6. **Unauthorized routes:** signed out users opening `/app/host` or
   `/app/security` go to `/login`; host/security users opening administrator
   routes go to `/app` with a permission error.
7. **Pending membership:** before administrator approval, the applicant must not
   see organization pages or data.
8. **Revoked join link:** an administrator may create and revoke a dedicated
   join link, then open it with an account that has no membership. Expected: the
   request is rejected as invalid, expired, revoked, or already unavailable.

Do not repeatedly guess host codes. Failed host-code checks are recorded and
rate-limited. Movmak supports gate verification; it does not prove identity.

## 11. Record and report results

Mark each item after testing:

- [ ] PASS / FAIL / NOT TESTED — administrator signup and email confirmation
- [ ] PASS / FAIL / NOT TESTED — organization creation and persisted admin access
- [ ] PASS / FAIL / NOT TESTED — host join request remains pending
- [ ] PASS / FAIL / NOT TESTED — host approval and host-only access
- [ ] PASS / FAIL / NOT TESTED — security join request and approval
- [ ] PASS / FAIL / NOT TESTED — host invitation and six-digit code
- [ ] PASS / FAIL / NOT TESTED — visitor registration and QR creation
- [ ] PASS / FAIL / NOT TESTED — same-browser QR recovery
- [ ] PASS / FAIL / NOT TESTED — invitation replay rejection
- [ ] PASS / FAIL / NOT TESTED — QR check-in and Currently Inside headcount
- [ ] PASS / FAIL / NOT TESTED — checkout and closed-QR rejection
- [ ] PASS / FAIL / NOT TESTED — administrator inventory and reports
- [ ] PASS / FAIL / NOT TESTED — audit history
- [ ] PASS / FAIL / NOT TESTED — role and route restrictions
- [ ] PASS / FAIL / NOT TESTED — expired and rotated credential rejection

For a failure, report the date and time, route without secret query parameters,
account role, action, expected result, actual visible message, and a screenshot
with personal data and credentials hidden. Include browser and device details.
Never report passwords, cookies, confirmation links, join links, invitation
tokens, host codes, QR images/payloads, API keys, or request authorization
headers.
