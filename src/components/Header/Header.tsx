import { getGreeting, today } from '@/lib/date'
import { WeekStrip } from '@/components/WeekStrip/WeekStrip'
import styles from './Header.module.css'

interface HeaderProps {
  selectedDay?: string | null
  onDayPress?: (day: string) => void
}

export function Header({ selectedDay = null, onDayPress }: HeaderProps = {}) {
  return (
    <div className={styles.header}>
      <div className={styles.greeting}>{getGreeting()}</div>
      <WeekStrip selectedDay={selectedDay ?? today()} onDayPress={onDayPress} />
    </div>
  )
}
