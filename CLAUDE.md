# Wayfarer AI — Claude Code Guide

## Commands

```bash
npm run dev          # Start dev server (localhost:3000/wayfarer-ai)
npm run build        # prisma generate + next build
npm run db:push      # Push schema to NeonDB (no migration file)
npm run db:migrate   # Create a named migration
npm run db:studio    # Open Prisma Studio
npm run db:generate  # Regenerate Prisma client after schema changes
```

## Architecture

**Framework:** Next.js 14 App Router with `basePath: /wayfarer-ai`. All routes and API paths include this prefix.

**Auth:** NextAuth v4 with JWT strategy. Session cookie is `wayfarer.session-token` (dev) / `__Secure-wayfarer.session-token` (prod). The middleware at `src/middleware.ts` guards `/wayfarer-ai/app/**`, `/wayfarer-ai/trips/**`, and `/wayfarer-ai/api/trips/**` + `/wayfarer-ai/api/ai/**`.

**Database:** Prisma v7 + NeonDB via `@prisma/adapter-neon`. Key differences from older Prisma:
- No `url` in `prisma/schema.prisma` datasource — connection is in `prisma.config.ts`
- `src/lib/prisma.ts` uses `PrismaNeon({ connectionString })` (takes a config object, not a Pool instance)
- `prisma.config.ts` is excluded from `tsconfig.json` (it's Prisma CLI only)
- Always run `prisma generate` before `next build` (handled in `npm run build`)

**AI:** Gemini 1.5 Pro via `@google/generative-ai`. All prompt builders are in `src/lib/gemini.ts`. Responses use `responseMimeType: 'application/json'` for structured output — always parse with `JSON.parse(result.response.text())`.

**Google Places:** Server-side proxy at `/api/places/search` to keep `GOOGLE_MAPS_API_KEY` off the client. Autocomplete at `/api/places/autocomplete` accepts an optional `types` param (e.g. `(cities)`) — omit for general address/hotel search.

**Weather:** OpenMeteo at `/api/weather` — free, no API key, takes `lat`, `lng`, `startDate`, `endDate`.

## Key Files

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | NextAuth options (Google provider, PrismaAdapter, JWT callbacks) |
| `src/lib/auth-cookies.ts` | Cookie name constants — change prefix here if needed |
| `src/lib/gemini.ts` | Gemini client, prompt builders, and typed response interfaces |
| `src/lib/places.ts` | Google Places API helpers (search, detail, photo URL) |
| `src/lib/prisma.ts` | Prisma singleton with NeonDB adapter |
| `src/middleware.ts` | JWT route guard — update `matcher` if adding new protected routes |
| `src/types/index.ts` | Shared TypeScript types + INTEREST_OPTIONS, TRANSPORT_OPTIONS, ACCOMMODATION_TYPE_OPTIONS constants |
| `prisma/schema.prisma` | DB schema — User, Trip, Activity models |
| `prisma.config.ts` | Prisma v7 config with adapter (CLI only, excluded from tsc) |

## Adding New Features

**New API route:** Create `src/app/api/<name>/route.ts`. Check auth with `getServerSession(authOptions)`. Use `session.user.id` (typed via `src/types/next-auth.d.ts`).

**New protected page:** Add path pattern to `matcher` in `src/middleware.ts`. Fetch data in a server component and pass to a `'use client'` component.

**New Gemini prompt:** Add builder + types to `src/lib/gemini.ts`. Always request `responseMimeType: 'application/json'` and validate the shape of the parsed response.

**Schema change:** Edit `prisma/schema.prisma`, then run `npm run db:migrate` (migration) or `npm run db:push` (quick push), then `npm run db:generate`.

## Onboarding & Edit Wizard Parity

`OnboardingWizard` (`src/components/OnboardingWizard.tsx`) and `TripEditSheet` (`src/components/TripEditSheet.tsx`) collect the same trip fields across the same steps. Any change to one **must** be mirrored in the other — new fields, new steps, validation changes, UI changes.

## Deployment

Deployed as a standalone Vercel project. `avivo.dev` rewrites traffic from `/wayfarer-ai/**` to the deployed URL — these rewrites are already in `/Users/aviv/Code/avivo.dev/vercel.json`.

Google OAuth redirect URIs must include both `wayfarer-ai.vercel.app` and `avivo.dev` variants.

## Environment Variables

```
DATABASE_URL          NeonDB pooled connection string
DIRECT_DATABASE_URL   NeonDB direct (for migrations)
GOOGLE_CLIENT_ID      Google OAuth
GOOGLE_CLIENT_SECRET  Google OAuth
NEXTAUTH_SECRET       openssl rand -base64 32
NEXTAUTH_URL          https://wayfarer-ai.vercel.app/wayfarer-ai (prod)
GEMINI_API_KEY        Google AI Studio
GOOGLE_MAPS_API_KEY   Google Cloud Console (Places API enabled)
```
