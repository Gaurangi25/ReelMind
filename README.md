# ReelMind — privacy-first bookmarking starter

A responsive React web MVP for saving Instagram, YouTube and other URLs into a personal, date-organized library. **This is an early web foundation, not yet the Android share-target app or a production launch.**

## What works
- Email/password sign-up and sign-in through Supabase Auth (when configured)
- Private bookmarks and folders with PostgreSQL row-level security
- Save URLs, choose a topic, add notes, create nested folders, search, filter, delete
- Date recorded automatically on save
- Local *preview only* when Supabase isn't configured (sample links and changes are lost on refresh)
- Responsive, deliberately restrained UI

## Setup
1. Install Node.js 20+.
2. In this folder run `npm install`.
3. Create a Supabase project at https://supabase.com and enable email auth. For a public app, configure email confirmation, rate limits, and a reliable SMTP provider.
4. Paste `supabase/schema.sql` into the Supabase SQL editor and run it **once on a new project**. Review the SQL before running it.
5. Copy `.env.example` to `.env.local` and fill in the project URL and publishable/anon key from Supabase. **Never put a service_role or secret key in VITE_ variables.**
6. Run `npm run dev` and open the shown localhost address.
7. Run `npm run build` before deployment.

## Security design
- Supabase handles password hashing and sessions. The browser only receives the public/publishable key.
- RLS restricts SELECT/INSERT/UPDATE/DELETE to authenticated owners. Composite foreign keys stop cross-user folder references.
- No analytics or third-party content fetches are performed by this starter. Opening a saved URL visits the original platform.
- Browser input is rendered through React (not injected as HTML). URLs are limited to http(s) and links use `noopener noreferrer`.
- The SQL assumes a fresh Supabase project. If policies already exist, adapt migrations rather than re-running.

## Not implemented yet
- **Android share-sheet integration**: requires a React Native/Expo development build with native Android share-intent handling; this ZIP is the functioning web foundation.
- **Real AI categorization**: currently a transparent local title-keyword suggestion. A later secure backend worker will use approved metadata and an LLM with explicit privacy controls. Never expose an AI API secret in the frontend.
- Metadata enrichment, thumbnails, background jobs, multiple folder assignments, WhatsApp import, password reset UI, offline queue, email verification UX, deletion/export controls, and abuse/rate-limit testing.

## Production release checklist
- Verify RLS with two separate accounts, including attempted cross-account folder IDs.
- Test login, email verification, recovery, sign-out, session expiry and device loss.
- Add privacy policy, terms, account/data deletion and export, and retention rules.
- Apply abuse controls, monitoring without sensitive content logging, and backup/restore tests.
- Test mobile accessibility, keyboard navigation, input validation, and all error paths.
- Audit all dependencies and review platform/API policies before fetching third-party metadata.

## Architecture direction
Keep Supabase Auth + PostgreSQL RLS as the identity/data foundation. Add an Android React Native client using the same authenticated backend and a server-side metadata/classification worker. Android shares should save the URL first and categorize asynchronously. The original link must remain available if classification fails.
