// Подбор фраз (как в routine-bot): случайная из пула без повторов PHRASE_REPEAT_DAYS дней;
// если весь пул показан недавно — самая давняя.
import { OWN_IN_CLOSING, PHRASE_REPEAT_DAYS } from './config.js'
import type { Phrase } from './types.js'

export function pickPhrase(pool: Phrase[], now: Date, rng: () => number = Math.random): Phrase | null {
  if (pool.length === 0) return null
  const border = new Date(now.getTime() - PHRASE_REPEAT_DAYS * 24 * 3600 * 1000).toISOString()
  const fresh = pool.filter((p) => !p.last_shown_at || p.last_shown_at < border)
  if (fresh.length > 0) return fresh[Math.floor(rng() * fresh.length)]
  return [...pool].sort((a, b) => (a.last_shown_at || '').localeCompare(b.last_shown_at || ''))[0]
}

/** Закрытие: обычно из closing, иногда — своя (если они есть). */
export function pickClosing(closing: Phrase[], own: Phrase[], now: Date, rng: () => number = Math.random): Phrase | null {
  if (own.length > 0 && rng() < OWN_IN_CLOSING) return pickPhrase(own, now, rng)
  return pickPhrase(closing, now, rng)
}
