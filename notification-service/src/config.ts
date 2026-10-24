// Бот одного пользователя: всё, что не от ALLOWED_TELEGRAM_ID, игнорируем.
export const ALLOWED_TELEGRAM_ID = (process.env.ALLOWED_TELEGRAM_ID || '').trim()

// С сервера (РФ) Telegram напрямую режется — ходим через xray-клиент на хосте.
// Только для api.telegram.org: PocketBase на 127.0.0.1 — напрямую.
export const TELEGRAM_PROXY = (process.env.TELEGRAM_PROXY || '').trim()

// Отметить из бота можно сегодня и вчера (забыл вечером — отметил утром).
export const BACKFILL_DAYS = 1

export const isAllowed = (telegramId: string | number | undefined | null): boolean =>
  !!ALLOWED_TELEGRAM_ID && String(telegramId ?? '') === ALLOWED_TELEGRAM_ID

// ─── механика из routine-bot ──────────────────────────────────────────────
export const NUDGE_AFTER_MIN = 40 // доводчик: один раз, через 40 минут после блока, если не отмечено всё
export const EVENING_FROM = '21:00' // блоки с этого времени — «вечерние»: закрытие-фраза и своя фраза в доводчике
export const PHRASE_REPEAT_DAYS = 7 // фраза не повторяется неделю
export const OWN_IN_CLOSING = 0.27 // своя фраза вместо closing — примерно раз в 3–4 дня
// «Мысли» в таблицу пишет тот, кто сейчас принимает /мысль; включается при переключении с routine-bot
export const EXPORT_NOTES = process.env.EXPORT_NOTES === '1'

export const isEvening = (time: string): boolean => time >= EVENING_FROM
