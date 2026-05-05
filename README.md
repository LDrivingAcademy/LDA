# LDA / L Driving Academy

Production-style web app for a UK learner-driver marketplace.

Learners can discover verified instructors, review prices and availability, book lessons, and pay online. Instructors can onboard, submit ADI/PDI verification details, manage availability, and track earnings. Admins approve instructors, review marketplace activity, and manage disputes/refunds.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, RLS, and Storage
- Stripe Connect-ready payment structure
- Google Maps-ready live tracking and distance UI
- Vercel deployment through GitHub

## Local Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create or open the Supabase project.
2. Run the SQL migrations in `supabase/migrations`.
3. Add the Supabase URL and publishable key to `.env.local` and Vercel:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

The schema enables RLS for marketplace tables and creates the private instructor document bucket. Admin access is controlled by rows in `account_roles`; do not store roles in user-editable metadata.

To make a user an admin after they sign up:

```sql
insert into public.account_roles (user_id, role)
values ('USER_UUID_HERE', 'admin')
on conflict do nothing;
```

## Vercel Deployment

1. Connect GitHub repo `LDrivingAcademy/LDA` to Vercel.
2. Use the project root as the app directory.
3. Add every required environment variable from `.env.example` in Vercel Project Settings.
4. Push to `main`; Vercel will build and deploy automatically.

Current public deployment used during setup:

```txt
https://lda-ldrivingacademys-projects.vercel.app
```

## Payments

Stripe Connect is the intended marketplace model:

- Learner pays LDA checkout.
- Platform commission is recorded with `platform_fee_pence`.
- Instructor payout is tracked with `instructor_net_pence`.
- Stripe webhook handling should update `payments`, `bookings.payment_status`, refunds, disputes, and payout states.

## Live Map Tracking

The homepage includes a live lesson tracking preview. It simulates instructor movement by default so the site works without paid keys.

To show real Google Maps tiles, add this Vercel environment variable:

```txt
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_browser_key
```

Production GPS tracking should only be enabled for accepted bookings, near lesson time, with clear learner/instructor consent and minimal location retention.

## Compliance Notes

The app is designed around UK marketplace constraints:

- Learners must confirm they are 17+ and hold a valid provisional licence before booking.
- Instructors must be verified as ADI/PDI and admin-approved before appearing in search.
- Full lesson price must be shown before checkout.
- Stripe handles card data securely.
- Privacy, terms, cancellation/refund, cookie, deletion, and data request pages need solicitor-reviewed final text before launch.
