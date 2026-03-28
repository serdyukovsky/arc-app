const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const WEBAPP_URL = process.env.WEBAPP_URL || ''
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`

interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown'
  withAppButton?: boolean
  buttonText?: string
}

export async function sendMessage(
  chatId: string,
  text: string,
  options: SendMessageOptions = {}
): Promise<string | null> {
  const { parseMode = 'HTML', withAppButton = true, buttonText = 'Открыть Arc' } = options

  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  }

  if (withAppButton && WEBAPP_URL) {
    body.reply_markup = {
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

  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.ok) {
      return String(data.result?.message_id || '')
    }
    console.error('[telegram] sendMessage failed:', data.description)
    return null
  } catch (err) {
    console.error('[telegram] sendMessage error:', err)
    return null
  }
}
