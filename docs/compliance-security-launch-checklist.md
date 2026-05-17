# LDA compliance, security, and reliability launch checklist

This checklist is for launch readiness. It is not legal advice and must be reviewed by a UK solicitor/data protection adviser before the service takes live bookings at scale.

## UK GDPR and privacy

- Confirm a lawful basis for each processing purpose: account creation, bookings, instructor verification, payments, support, reviews, live tracking, fraud prevention, marketing, and analytics.
- Keep marketing opt-in separate from operational booking messages.
- Keep location tracking limited to the booking and live-tracking purpose. Do not track learners or instructors continuously outside the service window.
- Publish solicitor-reviewed privacy, cookie, terms, cancellation/refund, accessibility, and data-rights wording.
- Complete a data retention schedule for learner accounts, instructor verification documents, booking records, payment references, support messages, disputes, reviews, and deletion requests.
- Complete a DPIA before live location tracking and instructor document uploads go fully live.
- Make account deletion and data request handling operational, including identity checks and documented response timelines.

## Payments and marketplace controls

- Use Stripe Checkout or Stripe-hosted payment surfaces for card entry. Do not collect raw card numbers in LDA forms.
- Use Stripe Connect for instructor payouts and platform commission.
- Store Stripe payment IDs, Checkout Session IDs, refund IDs, dispute IDs, and payout status. Do not store card PAN, CVV, or raw payment credentials.
- Show full lesson price and cancellation terms before checkout.
- Verify test mode end-to-end before switching to live Stripe keys.
- Add Stripe webhook signature verification before relying on payment success for fulfilment.

## Instructor verification and safeguarding

- Do not show instructors in public search until admin approval is complete.
- Store ADI/PDI status, badge number, insurance/licence evidence, approval status, reviewer, and timestamp.
- Restrict instructor documents to admin-only access.
- Keep an audit log for approval, rejection, cancellation, refund, and dispute decisions.

## Technical security

- Keep `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, DVLA keys, and webhook secrets server-only. Never prefix them with `NEXT_PUBLIC_`.
- Use RLS on every Supabase table exposed through the public schema.
- Do not use user-editable metadata for authorization decisions.
- Keep API routes no-store where they return personal, payment, or booking data.
- Keep rate limiting active on checkout, support, feedback, DVLA, Smart Match, and auth handoff routes.
- Use production security headers, HTTPS, HSTS, frame blocking, content type sniffing protection, and a CSP compatible with Stripe, Supabase, Google Maps, Resend, and OpenAI routes.

## Performance and scale

- Use Stripe Checkout redirects instead of heavy client payment logic.
- Prefetch internal navigation links and keep large media optimised through Next/Image.
- Move best-effort in-memory rate limits to Vercel Firewall, Upstash Redis, or another shared store before high traffic launch.
- Add observability for checkout failures, auth failures, email failures, SMS failures, API latency, and Supabase errors.
- Run load tests against non-production before paid launch.

## Production sign-off

- `tsc --noEmit` passes.
- Vercel production build passes.
- Stripe test payment succeeds and webhook marks the booking paid.
- Supabase RLS/advisors reviewed.
- Cookie banner tested with reject, choose, and accept-all paths.
- Privacy, terms, cancellation, accessibility, and cookie pages solicitor-reviewed.
- Data processor list and contracts are confirmed.
