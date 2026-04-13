const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const WEBAPP_URL = process.env.WEBAPP_URL || ''
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`

interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown'
  withAppButton?: boolean
  buttonText?: string
  persistentAppKeyboard?: boolean
}

interface TelegramApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat?: { id: number | string; type?: string }
    text?: string
    from?: { id: number | string; is_bot?: boolean }
  }
}

const START_TEXT =
  'Трекер привычек помогает держать ритм и не терять стрик.\n\nОткрой приложение кнопкой ниже и начни отмечать прогресс.'

async function apiCall<T>(method: string, body?: unknown): Promise<T | null> {
  if (!BOT_TOKEN) return null

  try {
    const res = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
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
  } = options

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  }

  if (withAppButton && WEBAPP_URL) {
    body.reply_markup = persistentAppKeyboard
      ? buildPersistentAppKeyboard(buttonText)
      : buildInlineAppMarkup(buttonText)
  }

  const result = await apiCall<{ message_id?: number }>('sendMessage', body)
  return result?.message_id ? String(result.message_id) : null
}

export async function setChatMenuButton(chatId: string, buttonText: string = 'Открыть приложение'): Promise<void> {
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

export async function getUpdates(offset?: number): Promise<TelegramUpdate[]> {
  const result = await apiCall<TelegramUpdate[]>('getUpdates', {
    timeout: 25,
    allowed_updates: ['message'],
    ...(offset ? { offset } : {}),
  })
  return result ?? []
}

async function handleStart(chatId: string): Promise<void> {
  await setChatMenuButton(chatId)
  await sendMessage(chatId, START_TEXT, {
    parseMode: 'HTML',
    withAppButton: true,
    buttonText: 'Открыть приложение',
    persistentAppKeyboard: true,
  })
}

export async function pollBotUpdates(): Promise<void> {
  if (!BOT_TOKEN) return

  let offset = 0
  console.log('[telegram] Bot polling started')

  while (true) {
    try {
      const updates = await getUpdates(offset)

      for (const update of updates) {
        offset = update.update_id + 1

        const message = update.message
        const chatId = message?.chat?.id
        const text = String(message?.text || '').trim()
        if (!chatId || !text) continue

        if (text === '/start' || text.startsWith('/start ')) {
          await handleStart(String(chatId))
        }
      }
    } catch (err) {
      console.error('[telegram] Polling loop error:', err)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }
}
