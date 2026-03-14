import type { PopupEventData, PopupType } from '@/lib/popups'
import type { HabitType } from '@/types'

export interface PopupTextContent {
  title: string
  subtitle: string
}

export const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const getMilestoneSubtitle = (data: PopupEventData): string => {
  const milestone = data.milestone ?? 0
  const streak = data.streak ?? 0

  const byMilestone: Record<number, string[]> = {
    7: [
      'Неделя закрыта. Учёные говорят — привычка начинает формироваться как раз сейчас.',
      'Семь дней. Следующая остановка — четырнадцать.',
    ],
    14: [
      'Две недели. Уже не проверка — скорее привычка.',
      '14 дней подряд. Половина пути до месяца.',
    ],
    21: [
      '21 день. Тот самый миф оказался правдой — по крайней мере для тебя.',
      'Три недели. Если бы это было легко, все бы так делали.',
    ],
    30: [
      'Месяц. Это уже не эксперимент.',
      '30 дней. Осталось столько же — и это станет частью тебя.',
    ],
    60: [
      'Два месяца без пропусков. Мало кто доходит до этой точки.',
      '60 дней. Это уже не сила воли — это система.',
    ],
    66: [
      '66 дней — именно столько нужно мозгу чтобы сделать привычку автоматической. Наука на твоей стороне.',
      'По данным исследований, 66 дней — точка автоматизма. Ты прошёл её.',
    ],
    90: [
      'Квартал. Нейробиологи говорят — примерно столько нужно чтобы переписать паттерн.',
      '90 дней подряд. Попробуй вспомнить себя без этого.',
    ],
    180: [
      'Полгода. Это серьёзно.',
      '180 дней. Где-то в середине ты перестал считать — и это хороший знак.',
    ],
    365: [
      'Год. Это просто кто ты есть теперь.',
      '365 дней. Можно было сдаться в любой из них.',
    ],
  }

  const fallback = [
    `${streak} дней. Это уже территория без карты.`,
    `${streak} дней подряд. Таких немного.`,
  ]

  return pickRandom(byMilestone[milestone] ?? fallback)
}

const getAllDoneSubtitle = (data: PopupEventData): string => {
  const seriesDays = data.seriesDays ?? 0
  const lateTexts = [
    'Сделал в последний момент. Тоже считается.',
    'Поздно — но сделано. Это важнее чем когда.',
  ]

  if (data.timeOfDay === 'late' && Math.random() > 0.5) {
    return pickRandom(lateTexts)
  }

  const buckets: Array<{ max: number; texts: string[] }> = [
    {
      max: 6,
      texts: [
        'Хорошее начало. Не останавливайся.',
        'День закрыт. Завтра снова.',
        'Всё сделано. Пока всё идёт как надо.',
      ],
    },
    {
      max: 20,
      texts: [
        `${seriesDays} дней без пропусков. Ритм есть.`,
        'Уже что-то начинает складываться.',
        'День закрыт чисто. Так и работает.',
      ],
    },
    {
      max: 59,
      texts: [
        `${seriesDays} дней подряд — это уже не случайность.`,
        'Больше трёх недель без пропуска. Мало кто так делает.',
        'Этот момент через год будет частью большой истории.',
      ],
    },
    {
      max: 89,
      texts: [
        'Два месяца. Мало кто доходит до этой точки.',
        `${seriesDays} дней. На этом этапе большинство уже бросили.`,
        'Давно стало нормой — это лучший результат.',
      ],
    },
    {
      max: Number.POSITIVE_INFINITY,
      texts: [
        `${seriesDays} дней. Это просто кто ты есть теперь.`,
        'Три месяца и дальше. Это называется образ жизни.',
        'День закрыт. Как обычно.',
      ],
    },
  ]

  const bucket = buckets.find((entry) => seriesDays <= entry.max) ?? buckets[buckets.length - 1]
  return pickRandom(bucket.texts)
}

export const FIRST_COMPLETE_TIPS: Record<HabitType, string[]> = {
  daily: [
    'Установи конкретное время — утро работает лучше всего',
    'Первая цель — 7 дней. Этого достаточно для начала',
    'Пропустил день — не страшно. Никогда не пропускай два подряд',
  ],
  periodic: [
    'Закрой первые два раза на этой неделе как можно раньше',
    'Буфер спасёт если неделя не задалась',
    'Важна неделя, не конкретный день',
  ],
  counter: [
    'Даже одно действие в день засчитывает стрик',
    'Следи за средним — он честнее чем максимум',
    'Маленькое и стабильное бьёт большое и редкое',
  ],
}

export const POPUP_TEXTS: Record<PopupType, (data: PopupEventData) => PopupTextContent> = {
  streak_lost: (data) => {
    const habitName = data.habitName ?? 'Привычка'
    const streak = data.streak ?? 0
    const subtitles = [
      `Даже Акела промахивался. ${streak} дней никуда не делись.`,
      'Подсдулся. Бывает. Начни сегодня — через неделю это уже история.',
      `${streak} дней — это факт. Ноль — просто новая точка отсчёта.`,
    ]
    return {
      title: `${habitName} — стрик сброшен`,
      subtitle: pickRandom(subtitles),
    }
  },
  milestone_reached: (data) => {
    const streak = data.streak ?? 0
    const unit = data.habitType === 'periodic' ? 'недель' : 'дней'
    return {
      title: `${streak} ${unit} подряд`,
      subtitle: getMilestoneSubtitle(data),
    }
  },
  freeze_offer: () => ({
    title: '',
    subtitle: '',
  }),
  all_done: (data) => ({
    title: 'Всё выполнено',
    subtitle: getAllDoneSubtitle(data),
  }),
  first_complete: (data) => {
    const habitName = data.habitName ?? 'Привычка'
    const subtitles = [
      'Первый раз всегда немного странный. Завтра будет проще.',
      'Начало положено. Остальное — повторение.',
      'День первый. Самое сложное — уже позади.',
    ]
    return {
      title: `${habitName} — первый раз`,
      subtitle: pickRandom(subtitles),
    }
  },
  goal_reached: (data) => {
    const goalDays = data.goalDays ?? 0
    const subtitles = [
      `${goalDays} дней подряд. Это больше чем большинство людей делают за год.`,
      `Цель была ${goalDays} дней. Ты дошёл.`,
    ]
    return {
      title: `${goalDays} дней. Ты сказал — сделал.`,
      subtitle: pickRandom(subtitles),
    }
  },
}

