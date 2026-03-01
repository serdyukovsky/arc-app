# ARC Mini App

Telegram Mini App for habit tracking (28-day rings + kintsugi mechanics).

## Local run

```bash
npm install
npm run dev -- --port 5180
```

Open: `http://localhost:5180`

## Storage behavior

By default the app persists data to:
1. `localStorage`
2. Telegram `CloudStorage` (when running inside Telegram WebApp)

## PocketBase integration (optional)

If `VITE_PB_URL` is set, the app additionally:
1. Authenticates via `POST /api/arc/telegram-auth` using Telegram `initData`
2. Loads state from `GET /api/arc/state`
3. Saves state to `POST /api/arc/state`

Set env:

```bash
cp .env.example .env
```

### PocketBase hooks

Hook file is provided at:
`pocketbase/pb_hooks/arc.pb.js`

It expects:
1. auth collection `users`
2. base collection `arc_state` with fields:
   - `user` relation -> `users` (required, unique)
   - `state` json/text (required)
3. env var `TELEGRAM_BOT_TOKEN`

### Telegram setup notes

1. `telegram-web-app.js` is already included in `index.html`.
2. App calls `WebApp.ready()` and `WebApp.expand()` on startup.
3. Haptics and BackButton are enabled when available.
