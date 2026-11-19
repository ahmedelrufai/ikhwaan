# Ikhwaan Cooperative

Next.js, React, TypeScript, MongoDB and Yup. Separate member and administrator workspaces.

## Run

```sh
npm install
cp .env.example .env.local # only when .env.local does not already exist
npm run dev
```

- `/`: email sign-in and account creation
- `/complete-profile`: verified account profile wizard (Personal profile → Next of kin)
- `/application-status`: submitted profile awaiting administrator approval
- `/portal`: protected member workspace
- `/admin/login`: administrator sign-in
- `/admin`: protected administrator workspace

Roles are enforced in page routes and APIs. Email account creation creates an incomplete member account; only submitted profiles enter administrator review. Signing in redirects to the correct workspace. Member responses exclude other members, administrative records, passwords and raw ballots.

## Administrator setup

New databases start empty. Create your administrator through the trusted local CLI. Existing email addresses are refused. Administrators sign in using an emailed code too; no password is required.

```sh
node --experimental-strip-types scripts/create-admin.mjs admin@example.com "Cooperative Admin"
```

The CLI uses `.env.local`. Use Node.js 22.18+ or 24.

## Member workflows

- Enter only an email to create an account or sign in, then verify the emailed one-time code. Complete and save Personal profile first, then Next of kin; submitting both stages sends the profile for approval. Until approval, only the application status is available. Dashboard routes, statements, payments and member actions require a complete, approved profile.
- Edit personal and next-of-kin details after approval. Sign out to revoke existing sessions. Password sign-in and password changes are no longer used.
- View personal statements, balances, loan decisions, announcements and dividend allocations.
- Download a CSV statement.
- Save one bank account separately. Existing valid bank details on an older application are reused. Loan forms display existing member and financial information automatically; members enter only the request, proposed repayment date and declaration.
- Save/resume drafts, attach a supporting document, submit, track decisions and schedules, accept approved terms, and cancel an unfunded application before transfer verification starts.
- Submit a membership withdrawal notice.
- Pay the configured membership fee through Paystack when payments are enabled.
- Cast one vote per scheduled ballot while voting is open.

Records refresh on window focus and every 30 seconds. The savings chart groups actual records into the last six calendar months. Amounts use integer kobo and display cents.

## Administrator workflows

- Search/filter members and open `/admin/members/[id]` for personal, contact, next-of-kin and financial details. Approval, rejection and suspension actions are available only on the detail screen. Membership activities open the relevant detail screen directly.
- Record savings, contributions and loan repayments using unique transaction references.
- Browse searchable, paginated loan records and open `/admin/loans/[id]` from a row or loan activity. Review actions are on the loan detail screen. Members and activity history are also paginated (10, 25 or 50 rows). The Financial Secretary reviews financial history, the Treasurer reviews availability, and configured management signatories approve. The Secretary General records approved principal and repayment terms. Required signatories verify a completed bank transfer using the same reference and date. The system updates loan balances and prevents repeat disbursement or excess repayment.
- Review withdrawal notices. Approval requires the three-calendar-month notice to expire and all outstanding loans and open loan applications to be resolved.
- Set a membership fee and enable or disable payments; inspect payment records.
- Enter committee-approved dividend allocations, once per member and period.
- Schedule a ballot with its title, candidates, start and end; publish results after closing or cancel a ballot.
- Publish/remove announcements, export transactions and inspect audit records.

Financial recording does **not** initiate bank transfers. Complete transfers through the cooperative's bank, then record the actual reference. Dividend allocations record entitlements, not bank payouts. Financial entries are append-only through the UI; there is no destructive edit/delete operation.

Loan eligibility and dividend amounts are manual committee decisions. There is no automatic interest, prioritization or dividend formula. Membership withdrawal approval does not execute a settlement payment.

Ballots use one vote per active member account per ballot, including active office holders who retain member accounts. Standalone administrator accounts cannot vote. Candidate totals stay hidden until publication, and tied totals remain tied. Raw ballots are never returned by either API. Votes are linked to members in storage for duplicate prevention: this is **not an anonymous/cryptographic secret-ballot implementation**. Eligibility is checked at voting time. Schedule a separate ballot for each position; only use these rules when approved by the cooperative.

## Storage and security

Set `MONGODB_URI`, `MONGODB_DB` and a random `SESSION_SECRET` of at least 32 characters in `.env.local`. MongoDB is mandatory in production. Local development without a MongoDB URI persists to `.data/portal.json`; `PORTAL_DATA_DIR` can point to disposable test data.

Legacy password hashes remain in storage for compatibility, but public authentication accepts only emailed OTPs. Sessions are signed, HTTP-only, SameSite=Lax, secure in production and expire after eight hours. Sign-out invalidates older sessions. Mutations require a matching origin. Admin endpoints enforce role checks before exposing records or changing state. Registration cannot assign roles. Basic authentication/payment rate limits are process-local.

MongoDB currently stores a versioned state document with optimistic concurrency. Conflicting writes fail for retry. This implementation supports review and small deployments; high-volume production needs indexed entity collections, distributed rate limits, backups, monitoring and tested recovery. Audit records are application records, not tamper-proof external storage. External financial-system synchronization is not implemented. Email sign-in requires working SMTP credentials.

## Paystack

Set `PAYSTACK_SECRET_KEY` on the server. In Admin → Payments, enter the approved fee in NGN and enable payment collection. Environment defaults `PAYMENTS_APPROVED` and `MEMBERSHIP_FEE_KOBO` remain supported until admin settings are saved.

Configure the Paystack webhook URL as `https://your-domain/api/payments/webhook`. Set `PAYSTACK_WEBHOOK_SECRET` if the account uses the newer signing-secret header; otherwise legacy `x-paystack-signature` verification uses the API secret. Webhooks verify raw-body signatures; the newer header also enforces the timestamp window. Reconciliation validates reference, amount, currency and member email, and successful settlement is idempotent. The checkout return and member Verify button also verify payment server-side. Pending checkout URLs are reused to prevent creating duplicate checkouts.

No live payment or bank transfer was executed in development checks. Provider availability and live credentials must be verified in the deployment environment.

References: [Accept payments](https://paystack.com/docs/payments/accept-payments/), [Verify payments](https://paystack.com/docs/payments/verify-payments/), [Webhooks](https://paystack.com/docs/payments/webhooks/).

## Checks

```sh
npm test
npx tsc --noEmit
npm run build
```

API checks create members and financial records, so run them only against a disposable database. Create disposable fixtures first using `MONGODB_URI= PORTAL_DATA_DIR=/private/tmp/ikhwaan-qa node --experimental-strip-types scripts/seed-test.mjs` (empty storage only). Example isolated server:

```sh
MONGODB_URI= PAYSTACK_SECRET_KEY= \
SESSION_SECRET=qa-only-secret-for-isolated-integration-tests \
PORTAL_DATA_DIR=/private/tmp/ikhwaan-qa NEXT_DIST_DIR=.next-qa \
npx next dev --hostname 127.0.0.1 --port 3012
```

Run `node scripts/verify-auth.mjs` for the current integration suite. It starts its own disposable server on port 3018, seeds test accounts, and captures email in a loopback-only SMTP sink. It exercises OTP sign-in, staged profiling, administrator approval and the broader API checks without sending real emails. `scripts/verify-api.mjs` is invoked by this harness and requires its temporary SMTP inbox.

The checks cover role separation, private records, registration and activation, transaction references, loan review/disbursement/repayment, withdrawal rules, dividend duplicates, ballot dates and duplicate votes, payment signatures and reconciliation, CSV, audit and origin checks. Automated browser testing, the full loan workflow against live MongoDB, and live provider integration have not been verified. The confirmed loan policy was saved to the configured MongoDB.

## Remove historical sample data

Application startup never creates sample accounts or financial records. To clean an older database, run `node --experimental-strip-types scripts/remove-demo.mjs`. The cleanup matches the two original sample account IDs and emails, backs up changed state, and preserves real members and audit history.

## Emergency loan setup and operation

The cooperative has confirmed **one distinct Signatory-A plus one Signatory-B**, with supporting documents **optional**. Assign the actual office holders in Loan settings before recording reviews.

Open **Admin → Loans → Loan settings** before approving loans. The policy manager chooses the cooperative's approval combination (A only, B only, either A or B, one distinct A plus B, or all four) and a separate bank-transfer verification combination, document requirement, and office holders. The initial sole administrator can configure this; the policy-manager designation persists once used. No live combination or office assignment is guessed automatically. Assigning an office to an existing member keeps their member account and enables the separate admin workspace. Removing their office removes that administrative access. Each person can hold one office and each office has one holder.

Signatory-A: President / Secretary General. Signatory-B: Treasurer / Financial Secretary. Financial reviews must precede management sign-offs. Approval and disbursement have separate decision records and quorum checks; one person cannot satisfy both groups. Revoked or suspended officials do not count toward a current quorum. Officials cannot review their own applications. Only Signatory-B records financial transactions and loan-specific repayments. Every decision requires a reason and creates an audit record.

The Secretary General records a principal no higher than the request, written terms, installment count and first due date. The system creates a monthly principal-only schedule, preserving every kobo and clamping month ends. No interest or penalties are invented. The member accepts those terms before transfer verification. Money is still transferred through the cooperative's bank; the application records and verifies the actual transfer. It does not initiate one.

Status flow: **Draft → Pending → Under Review → Approved → Awaiting Disbursement → Disbursed → Repaying → Completed**. Rejection/cancellation paths preserve records. Historical `Repaid` records display as `Completed`. Outstanding loans block new submissions unless the configured signatories authorise a one-use exception. Required rejection notes, duplicate references, overpayments and repeat transfers are rejected server-side.

Queue eligibility ends at December 31 in Africa/Lagos time. Historical records and approvals are retained. The Secretary General can explicitly renew a closed queue entry with a reason; a new review cycle requires new decisions. Reopening an approval preserves prior terms and decisions. Neither renewal nor year end deletes an application.

Supporting documents accept PDF/PNG/JPEG up to 5 MB. They are stored in MongoDB GridFS (`loanDocuments`) in production, with authenticated owner/official downloads and no public URLs. Local tests use the disposable data directory. Server-side ownership checks prevent attaching another member's upload. Uploading a file does not validate its contents as evidence or verify a bank account with a bank.

Applications still reference `memberId` in the existing atomic/versioned state store. Structured `loanApprovals` and `loanRepayments` records are maintained separately within that store; disbursements are loan-linked transaction records. The proposed split into separate indexed MongoDB application/loan/repayment/approval/transaction collections has **not** been migrated on the live database. Such a cutover needs coordinated deployment and migration; this change preserves current storage compatibility.

Loan checks now exercise separate official accounts, draft privacy, saved bank reuse, document access, staged approvals, terms acceptance, disbursement quorum, loan-specific repayments and closure. Browser interaction and real bank transfers remain unverified.

## Repayment due dates

Applications request a proposed repayment date using a date field. The Secretary General confirms the first due date and number of monthly installments; notes are optional. The approved schedule is the source for tracking. Admin Overview displays unpaid dated installments with Overdue, Due today and Next 7 days totals. Admin → Repayments adds status filtering and pagination. Entries link to loan details. Repayments clear installments from oldest to newest; partial payments reduce remaining amounts. Date boundaries use Africa/Lagos. Only disbursed/repaying loans create unpaid reminders. The normal 30-second refresh updates these indicators; no email or external notification is sent.

## Action feedback

Admin forms and mutation buttons show errors at the triggering submit/action control, with accessible alerts and focus/scroll into view. Member modals keep errors above their submit buttons; payments, term acceptance, cancellation, voting and sign-out use local feedback. Background loading failures remain page-level. Decision forms use a compact layout, and empty loan detail cards no longer stretch to match neighbouring cards.

## Loan detail workspace

Loan details use a summary with stage progress, Overview/Repayment/History tabs, and a contextual action sidebar with the saved disbursement account. Only the action appropriate to the current office and completed prerequisite reviews is shown. Inline errors remain next to the submit button. The supplied live page was visually checked at 1440px and 390px in an isolated Chrome profile; tabs, overflow and a simulated failed submission were checked without recording a live loan decision.

Loan settings now support A only, B only, either A or B, A+B, and all four for approval and independently for transfer verification. A-only/B-only means one official from that group. Financial and availability reviews remain mandatory. Submitted loans save their policy; settings changes preserve legacy submitted loans before replacing the organization policy. Reopening or renewing keeps the saved policy. Unused exceptions also preserve their approval rule. Current active office holders must still satisfy the saved rule; replacement officials can record fresh decisions, while revoked holders no longer count. Office reassignment remains managed through Loan settings. No automatic delegation or external approval notifications are introduced.

Loan settings use the fixed office list and signatory groups. “Assign position” opens a modal for account/office assignment or removal. The officials table has Loan approval and Transfer approval checkboxes; every selected office is required for that stage, with at least one office selected per stage. Saving uses these exact office selections, replacing the combination selector for new submissions. Existing applications retain their saved policies. Historical combination policies remain supported until changed; the table initially checks eligible offices, and saving makes all checked offices required.

Explicit office checkbox policies use only the selected offices for approval; Financial Secretary and Treasurer reviews are not hidden prerequisites. Historical combination policies retain the staged financial reviews. The same saved policy drives the loan page and server checks.

After approval, selected loan approvers may record the approved principal and repayment schedule and reopen an unfunded approval with a reason. Legacy policies keep Secretary General access for these actions. The member must accept the terms before selected transfer approvers verify the bank transfer. All steps enforce permissions server-side; officials cannot act on their own loans.

Repayment offers now allow an editable one-time flat interest percentage (0–100%, up to two decimal places). Interest is rounded to kobo; principal plus interest is split into monthly installments preserving the exact total. The form previews interest, monthly repayments and the total. Notes are descriptive and never add charges or penalties. The saved offer and dated schedule are available in the member portal before acceptance; declining closes the application while retaining its terms and audit history. Acceptance enables transfer verification. The bank transfer remains principal-only; outstanding balances and repayment completion include interest. Older offers without interest fields retain their original principal-only totals. No external offer notification is sent.

## Loan usability and continuity

Member applications explain the review and offer process, distinguish the proposed repayment date from the final schedule, and ask members to accept final terms separately. Each application shows a progress tracker and a next-step explanation. Transfer date inputs are converted from the official's local time to an explicit timestamp.

If an approval holder changes after approval, a current selected approver can confirm the existing approval with a reason. This preserves accepted terms and any pending transfer details, and does not record another bank transfer. Pending transfer references are reserved across contributions, savings and repayments. Legacy review prerequisites require reviewers who still hold their offices.

## Loan action email notifications

Loan mutations save notification jobs in the same atomic state write. Active office holders are notified when their action becomes available: financial review, funds review, approval, confirmation after an office change, repayment offer preparation, and bank-transfer verification. Members receive an email when an offer is ready to accept or decline. Saved policies determine recipients; previous signers, inactive officials and the applicant are excluded from official action requests. New review cycles generate new requests. Drafts, expired queues and closed loans do not produce action emails.

Each email includes a button and a plain-text link to the exact admin loan detail or member application. Signing in preserves that destination. Links do not grant permission or perform a financial action. Emails contain a reference and task description, without bank details, supporting documents or the applicant's private reason.

Configure these server-only values in `.env.local`:

```dotenv
APP_URL=http://localhost:3000
EMAIL_USER=your-sender@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
LOAN_EMAIL_FROM=Ikhwaan Cooperative <your-sender@gmail.com>
LOAN_EMAIL_CRON_SECRET=your-random-secret
```

Gmail uses TLS SMTP on port 465 through Nodemailer. Use a Gmail app password; see [Nodemailer's Gmail setup](https://nodemailer.com/usage/using-gmail/). The optional sender should use the authenticated Gmail account. Localhost links work only on the machine running the portal. Use the real HTTPS portal origin for deployment. Sender credentials are never returned to the browser. Admin → Loans → Loan settings displays configuration and queue counts for the policy manager.

The request schedules a small delivery batch after its database write succeeds. Run the worker continuously for retries and queue overflow:

```sh
npm run notifications:loans -- --watch
```

Or run `npm run notifications:loans` once per minute from your scheduler. Hosted schedulers may POST to `/api/notifications/loans` with `Authorization: Bearer <LOAN_EMAIL_CRON_SECRET>`; the endpoint accepts no public GET requests. No scheduler is provisioned automatically.

Jobs are leased before sending, retried with increasing delays, and skipped when the associated action is no longer needed. Automatic retries stop 23 hours after the first attempt; investigate provider acceptance before manually retrying older jobs. SMTP acceptance does not prove inbox delivery, and ambiguous SMTP/network failures can cause duplicate delivery despite stable Message-IDs. Email failures do not roll back loan actions. Existing unchanged loans are not bulk-emailed automatically. Tests use a fake transport; live Gmail delivery requires credentials and has not been verified.


## Email sign-in and staged profiles

The same screen handles account creation and sign-in. `POST /api/auth` accepts `request-otp` with an email, then `verify-otp` with its challenge ID and six-digit code. It sets the existing signed HTTP-only session cookie only after successful verification. Public `login`/`register` password actions are disabled. Email input is normalized, codes expire after 10 minutes, five failed attempts lock a code, resends invalidate older codes, and requests are limited to one per minute and five per hour per account. HMAC digests and attempt counters are saved in the versioned state; codes are never returned by an API or logged. Failed email delivery does not establish a session. All code verification attempts update persistent counters.

Account identity is created before membership details. New accounts have `profileStatus: Incomplete` and no membership number. `memberProfiles` stores the two stages separately from account credentials. A verified user saves Personal profile, can return to it, then completes Next of kin and submits. Submission creates the membership number and marks the member Pending review; administrators cannot approve incomplete profiles. Submitted fields are also mirrored onto existing member records to preserve current financial and administrative screens. Existing profiles, approvals, offices, loan records and session compatibility are retained; legacy accounts can sign in with OTP without completing their profiles again.

Routing after verification: incomplete profile → `/complete-profile`; submitted but inactive membership → `/application-status`; active membership → `/portal`; active administrator → `/admin`. Loan email destinations still work through sign-in, but cannot bypass onboarding, approval or role checks. Incomplete accounts are excluded from the administrator's membership review list until submission.

Configure `EMAIL_USER` and `EMAIL_PASSWORD` in `.env.local` using a Gmail app password. `LOAN_EMAIL_FROM` remains the shared optional sender, and `APP_URL=http://localhost:3000` remains the local loan-link origin. Missing email configuration returns a service-unavailable response; there is no development code disclosure or password fallback. For another SMTP service, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT` and `EMAIL_SMTP_SECURE` can override the Gmail defaults; non-implicit-TLS production connections require STARTTLS. Plain loopback SMTP is allowed only outside production for the isolated test sink.

Checks: `npm test`, `npx tsc --noEmit`, `npm run build`, and `node scripts/verify-auth.mjs`. The integration harness never loads the live database. Live Gmail delivery and browser interaction remain unverified.


## Member portal pages

Every member section now has a separate Next.js route and a separate feature component. The sidebar uses links, so refresh, browser Back/Forward, bookmarks and opening sections in another tab preserve the selected page. All pages require a complete, administrator-approved member profile.

| Page | URL |
| --- | --- |
| Overview | `/portal` |
| Savings & contributions | `/portal/savings` |
| Emergency loans | `/portal/loans` |
| Loan details and offer | `/portal/loans/[id]` |
| New application / resume draft | `/portal/loans/new` / `/portal/loans/new?draft=[id]` |
| Payments | `/portal/payments` |
| Dividends | `/portal/dividends` |
| Elections | `/portal/elections` |
| Announcements | `/portal/announcements` |
| Bank account | `/portal/bank-account` |
| Add bank account | `/portal/bank-account/add` |
| Membership | `/portal/membership` |
| Edit personal and next-of-kin details | `/portal/membership/edit` |
| Withdrawal notice | `/portal/membership/withdraw` |

Manage route entry points in `src/app/portal/` and section content in `src/components/portal/`. `src/components/member-portal.tsx` owns the shared sidebar, refresh, mutation feedback and cancellation confirmation. `src/lib/portal-auth.ts` centralizes page access checks; `src/lib/portal-routes.ts` defines navigation and allowed post-sign-in destinations. Loan detail pages also verify record ownership on the server.

New offer emails link to the loan detail page. Previously emailed `/portal?loan=...` links and old payment callbacks redirect to their new pages. Sign-in preserves supported member page destinations; onboarding and approval checks still take priority. Loan and bank forms, profile editing and withdrawal notices are full pages. Cancellation remains a confirmation dialog. The normal 30-second refresh is shared across pages.


## Administration pages

The administrator workspace also uses separate Next.js pages. Section URLs are `/admin`, `/admin/members`, `/admin/transactions`, `/admin/loans`, `/admin/repayments`, `/admin/loans/settings`, `/admin/withdrawals`, `/admin/payments`, `/admin/dividends`, `/admin/elections`, `/admin/announcements` and `/admin/audit`. Member and loan details remain at `/admin/members/[id]` and `/admin/loans/[id]`.

Creation forms have their own pages: `/admin/transactions/new`, `/admin/payments/settings`, `/admin/dividends/new`, `/admin/elections/new` and `/admin/announcements/new`. Successful submissions return to their section. Actions on existing records keep their inline feedback and confirmation behavior.

Route files live in `src/app/admin/(workspace)/` and feature content in `src/components/admin/`. The route group shares `src/components/admin-workspace.tsx` without wrapping `/admin/login`. `src/lib/admin-auth.ts` enforces current administrative access on every page; role and office permissions continue to be checked by the mutation APIs. Detail pages check record existence and exclude unsubmitted member profiles and loan drafts. Navigation, overview cards and activity links use the new routes, while legacy `/admin?view=...` links redirect to the matching page. Sign-in preserves allowed administrator destinations. Normal members cannot bypass permissions using a direct URL.

The shared layout retains refresh, pagination, filters, feedback and the activity detail dialog. Page titles and active navigation follow the URL; browser Back/Forward and refresh preserve the section. No live records are changed by route verification.

## API performance

MongoDB uses a shared connection pool across requests and development reloads. Session checks project only the matching account. Read operations run concurrently; writes remain serialized per store within a process and retain MongoDB revision checks across processes. Read-only projections cannot be used for writes. GridFS uploads and downloads reuse the same pool. Operational CLI scripts close their pools when finished.

Admin pages request `/api/admin?section=...` with only their required data. Members, loan applications and audit records use server-side search, filtering and pagination (`page`, `pageSize` of 10/25/50). Loan status and portfolio totals cover all submitted loans, independently of the requested table page. Detail reads include only their related financial records. The legacy endpoint without a section retains its full response for compatibility. Server-Timing headers separate authentication and data/response work.

Dashboard clients coalesce overlapping reads, cancel obsolete requests, debounce admin search and pause polling in hidden tabs. Route changes fetch the appropriate section; successful mutations force a fresh read. No cross-user cache of private responses is introduced. SMTP connections are pooled; OTP requests still wait for provider acceptance before reporting that a code was sent. Notification scans are limited to loan/member lifecycle actions.

`node --experimental-strip-types scripts/benchmark-api.mjs` measures synthetic payload reduction without database access. Add `--live` for read-only fresh-connection versus pooled-read timings and actual response-size comparison against the configured database. It prints only timing and size measurements, never records or credentials. The synthetic 200-loan/1,000-audit-event case dropped from 233,557 bytes to 5,362 bytes for a 10-row loan page. Results vary with data and network conditions.

Storage remains the existing atomic state document. Section projections and server pagination reduce transfer and processing, but do not migrate entity arrays into separately indexed MongoDB collections. That migration remains the next step if dataset size or write concurrency outgrows the current model. Live benchmarks do not mutate financial records.

For the MongoDB session query specifically, run `node --experimental-strip-types scripts/verify-mongo-session.mjs --live`. This explicit read-only regression check tests an existing account, a revoked session version, a missing account and literal ID handling. It creates no sessions and changes no records. Session account selection uses aggregation with `$filter`; MongoDB does not allow `$elemMatch` projection on the nested `data.members` field.

MongoDB initial connection deadlines default to 30 seconds for server selection and 10 seconds per connection attempt, configurable through `MONGODB_SERVER_SELECTION_TIMEOUT_MS` and `MONGODB_CONNECT_TIMEOUT_MS` (1,000–120,000 ms). The former five-second deadline was too short for observed cold connections. Warm requests continue using the shared pool. Failed connection attempts are removed from the cache so a later request can recover. A page error boundary offers Retry during service outages while preserving the session cookie. Longer deadlines do not resolve an unreachable database, DNS/TLS problems or a blocked Atlas network access list.

Loan settings live at `/admin/loans/settings`, opened with the Loan settings button on the loans page. They are not a separate sidebar item; Loans stays selected while settings are open. The old `/admin/loan-settings` URL redirects to the new location.


Workspace loading keeps the shared sidebar and header mounted. Skeletons occupy the content area on initial data fetches and route transitions; forms, overview cards and loan registers have appropriate placeholder shapes. Admin and member route groups include local loading/error boundaries so content delays and failures do not replace navigation. Loading indicators announce their status once, placeholder graphics are hidden from assistive technology, and shimmer animation respects reduced-motion preferences. Background refreshes retain existing content.

The member loan landing page shows a compact list of applications. Each complete row links to `/portal/loans/[id]`; the separate detail component owns offer acceptance/decline, schedules, documents, approval and repayment history, draft continuation and cancellation. The server checks ownership before opening a detail page. Loan decisions are no longer displayed inline throughout the list.


## Paystack loan repayments

Each disbursed or repaying member loan with a positive balance has a **Make payment** button beside its list row and on its detail page. `/portal/loans/[id]/pay` shows the outstanding balance, suggests the next installment and lets the member choose a partial payment or the remaining balance. Unfunded and completed loans cannot be charged. Row navigation and payment links are separate accessible controls.

Set `PAYSTACK_SECRET_KEY` in `.env.local` (use a test key while developing) and enable **Accept payments** in Admin → Payments → Manage membership fee. The shared collection switch applies to membership fees and loan repayments; the loan amount is independent of the configured membership fee. The browser never receives the secret key. Payment amounts and ownership are validated on the server. Existing membership payments are tracked separately and never prevent a loan repayment, and loan repayments do not count as paid membership fees.

Checkout initialization and verification use the server-side Paystack API. Callback URLs return to the selected loan’s payment page, preserving the destination through sign-in. An existing pending checkout is reused; changing its amount requires verifying or completing it first. Ambiguous initialization failures retain their reference for verification instead of creating another charge. Payment history includes Verify controls for abandoned callbacks and pending attempts.

Configure `/api/payments/webhook` at the public deployment URL in Paystack; localhost cannot receive external webhooks. The checkout return and Verify button still perform server-side verification locally. A successful payment must match its saved reference, amount, currency and customer email before it can credit the saved loan. The signed webhook and checkout verification share an idempotent reconciliation operation, so replay cannot duplicate the repayment. Verified repayments create the loan repayment and transaction records, reduce outstanding balances including agreed interest, clear installments in order, and mark a fully paid loan Completed.

If a payment succeeds after the balance has changed, exceeds the remaining balance, or conflicts with an existing reference, it is recorded Successful with **Needs review** rather than over-crediting the loan. Admin Payments shows the loan link and reconciliation note; the member sees a contact-cooperative message and cannot start another payment until the review is resolved. Reconciliation and refunds for these exceptions are manual cooperative operations; this implementation does not initiate refunds or invent charges.

Checks cover partial/final repayments, loan ownership, funding state, amount limits, pending checkout reuse, gateway response validation, mismatched verification details, replay/idempotency, membership separation and late-payment exceptions. The isolated API harness uses a fake key and signed local webhook to verify actual ledger updates. No real Paystack charge or refund was executed. Provider requests are mocked in adapter tests; live checkout and browser interaction require verification with Paystack test credentials.

References: [Paystack accept payments](https://paystack.com/docs/payments/accept-payments/), [verify payments](https://paystack.com/docs/payments/verify-payments/), [webhooks](https://paystack.com/docs/payments/webhooks/).
