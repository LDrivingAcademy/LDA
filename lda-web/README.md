# LDA / L Driving Academy Web Marketplace

Production-style Next.js web app skeleton for a UK learner-driver marketplace.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Supabase Postgres, Auth, and private Storage
- Stripe Connect marketplace payments
- Postcodes.io postcode validation
- Resend email placeholders
- Vercel deployment

The app currently runs with demo data until Supabase, Stripe, Maps, and email environment variables are configured.

## Local setup

```bash
cd lda-web
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Deployment

Connect `LDrivingAcademy/LDA` to Vercel and set the project root to `lda-web`, or use the root `vercel.json`/workspace scripts in this repo.

Required production variables are listed in `.env.example`.
