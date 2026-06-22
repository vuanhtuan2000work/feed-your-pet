# Feed Your Pet

Mini floating pet companion built with React, TypeScript, Phaser 3, Zustand, and a Cloudflare Worker + D1 persistence API.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Checks

```bash
npm run lint
npm run check
```

`npm run check` builds the frontend, typechecks the Worker, and runs a Wrangler deploy dry-run.

## Chrome extension

```bash
npm run build:extension
```

Open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select `dist-extension`.

## Cloudflare

1. Create a D1 database named `feed-your-pet-db`.
2. Replace `database_id` in `wrangler.jsonc`.
3. Apply the migration:

```bash
npm run db:migrate:local
wrangler d1 migrations apply feed-your-pet-db --remote
```

4. Run the API locally:

```bash
npm run worker:dev
```

Set `VITE_PET_API_BASE_URL` for the frontend when you want it to sync with a Worker URL. Without it, the game stays local-first with `localStorage` and `BroadcastChannel`.

## Asset notes

Runtime cat animation assets live under `public/assets/pet/cat_actions`, and pet sounds live under `public/assets/pet/sound`. The generated cat variant metadata is refreshed from the action folders during dev/build.
