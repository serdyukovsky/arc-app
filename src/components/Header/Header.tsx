import { formatDate, getGreeting, getWeekDays, isToday, DAY_NAMES_SHORT, parseKey, today } from '@/lib/date'
import { Logo } from '@/components/Logo/Logo'
import styles from './Header.module.css'

interface HeaderProps {
  selectedDay?: string | null
  onDayPress?: (day: string) => void
}

export function Header({ selectedDay = null, onDayPress }: HeaderProps = {}) {
  const todayKey = today()
  const activeDay = selectedDay ?? todayKey
  const weekDays = getWeekDays()
  const todayDate = parseKey(todayKey)
  const todayTime = todayDate.getTime()

  return (
    <div className={styles.header}>
      <div className={styles.topRow}>
        <div className={styles.date}>{formatDate(activeDay)}</div>
        <Logo size={22} opacity={0.45} />
      </div>
      <div className={styles.greeting}>{getGreeting()}</div>
      <div className={styles.week}>
        {weekDays.map((day, i) => {
          const isCurrentDay = isToday(day)
          const isSelectedDay = day === activeDay
          const dayDate = parseKey(day)
          const isFuture = dayDate.getTime() > todayTime
          return (
            <button
              key={day}
              type="button"
              className={`${styles.weekDay} ${styles.weekDayButton}`}
              onClick={() => onDayPress?.(day)}
              disabled={!onDayPress}
              aria-label={`Открыть день ${day}`}
            >
              <span
                className={`${styles.weekLabel} ${isCurrentDay ? styles.weekLabelToday : ''} ${isSelectedDay ? styles.weekLabelSelected : ''}`}
              >
                {DAY_NAMES_SHORT[i]}
              </span>
              <span
                className={`${styles.weekDate} ${isFuture ? styles.weekDateFuture : ''} ${isSelectedDay ? styles.weekDateSelected : ''}`}
              >
                {dayDate.getDate()}
              </span>
              <span className={`${styles.todayDot} ${isCurrentDay ? styles.todayDotVisible : ''}`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
