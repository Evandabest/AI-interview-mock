# BidBay

BidBay is an auction app where people can browse listings, place bids, and buy or sell items.

Built with Next.js, TypeScript, and SQLite.

## Getting started

Use Node.js 22 or newer.

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and create an account to explore the app. Local sample data is prepared automatically when the development server starts. Restarting the server resets that sample scenario.

The app runs locally without external database services. AI suggestions require an optional API key; see `.env.example`.

## Working on the project

The tasks are in [interview/](interview/).

```bash
npm test
npm run typecheck
npm run build
```
