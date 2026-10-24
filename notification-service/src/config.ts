// Бот одного пользователя: всё, что не от ALLOWED_TELEGRAM_ID, игнорируем.
export const ALLOWED_TELEGRAM_ID = (process.env.ALLOWED_TELEGRAM_ID || '').trim()

// С сервера (РФ) Telegram напрямую режется — ходим через xray-клиент на хосте.
// Только для api.telegram.org: PocketBase на 127.0.0.1 — напрямую.
export const TELEGRAM_PROXY = (process.env.TELEGRAM_PROXY || '').trim()

// Отметить из бота можно сегодня и вчера (забыл вечером — отметил утром).
export const BACKFILL_DAYS = 1

export const isAllowed = (telegramId: string | number | undefined | null): boolean =>
  !!ALLOWED_TELEGRAM_ID && String(telegramId ?? '') === ALLOWED_TELEGRAM_ID
