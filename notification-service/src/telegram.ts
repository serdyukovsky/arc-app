import { fetch as undiciFetch, ProxyAgent } from 'undici'
import { TELEGRAM_PROXY } from './config.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
export const WEBAPP_URL = process.env.WEBAPP_URL || ''
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`

// Прокси — только для Telegram (PocketBase ходит напрямую через глобальный fetch)
const telegramAgent = TELEGRAM_PROXY ? new ProxyAgent(TELEGRAM_PROXY) : undefined

interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown'
  withAppButton?: boolean
  buttonText?: string
  persistentAppKeyboard?: boolean
  replyMarkup?: unknown // своя клавиатура (сообщение-блок) — вместо кнопки приложения
  replyTo?: string // ответом на сообщение (доводчик — к своему блоку)
}

interface TelegramApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat?: { id: number | string; type?: string }
    text?: string
    from?: { id: number | string; is_bot?: boolean }
  }
  callback_query?: {
    id: string
    from: { id: number | string }
    data?: string
    message?: { message_id: number; chat: { id: number | string } }
  }
}

const START_TEXT =
  'Привычки — в приложении, отметки — прямо здесь, кнопками под напоминаниями.'

export async function apiCall<T>(method: string, body?: unknown): Promise<T | null> {
  if (!BOT_TOKEN) return null

  try {
    const res = await undiciFetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      dispatcher: telegramAgent,
    })
    const data = (await res.json()) as TelegramApiResponse<T>
    if (data.ok) return data.result ?? null
    console.error(`[telegram] ${method} failed:`, data.description)
    return null
  } catch (err) {
    console.error(`[telegram] ${method} error:`, err)
    return null
  }
}

function buildInlineAppMarkup(buttonText: string) {
  if (!WEBAPP_URL) return undefined
  return {
    inline_keyboard: [
      [
        {
          text: buttonText,
          web_app: { url: WEBAPP_URL },
        },
      ],
    ],
  }
}

function buildPersistentAppKeyboard(buttonText: string) {
  if (!WEBAPP_URL) return undefined
  return {
    keyboard: [
      [
        {
          text: buttonText,
          web_app: { url: WEBAPP_URL },
        },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  }
}

export async function sendMessage(
  chatId: string,
  text: string,
  options: SendMessageOptions = {}
): Promise<string | null> {
  const {
    parseMode = 'HTML',
    withAppButton = true,
    buttonText = 'Открыть приложение',
    persistentAppKeyboard = false,
    replyMarkup,
    replyTo,
  } = options

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  }

  if (replyTo) body.reply_parameters = { message_id: Number(replyTo), allow_sending_without_reply: true }

  if (replyMarkup) {
    body.reply_markup = replyMarkup
  } else if (withAppButton && WEBAPP_URL) {
    body.reply_markup = persistentAppKeyboard
      ? buildPersistentAppKeyboard(buttonText)
      : buildInlineAppMarkup(buttonText)
  }

  const result = await apiCall<{ message_id?: number }>('sendMessage', body)
  return result?.message_id ? String(result.message_id) : null
}

/** Кнопка слева от поля ввода — приложение. Команды при этом видны, если набрать «/». */
export async function setChatMenuButton(chatId: string, buttonText: string = 'Приложение'): Promise<void> {
  if (!WEBAPP_URL) return

  await apiCall('setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text: buttonText,
      web_app: { url: WEBAPP_URL },
    },
  })
}

export async function editMessage(chatId: string, messageId: string, text: string, replyMarkup?: unknown): Promise<void> {
  // «message is not modified» — не ошибка: состояние уже такое
  await apiCall('editMessageText', {
    chat_id: chatId,
    message_id: Number(messageId),
    text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup ?? { inline_keyboard: [] },
  })
}

export async function answerCallback(callbackId: string, text?: string): Promise<void> {
  await apiCall('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text } : {}) })
}

export async function getUpdates(offset?: number): Promise<TelegramUpdate[]> {
  const result = await apiCall<TelegramUpdate[]>('getUpdates', {
    timeout: 25,
    allowed_updates: ['message', 'callback_query'],
    ...(offset ? { offset } : {}),
  })
  return result ?? []
}

/** Убрать постоянную клавиатуру «Открыть приложение» (старый /start) — она закрывала поле ввода. */
export async function removeReplyKeyboard(chatId: string, text: string): Promise<void> {
  await apiCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: { remove_keyboard: true } })
}

export async function handleStart(chatId: string): Promise<void> {
  await setChatMenuButton(chatId)
  await removeReplyKeyboard(chatId, START_TEXT)
  await sendApp(chatId)
}

/** /app — приложение кнопкой под сообщением. */
export async function sendApp(chatId: string): Promise<void> {
  await sendMessage(chatId, 'Приложение — кнопкой ниже.', { withAppButton: true })
}

export async function pollBotUpdates(onUpdate: (update: TelegramUpdate) => Promise<void>): Promise<void> {
  if (!BOT_TOKEN) return

  let offset = 0
  console.log('[telegram] Bot polling started')

  while (true) {
    try {
      const updates = await getUpdates(offset)
      if (updates.length === 0) await new Promise((resolve) => setTimeout(resolve, 300)) // ошибка сети → без спама

      for (const update of updates) {
        offset = update.update_id + 1
        // нажатия не ждут друг друга: каждое — своя задача
        onUpdate(update).catch((err) => console.error('[telegram] update error:', err))
      }
    } catch (err) {
      console.error('[telegram] Polling loop error:', err)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }
}
