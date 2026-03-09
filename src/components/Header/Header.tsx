import { formatDate, getGreeting, getWeekDays, isToday, DAY_NAMES_SHORT, parseKey, today } from '@/lib/date'
import { Logo } from '@/components/Logo/Logo'
import styles from './Header.module.css'

export function Header() {
  const todayKey = today()
  const weekDays = getWeekDays()
  const todayDate = parseKey(todayKey)
  const todayTime = todayDate.getTime()

  return (
    <div className={styles.header}>
      <div className={styles.topRow}>
        <div className={styles.date}>{formatDate(todayKey)}</div>
        <Logo size={22} opacity={0.45} />
      </div>
      <div className={styles.greeting}>{getGreeting()}</div>
      <div className={styles.week}>
        {weekDays.map((day, i) => {
          const isCurrentDay = isToday(day)
          const dayDate = parseKey(day)
          const isFuture = dayDate.getTime() > todayTime
          return (
            <div key={day} className={styles.weekDay}>
              <span className={`${styles.weekLabel} ${isCurrentDay ? styles.weekLabelToday : ''}`}>
                {DAY_NAMES_SHORT[i]}
              </span>
              {isCurrentDay ? (
                <div className={styles.todayBadge}>{dayDate.getDate()}</div>
              ) : (
                <span className={`${styles.weekDate} ${isFuture ? styles.weekDateFuture : ''}`}>
                  {dayDate.getDate()}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
