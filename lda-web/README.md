# Legacy LDA Web Snapshot

This folder is an old marketplace skeleton kept only for reference while the root app is rebuilt.

Do not deploy this folder to Vercel. The active LDA application lives at the repository root and uses the root `package.json`, `src`, `public`, `supabase`, and `vercel.json` files.

## Historical stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Supabase Postgres, Auth, and private Storage
- Stripe Connect marketplace payments
- Postcodes.io postcode validation
- Resend email placeholders
- Vercel deployment

The root app currently runs with demo fallbacks until Supabase, Stripe, Maps, and email environment variables are configured.

## Active local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Deployment

Connect `LDrivingAcademy/LDA` to Vercel with the project root set to the repository root.

Required production variables are listed in the root `.env.example`.
