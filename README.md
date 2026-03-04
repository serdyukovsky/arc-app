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

## CI/CD: auto-deploy from `main`

Workflow file:
`.github/workflows/deploy-main.yml`

It runs on every push to `main`:
1. `npm ci`
2. `npm run build`
3. uploads `dist/` to your server via SSH + rsync

Set these GitHub repo secrets:
1. `DEPLOY_HOST` - server host/IP
2. `DEPLOY_PORT` - SSH port (optional, default `22`)
3. `DEPLOY_USER` - SSH user
4. `DEPLOY_SSH_KEY` - private SSH key (ed25519/rsa) for that user
5. `DEPLOY_PATH` - target directory on server (e.g. `/var/www/arc-app`)
6. `DEPLOY_RELOAD_CMD` - optional command after upload (e.g. `sudo systemctl reload nginx`)

Recommended branch flow:
1. work in `dev`
2. merge `dev -> main` via PR
3. deploy happens automatically from `main`
