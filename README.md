# Wayfarer AI

A mobile-first, AI-powered trip planning web app. Plan trips intelligently before you go, then get real-time context-aware recommendations while you're on the ground.

Live at [avivo.dev/wayfarer-ai](https://avivo.dev/wayfarer-ai)

## Features

- **Trip Onboarding** — Multi-step wizard: destination, dates, accommodation type + address, group size/type, interests, food preferences
- **Accommodation-aware AI** — Choose hotel, apartment, Airbnb, hostel, or friend's place; the AI adapts the schedule accordingly (no "breakfast at the hotel" when you're staying with friends)
- **Intelligent Planner** — Search for must-see spots via Google Places, then let Gemini build an optimized day-by-day schedule accounting for opening hours, travel time, and your group
- **Itinerary View** — Chronological timeline with inline editing (name, time, duration, notes), mark activities as visited, log trip memories with emoji
- **Live Mode** — GPS geolocation + "What's Nearby?" sends a context packet (location, time, weather, group, visited spots) to Gemini and returns the 3 best currently-open places
- **AI Packing List** — Gemini generates a smart packing list per destination, season, and group type
- **Pre-trip Checklist** — AI-generated checklist tailored to your trip details
- **Local Tips** — Neighbourhood guides and insider tips powered by Gemini
- **Weather Forecast** — 7-day forecast via OpenMeteo (free, no key needed) shown on trip overview
- **PWA** — Installable on iOS/Android via "Add to Home Screen"

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + Shadcn/UI |
| Auth | NextAuth v4 + Google OAuth |
| Database | NeonDB (PostgreSQL) + Prisma v7 |
| AI | Gemini 1.5 Pro (`@google/generative-ai`) |
| Maps | Google Maps Platform (Places API) |
| Weather | OpenMeteo (free, no key) |
| Deployment | Vercel |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth handler
│   │   ├── trips/                # Trip CRUD
│   │   ├── ai/schedule/          # Gemini: smart schedule
│   │   ├── ai/nearby/            # Gemini: live recommendations
│   │   ├── ai/packing/           # Gemini: packing list
│   │   ├── places/search/        # Google Places proxy
│   │   └── weather/              # OpenMeteo proxy
│   ├── app/                      # Auth-gated trip list
│   ├── trips/
│   │   ├── new/                  # Onboarding wizard
│   │   └── [id]/
│   │       ├── planner/          # Places search + schedule generation
│   │       ├── itinerary/        # Timeline view
│   │       └── live/             # GPS + AI nearby
│   └── auth/error/
├── components/
│   ├── OnboardingWizard.tsx
│   ├── PlannerClient.tsx
│   ├── ItineraryClient.tsx
│   ├── LiveModeClient.tsx
│   ├── TripOverview.tsx
│   ├── WeatherWidget.tsx
│   ├── PackingListSheet.tsx
│   ├── PlaceBottomSheet.tsx
│   └── MemorySheet.tsx
├── lib/
│   ├── auth.ts           # NextAuth config
│   ├── gemini.ts         # Gemini client + prompt builders
│   ├── places.ts         # Google Places API helpers
│   └── prisma.ts         # Prisma client singleton
├── middleware.ts          # JWT route guard
└── types/
    ├── index.ts           # Shared types + constants
    └── next-auth.d.ts     # Session type augmentation
```

## Local Development

### 1. Clone and install

```bash
git clone <repo>
cd wayfarer-ai
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
DATABASE_URL=             # NeonDB pooled connection string
DIRECT_DATABASE_URL=      # NeonDB direct (for migrations)
GOOGLE_CLIENT_ID=         # Google OAuth client ID
GOOGLE_CLIENT_SECRET=     # Google OAuth client secret
NEXTAUTH_SECRET=          # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000/wayfarer-ai
GEMINI_API_KEY=           # Google AI Studio
GOOGLE_MAPS_API_KEY=      # Google Cloud Console (Places API enabled)
```

### 3. Push the database schema

```bash
npm run db:push
```

### 4. Run the dev server

```bash
npm run dev
```

Open [localhost:3000/wayfarer-ai](http://localhost:3000/wayfarer-ai).

## Database Commands

```bash
npm run db:push      # Push schema changes (no migration file)
npm run db:migrate   # Create a migration
npm run db:studio    # Open Prisma Studio
npm run db:generate  # Regenerate Prisma client
```

## Deployment

The app is deployed as a standalone Vercel project with `basePath: /wayfarer-ai`. Traffic is routed from `avivo.dev` via Vercel rewrites already configured in `avivo.dev/vercel.json`.

1. Push to GitHub
2. Connect repo to Vercel
3. Set all env vars in Vercel project settings
4. Deploy — `npm run build` runs `prisma generate && next build` automatically

### Google OAuth Setup

In [Google Cloud Console](https://console.cloud.google.com):
- Authorized JavaScript origins: `https://wayfarer-ai.vercel.app`, `https://avivo.dev`
- Authorized redirect URIs: `https://wayfarer-ai.vercel.app/wayfarer-ai/api/auth/callback/google`, `https://avivo.dev/wayfarer-ai/api/auth/callback/google`

### Google Maps API Setup

Enable in Google Cloud Console:
- Places API
- Maps JavaScript API (if embedding a full map later)

Restrict the API key to your domains.

## Gemini Prompt Design

The app uses a "Context Packet" approach for both Live Mode and Schedule generation. See [`src/lib/gemini.ts`](src/lib/gemini.ts) for the full prompt builders. Example Live Mode packet:

```
You are a world-class local expert for Paris.
- Current location: 48.8566°N, 2.3522°E
- Local time: 2:00 PM, Tuesday, July 15
- Weather: 15°C, cloudy
- Group: 2 adults + 2 kids (ages 4, 7)
- Transport: public transit
- Interests: museums, food, history
- Already visited today: Eiffel Tower
```
